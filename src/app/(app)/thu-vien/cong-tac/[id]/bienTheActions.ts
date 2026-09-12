"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const KHONG_CO_QUYEN = "Chỉ quản trị viên được sửa thư viện đơn giá.";

const BT_AUDIT_FIELDS = ["tenBienThe", "laMacDinh"] as const;
const BT_AUDIT_SELECT = Object.fromEntries(
  BT_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof BT_AUDIT_FIELDS)[number], true>;

const schema = z.object({
  vatTuId: z.string().trim().min(1, "Phải chọn vật tư"),
  tenBienThe: z.string().trim().optional(),
});

/**
 * Gắn một vật tư vào công tác thành một biến thể.
 *
 * Đặt một biến thể làm mặc định thì gỡ cờ của các biến thể khác — cả hai thao tác
 * trong một giao dịch, vì "hai biến thể cùng mặc định" là trạng thái không có nghĩa
 * và sẽ làm chỗ chọn sẵn đơn giá phải bốc thăm.
 */
export async function themBienThe(
  congTacId: string,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const parsed = schema.safeParse({
    vatTuId: String(form.get("vatTuId") ?? ""),
    tenBienThe: String(form.get("tenBienThe") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [congTac, vatTu] = await Promise.all([
    db.congTac.findUnique({ where: { id: congTacId }, select: { ma: true } }),
    db.vatTu.findUnique({ where: { id: d.vatTuId }, select: { ma: true, ten: true } }),
  ]);
  if (!congTac) return { ok: false, error: "Không tìm thấy công tác." };
  if (!vatTu) return { ok: false, error: "Không tìm thấy vật tư." };

  const trung = await db.congTacVatTu.findUnique({
    where: { congTacId_vatTuId: { congTacId, vatTuId: d.vatTuId } },
  });
  if (trung)
    return { ok: false, error: `Công tác này đã có biến thể "${vatTu.ten}".` };

  const laMacDinh = form.get("laMacDinh") === "on";
  const max = await db.congTacVatTu.aggregate({
    where: { congTacId },
    _max: { sortOrder: true },
  });

  const tao = await db.$transaction(async (tx) => {
    if (laMacDinh) {
      await tx.congTacVatTu.updateMany({
        where: { congTacId },
        data: { laMacDinh: false },
      });
    }
    return tx.congTacVatTu.create({
      data: {
        congTacId,
        vatTuId: d.vatTuId,
        tenBienThe: d.tenBienThe || null,
        laMacDinh,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  });

  await recordAudit({
    actor: await requireSession(),
    entity: "CongTacVatTu",
    entityId: tao.id,
    entityLabel: `${congTac.ma} · ${vatTu.ma}`,
    action: "CREATE",
    changes: diffFields(null, { ...tao }, BT_AUDIT_FIELDS),
  });

  revalidatePath(`/thu-vien/cong-tac/${congTacId}`);
  return { ok: true };
}

export async function datBienTheMacDinh(bienTheId: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const bt = await db.congTacVatTu.findUnique({
    where: { id: bienTheId },
    select: {
      congTacId: true,
      laMacDinh: true,
      congTac: { select: { ma: true } },
      vatTu: { select: { ma: true } },
    },
  });
  if (!bt) return { ok: false, error: "Không tìm thấy biến thể." };

  // Bấm lại vào biến thể đang mặc định = bỏ mặc định. Không có biến thể mặc định là
  // trạng thái hợp lệ: lúc đó người lập dự toán phải tự chọn, và đó có thể là điều
  // mình muốn với những công tác mà chọn sai vật liệu là sai hẳn giá.
  const sau = !bt.laMacDinh;

  await db.$transaction(async (tx) => {
    await tx.congTacVatTu.updateMany({
      where: { congTacId: bt.congTacId },
      data: { laMacDinh: false },
    });
    if (sau) {
      await tx.congTacVatTu.update({
        where: { id: bienTheId },
        data: { laMacDinh: true },
      });
    }
  });

  await recordAudit({
    actor: await requireSession(),
    entity: "CongTacVatTu",
    entityId: bienTheId,
    entityLabel: `${bt.congTac.ma} · ${bt.vatTu.ma}`,
    action: "UPDATE",
    changes: diffFields({ laMacDinh: bt.laMacDinh }, { laMacDinh: sau }, BT_AUDIT_FIELDS),
  });

  revalidatePath(`/thu-vien/cong-tac/${bt.congTacId}`);
  return { ok: true };
}

export async function xoaBienThe(bienTheId: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const bt = await db.congTacVatTu.findUnique({
    where: { id: bienTheId },
    select: {
      ...BT_AUDIT_SELECT,
      congTacId: true,
      congTac: { select: { ma: true } },
      vatTu: { select: { ma: true } },
      _count: { select: { donGia: true } },
    },
  });
  if (!bt) return { ok: false, error: "Không tìm thấy biến thể." };

  // Cùng lý lẽ với khu vực: xóa biến thể sẽ kéo theo các bản đơn giá riêng của nó
  // (Cascade), và những dòng dự toán đang dùng sẽ lặng lẽ rơi về giá chung.
  if (bt._count.donGia > 0) {
    return {
      ok: false,
      error: `Biến thể này đang có ${bt._count.donGia} bản đơn giá riêng. Xóa các bản giá đó trước.`,
    };
  }

  await db.congTacVatTu.delete({ where: { id: bienTheId } });
  await recordAudit({
    actor: await requireSession(),
    entity: "CongTacVatTu",
    entityId: bienTheId,
    entityLabel: `${bt.congTac.ma} · ${bt.vatTu.ma}`,
    action: "DELETE",
    changes: diffFields(bt, null, BT_AUDIT_FIELDS),
  });

  revalidatePath(`/thu-vien/cong-tac/${bt.congTacId}`);
  return { ok: true };
}
