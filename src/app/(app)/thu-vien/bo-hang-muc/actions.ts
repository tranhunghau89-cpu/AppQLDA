"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const KHONG_CO_QUYEN = "Chỉ quản trị viên được sửa thư viện đơn giá.";

const BO_AUDIT_FIELDS = ["ma", "ten", "loaiCongTrinh", "moTa", "active"] as const;
const BO_AUDIT_SELECT = Object.fromEntries(
  BO_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof BO_AUDIT_FIELDS)[number], true>;

const schema = z.object({
  ma: z.string().trim().min(1, "Mã bộ không được để trống"),
  ten: z.string().trim().min(1, "Tên bộ không được để trống"),
  loaiCongTrinh: z.string().trim().optional(),
  moTa: z.string().trim().optional(),
});

export async function luuBoHangMuc(
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
    loaiCongTrinh: String(form.get("loaiCongTrinh") ?? ""),
    moTa: String(form.get("moTa") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ma = d.ma.toUpperCase();

  const trung = await db.boHangMuc.findUnique({ where: { ma } });
  if (trung && trung.id !== id) return { ok: false, error: `Mã bộ "${ma}" đã tồn tại.` };

  const data = {
    ma,
    ten: d.ten,
    // Loại công trình là thứ dùng để CHỌN SẴN bộ cho một dự án; để trống nghĩa là
    // bộ dùng chung, hợp với mọi loại.
    loaiCongTrinh: d.loaiCongTrinh || null,
    moTa: d.moTa || null,
    active: form.get("active") !== null,
  };

  const truoc = id
    ? await db.boHangMuc.findUnique({ where: { id }, select: BO_AUDIT_SELECT })
    : null;

  let boId = id;
  if (boId) await db.boHangMuc.update({ where: { id: boId }, data });
  else boId = (await db.boHangMuc.create({ data })).id;

  await recordAudit({
    actor: await requireSession(),
    entity: "BoHangMuc",
    entityId: boId,
    entityLabel: ma,
    action: id ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, BO_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/bo-hang-muc");
  return { ok: true };
}

export async function xoaBoHangMuc(id: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const truoc = await db.boHangMuc.findUnique({
    where: { id },
    select: { ...BO_AUDIT_SELECT, _count: { select: { phan: true, dong: true } } },
  });
  if (!truoc) return { ok: false, error: "Không tìm thấy bộ hạng mục." };

  // Báo giá gửi khách trỏ tới bộ bằng `templateId` — tham chiếu MỀM, không khóa
  // ngoại, đúng như thiết kế cũ: xóa một bộ không được kéo theo báo giá đã phát hành.
  // Nhưng báo giá đó sẽ mất đường tra ngược, nên cảnh báo trước.
  const soBaoGia = await db.clientQuote.count({ where: { templateId: id } });
  if (soBaoGia > 0) {
    return {
      ok: false,
      error: `${soBaoGia} báo giá gửi khách đang tham chiếu bộ này. Tắt "đang dùng" thay vì xóa.`,
    };
  }

  await db.boHangMuc.delete({ where: { id } });
  await recordAudit({
    actor: await requireSession(),
    entity: "BoHangMuc",
    entityId: id,
    entityLabel: truoc.ma,
    action: "DELETE",
    changes: diffFields(truoc, null, BO_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/bo-hang-muc");
  return { ok: true };
}

const phanSchema = z.object({
  ma: z.string().trim().min(1, "Mã phần không được để trống"),
  ten: z.string().trim().min(1, "Tên phần không được để trống"),
  tenKhachHang: z.string().trim().optional(),
  maKhach: z.string().trim().optional(),
  partCode: z.string().trim().optional(),
  partName: z.string().trim().optional(),
});

/** Sửa một phần — chủ yếu để bật/tắt mặt gửi khách và đặt tên in cho khách. */
export async function luuPhanBoHangMuc(
  phanId: string,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const phan = await db.boHangMucPhan.findUnique({
    where: { id: phanId },
    select: { boHangMucId: true, ma: true },
  });
  if (!phan) return { ok: false, error: "Không tìm thấy phần." };

  const parsed = phanSchema.safeParse({
    ma: String(form.get("ma") ?? ""),
    ten: String(form.get("ten") ?? ""),
    tenKhachHang: String(form.get("tenKhachHang") ?? ""),
    maKhach: String(form.get("maKhach") ?? ""),
    partCode: String(form.get("partCode") ?? ""),
    partName: String(form.get("partName") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const trung = await db.boHangMucPhan.findFirst({
    where: { boHangMucId: phan.boHangMucId, ma: d.ma, NOT: { id: phanId } },
  });
  if (trung) return { ok: false, error: `Bộ này đã có phần mã "${d.ma}".` };

  await db.boHangMucPhan.update({
    where: { id: phanId },
    data: {
      ma: d.ma,
      ten: d.ten,
      inChoKhach: form.get("inChoKhach") !== null,
      tenKhachHang: d.tenKhachHang || null,
      maKhach: d.maKhach || null,
      partCode: d.partCode || "I",
      partName: d.partName || "Phần kết cấu thép",
    },
  });

  revalidatePath("/thu-vien/bo-hang-muc");
  revalidatePath(`/thu-vien/bo-hang-muc/${phan.boHangMucId}`);
  return { ok: true };
}
