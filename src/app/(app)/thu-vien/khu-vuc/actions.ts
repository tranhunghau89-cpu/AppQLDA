"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const KHONG_CO_QUYEN = "Chỉ quản trị viên được sửa thư viện đơn giá.";

const KV_AUDIT_FIELDS = ["ma", "ten", "ghiChu", "active"] as const;
const KV_AUDIT_SELECT = Object.fromEntries(
  KV_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof KV_AUDIT_FIELDS)[number], true>;

const schema = z.object({
  ma: z.string().trim().min(1, "Mã khu vực không được để trống"),
  ten: z.string().trim().min(1, "Tên khu vực không được để trống"),
  ghiChu: z.string().trim().optional(),
});

export async function luuKhuVuc(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const parsed = schema.safeParse({
    ma: String(form.get("ma") ?? ""),
    ten: String(form.get("ten") ?? ""),
    ghiChu: String(form.get("ghiChu") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ma = d.ma.toUpperCase();

  const trung = await db.khuVuc.findUnique({ where: { ma } });
  if (trung && trung.id !== id)
    return { ok: false, error: `Mã khu vực "${ma}" đã tồn tại.` };

  const data = { ma, ten: d.ten, ghiChu: d.ghiChu || null };
  const truoc = id
    ? await db.khuVuc.findUnique({ where: { id }, select: KV_AUDIT_SELECT })
    : null;

  let kvId = id;
  if (kvId) await db.khuVuc.update({ where: { id: kvId }, data });
  else kvId = (await db.khuVuc.create({ data })).id;

  await recordAudit({
    actor: await requireSession(),
    entity: "KhuVuc",
    entityId: kvId,
    entityLabel: ma,
    action: id ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, KV_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/khu-vuc");
  return { ok: true };
}

export async function xoaKhuVuc(id: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const truoc = await db.khuVuc.findUnique({
    where: { id },
    select: { ...KV_AUDIT_SELECT, _count: { select: { donGia: true, duAn: true } } },
  });
  if (!truoc) return { ok: false, error: "Không tìm thấy khu vực." };

  // Chặn ở đây thay vì để khóa ngoại SetNull âm thầm dọn hộ: xóa một khu vực đang có
  // bảng giá riêng sẽ làm những đơn giá đó lặng lẽ biến thành giá chung toàn quốc —
  // sai tiền mà không ai thấy. Muốn xóa thì gỡ giá trước, đó phải là một quyết định.
  if (truoc._count.donGia > 0) {
    return {
      ok: false,
      error: `Khu vực này đang có ${truoc._count.donGia} bản đơn giá riêng. Xóa các bản giá đó trước.`,
    };
  }
  if (truoc._count.duAn > 0) {
    return {
      ok: false,
      error: `Khu vực này đang gán cho ${truoc._count.duAn} dự án. Đổi khu vực của các dự án đó trước.`,
    };
  }

  await db.khuVuc.delete({ where: { id } });
  await recordAudit({
    actor: await requireSession(),
    entity: "KhuVuc",
    entityId: id,
    entityLabel: truoc.ma,
    action: "DELETE",
    changes: diffFields(truoc, null, KV_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/khu-vuc");
  return { ok: true };
}

/**
 * Đặt lại toàn bộ khu vực mà một nhà cung cấp phục vụ.
 *
 * Ghi kiểu "thay cả cụm" chứ không thêm/bớt từng dòng: giao diện là một bộ ô tích, và
 * người dùng nghĩ theo trạng thái cuối ("NCC này bán ở ba vùng này"), không theo từng
 * thao tác. Cả cụm nằm trong một giao dịch để không có lúc nào NCC mất hết khu vực.
 */
export async function ganKhuVucChoNhaCungCap(
  supplierId: string,
  khuVucIds: string[]
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const ncc = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { name: true },
  });
  if (!ncc) return { ok: false, error: "Không tìm thấy nhà cung cấp." };

  const hopLe = await db.khuVuc.findMany({
    where: { id: { in: khuVucIds } },
    select: { id: true },
  });
  const ids = hopLe.map((k) => k.id);

  const truoc = await db.nhaCungCapKhuVuc.findMany({
    where: { supplierId },
    select: { khuVucId: true },
  });

  await db.$transaction([
    db.nhaCungCapKhuVuc.deleteMany({ where: { supplierId } }),
    db.nhaCungCapKhuVuc.createMany({
      data: ids.map((khuVucId) => ({ supplierId, khuVucId })),
    }),
  ]);

  await recordAudit({
    actor: await requireSession(),
    entity: "Supplier",
    entityId: supplierId,
    entityLabel: ncc.name,
    action: "UPDATE",
    changes: diffFields(
      { khuVuc: truoc.map((t) => t.khuVucId).sort().join(", ") },
      { khuVuc: [...ids].sort().join(", ") },
      ["khuVuc"]
    ),
  });

  revalidatePath("/thu-vien/khu-vuc");
  revalidatePath("/suppliers");
  return { ok: true };
}
