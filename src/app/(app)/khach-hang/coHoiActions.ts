"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { CO_HOI_TRANG_THAI_MAP } from "@/lib/constants";
import { duocDungKhachHang } from "@/lib/crmScope";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const CH_AUDIT_FIELDS = [
  "tenCongTrinh",
  "diaDiem",
  "buildingType",
  "area",
  "kK",
  "kL",
  "kH",
  "trangThai",
  "lyDoMat",
  "note",
] as const;

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const schema = z.object({
  tenCongTrinh: z.string().trim().min(1, "Tên công trình không được để trống"),
  diaDiem: z.string().trim().optional(),
  buildingType: z.string().trim().optional(),
  area: num,
  kK: num,
  kL: num,
  kH: num,
  trangThai: z.string().trim().optional(),
  lyDoMat: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const s = (form: FormData, key: string) => String(form.get(key) ?? "");

function fields(form: FormData) {
  return {
    tenCongTrinh: s(form, "tenCongTrinh"),
    diaDiem: s(form, "diaDiem"),
    buildingType: s(form, "buildingType"),
    area: s(form, "area"),
    kK: s(form, "kK"),
    kL: s(form, "kL"),
    kH: s(form, "kH"),
    trangThai: s(form, "trangThai"),
    lyDoMat: s(form, "lyDoMat"),
    note: s(form, "note"),
  };
}

const paths = () => revalidatePath("/khach-hang");

/**
 * Chặn theo quyền rồi theo người phụ trách KHÁCH — cơ hội không có chủ riêng, nó thuộc
 * về khách. `khachHangId` và `coHoiId` đều đến từ trình duyệt nên phải truy cả hai.
 */
async function guard(khachHangId: string | null, coHoiId: string | null) {
  let actor;
  try {
    actor = await requirePermission("customer", "edit");
  } catch {
    return { loi: { ok: false as const, error: "Bạn không có quyền quản lý cơ hội." } };
  }

  let chuId = khachHangId;
  if (coHoiId) {
    const ch = await db.coHoi.findUnique({
      where: { id: coHoiId },
      select: { khachHangId: true },
    });
    if (!ch) return { loi: { ok: false as const, error: "Không tìm thấy cơ hội." } };
    // Cơ hội đã có chủ thật; id khách gửi lên chỉ là gợi ý, không tin được.
    chuId = ch.khachHangId;
  }
  if (!chuId) return { loi: { ok: false as const, error: "Thiếu khách hàng." } };

  const kh = await db.khachHang.findUnique({
    where: { id: chuId },
    select: { ownerId: true },
  });
  if (!kh) return { loi: { ok: false as const, error: "Không tìm thấy khách hàng." } };
  if (!duocDungKhachHang(actor, kh.ownerId)) {
    return { loi: { ok: false as const, error: "Khách này do người khác phụ trách." } };
  }
  return { actor, khachHangId: chuId };
}

export async function saveCoHoi(
  khachHangId: string,
  coHoiId: string | null,
  form: FormData
): Promise<CreateResult> {
  const g = await guard(khachHangId, coHoiId);
  if (g.loi) return g.loi;
  const chuId = g.khachHangId!;

  const parsed = schema.safeParse(fields(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const truoc = coHoiId
    ? await db.coHoi.findUnique({
        where: { id: coHoiId },
        select: { ...selectAudit, projectId: true },
      })
    : null;

  // "Đã ký hợp đồng" chỉ đặt được qua đường chuyển sang dự án (Phase 8.5). Cho chọn
  // tay thì sẽ có cơ hội mang tiếng đã ký mà chẳng có dự án nào.
  let trangThai = d.trangThai || truoc?.trangThai || "MOI";
  if (!CO_HOI_TRANG_THAI_MAP[trangThai]) {
    return { ok: false, error: "Trạng thái cơ hội không hợp lệ." };
  }
  if (trangThai === "KY_HD" && !truoc?.projectId) {
    return {
      ok: false,
      error: 'Chuyển sang "Đã ký hợp đồng" bằng nút tạo dự án, không chọn tay.',
    };
  }
  if (truoc?.projectId) trangThai = "KY_HD"; // đã có dự án thì không lùi trạng thái được

  const data = {
    tenCongTrinh: d.tenCongTrinh,
    diaDiem: d.diaDiem || null,
    buildingType: d.buildingType || null,
    area: d.area,
    kK: d.kK,
    kL: d.kL,
    kH: d.kH,
    trangThai,
    // Lý do chỉ có nghĩa khi mất khách; giữ lại lúc khác là để lẫn dữ liệu cũ.
    lyDoMat: trangThai === "MAT" ? d.lyDoMat || null : null,
    note: d.note || null,
  };

  const row = coHoiId
    ? await db.coHoi.update({ where: { id: coHoiId }, data })
    : await db.coHoi.create({ data: { ...data, khachHangId: chuId } });

  await recordAudit({
    actor: await requireSession(),
    entity: "CoHoi",
    entityId: row.id,
    entityLabel: d.tenCongTrinh,
    projectId: truoc?.projectId ?? null,
    action: coHoiId ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, CH_AUDIT_FIELDS),
  });

  paths();
  return { ok: true, id: row.id };
}

const selectAudit = Object.fromEntries(CH_AUDIT_FIELDS.map((f) => [f, true])) as Record<
  (typeof CH_AUDIT_FIELDS)[number],
  true
>;

export async function deleteCoHoi(coHoiId: string): Promise<ActionResult> {
  const g = await guard(null, coHoiId);
  if (g.loi) return g.loi;

  const ch = await db.coHoi.findUnique({
    where: { id: coHoiId },
    select: { tenCongTrinh: true, projectId: true },
  });
  if (!ch) return { ok: false, error: "Không tìm thấy cơ hội." };
  if (ch.projectId) {
    return {
      ok: false,
      error: "Cơ hội này đã thành dự án — không xóa được. Muốn bỏ thì xóa dự án.",
    };
  }

  await db.coHoi.delete({ where: { id: coHoiId } });

  await recordAudit({
    actor: await requireSession(),
    entity: "CoHoi",
    entityId: coHoiId,
    entityLabel: ch.tenCongTrinh,
    projectId: null,
    action: "DELETE",
    changes: null,
  });

  paths();
  return { ok: true };
}
