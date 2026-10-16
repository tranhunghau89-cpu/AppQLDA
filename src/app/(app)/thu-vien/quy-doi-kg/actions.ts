"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";

export type ActionResult = { ok: true } | { ok: false; error: string };

const KHONG_CO_QUYEN = "Chỉ quản trị viên được sửa thư viện đơn giá.";

async function quyenSua(): Promise<ActionResult | null> {
  try {
    await requirePermission("thuVien", "edit");
    return null;
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }
}

function lamMoi() {
  revalidatePath("/thu-vien/quy-doi-kg");
  // Dự toán thi công đọc bảng này khi quy bộ → kg.
  revalidatePath("/projects", "layout");
}

/** Sửa kg một đơn vị của MỘT công tác — ô sửa ngay trên bảng. Trống = gỡ. */
export async function suaKgMotDonVi(congTacId: string, tho: string): Promise<ActionResult> {
  const cam = await quyenSua();
  if (cam) return cam;

  const kg = tho.trim() === "" ? null : tinhBieuThuc(tho);
  if (tho.trim() !== "" && kg == null) {
    return { ok: false, error: laCongThuc(tho) ? "Công thức không hợp lệ." : "Không phải là số." };
  }
  if (kg != null && kg <= 0) return { ok: false, error: "Kg một đơn vị phải lớn hơn 0." };

  const ct = await db.congTac.findUnique({
    where: { id: congTacId },
    select: { ten: true, khoiLuongDonVi: true },
  });
  if (!ct) return { ok: false, error: "Không tìm thấy công tác." };

  await db.congTac.update({ where: { id: congTacId }, data: { khoiLuongDonVi: kg } });
  await recordAudit({
    actor: await requireSession(),
    entity: "CongTac",
    entityId: congTacId,
    entityLabel: ct.ten,
    action: "UPDATE",
    changes: { khoiLuongDonVi: { truoc: ct.khoiLuongDonVi, sau: kg } },
  });
  lamMoi();
  return { ok: true };
}

const loSchema = z.array(z.object({ congTacId: z.string().min(1), kg: z.number().positive() })).max(1000);

/**
 * Ghi một lô kg một đơn vị — "Áp gợi ý cho các mã còn trống". CHỈ ghi vào mã đang
 * trống: số đã khai (có thể là số thật của nhà cung cấp) không bao giờ bị gợi ý đè.
 */
export async function apKgHangLoat(payload: unknown): Promise<ActionResult & { soGhi?: number }> {
  const cam = await quyenSua();
  if (cam) return cam;
  const parsed = loSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ." };

  const ds = parsed.data;
  const ids = ds.map((d) => d.congTacId);
  const conTrong = new Set(
    (
      await db.congTac.findMany({
        where: { id: { in: ids }, khoiLuongDonVi: null },
        select: { id: true },
      })
    ).map((c) => c.id)
  );
  const ghi = ds.filter((d) => conTrong.has(d.congTacId));
  if (ghi.length === 0) return { ok: true, soGhi: 0 };

  // MỘT lệnh cho cả lô: mỗi lệnh đi về CSDL thật ~330ms, một lệnh mỗi mã là vượt hạn
  // giao dịch. Vẫn giữ điều kiện "đang trống" trong chính câu lệnh cho chắc.
  await db.$executeRaw`
    UPDATE "CongTac" AS c SET "khoiLuongDonVi" = v.kg, "updatedAt" = NOW()
    FROM (VALUES ${Prisma.join(ghi.map((d) => Prisma.sql`(${d.congTacId}, ${d.kg}::double precision)`))}) AS v(id, kg)
    WHERE c.id = v.id AND c."khoiLuongDonVi" IS NULL`;
  await recordAudit({
    actor: await requireSession(),
    entity: "CongTac",
    entityId: "quy-doi-kg",
    entityLabel: "Bảng quy đổi bộ → kg",
    action: "UPDATE",
    changes: { khoiLuongDonVi: { truoc: null, sau: `${ghi.length} mã theo gợi ý` } },
  });
  lamMoi();
  return { ok: true, soGhi: ghi.length };
}
