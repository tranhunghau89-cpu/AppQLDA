"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import {
  ESTIMATE_GROUP_MAP,
  QUOTE_SPEC_GROUP_MAP,
  VAT_TU_TAG_MAP,
} from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

const KHONG_CO_QUYEN = "Chỉ quản trị viên được sửa thư viện đơn giá.";

const VT_AUDIT_FIELDS = [
  "ma",
  "ten",
  "quyCach",
  "hang",
  "xuatXu",
  "donVi",
  "nhomTSKT",
  "tag",
  "inTrongMoTa",
  "nhomChiPhi",
  "ghiChu",
  "active",
] as const;
const VT_AUDIT_SELECT = Object.fromEntries(
  VT_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof VT_AUDIT_FIELDS)[number], true>;

const GM_AUDIT_FIELDS = [
  "supplierId",
  "khuVucId",
  "donGia",
  "donVi",
  "hieuLucTu",
  "ghiChu",
] as const;
const GM_AUDIT_SELECT = Object.fromEntries(
  GM_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof GM_AUDIT_FIELDS)[number], true>;

const so = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const vatTuSchema = z.object({
  ma: z.string().trim().min(1, "Mã vật tư không được để trống"),
  ten: z.string().trim().min(1, "Tên vật tư không được để trống"),
  quyCach: z.string().trim().optional(),
  hang: z.string().trim().optional(),
  xuatXu: z.string().trim().optional(),
  donVi: z.string().trim().optional(),
  nhomTSKT: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  nhomChiPhi: z.string().trim().optional(),
  ghiChu: z.string().trim().optional(),
});

export async function luuVatTu(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const parsed = vatTuSchema.safeParse({
    ma: String(form.get("ma") ?? ""),
    ten: String(form.get("ten") ?? ""),
    quyCach: String(form.get("quyCach") ?? ""),
    hang: String(form.get("hang") ?? ""),
    xuatXu: String(form.get("xuatXu") ?? ""),
    donVi: String(form.get("donVi") ?? ""),
    nhomTSKT: String(form.get("nhomTSKT") ?? ""),
    tag: String(form.get("tag") ?? ""),
    nhomChiPhi: String(form.get("nhomChiPhi") ?? ""),
    ghiChu: String(form.get("ghiChu") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ma = d.ma.toUpperCase();

  const trung = await db.vatTu.findUnique({ where: { ma } });
  if (trung && trung.id !== id)
    return { ok: false, error: `Mã vật tư "${ma}" đã tồn tại.` };

  const data = {
    ma,
    ten: d.ten,
    quyCach: d.quyCach || null,
    hang: d.hang || null,
    xuatXu: d.xuatXu || null,
    donVi: d.donVi || null,
    // Giá trị lạ về mặc định thay vì báo lỗi: danh sách chọn trên giao diện đã giới
    // hạn rồi, cái lọt tới đây chỉ có thể là dữ liệu cũ hoặc gọi thẳng.
    nhomTSKT: d.nhomTSKT && d.nhomTSKT in QUOTE_SPEC_GROUP_MAP ? d.nhomTSKT : "A",
    tag: d.tag && d.tag in VAT_TU_TAG_MAP ? d.tag : null,
    nhomChiPhi:
      d.nhomChiPhi && d.nhomChiPhi in ESTIMATE_GROUP_MAP ? d.nhomChiPhi : "KHAC",
    inTrongMoTa: form.get("inTrongMoTa") === "on",
    ghiChu: d.ghiChu || null,
  };

  const truoc = id
    ? await db.vatTu.findUnique({ where: { id }, select: VT_AUDIT_SELECT })
    : null;

  let vtId = id;
  if (vtId) await db.vatTu.update({ where: { id: vtId }, data });
  else vtId = (await db.vatTu.create({ data })).id;

  await recordAudit({
    actor: await requireSession(),
    entity: "VatTu",
    entityId: vtId,
    entityLabel: ma,
    action: id ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, VT_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/vat-tu");
  return { ok: true };
}

export async function xoaVatTu(id: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const truoc = await db.vatTu.findUnique({
    where: { id },
    select: { ...VT_AUDIT_SELECT, _count: { select: { congTacLinks: true } } },
  });
  if (!truoc) return { ok: false, error: "Không tìm thấy vật tư." };

  // Xóa vật tư đang là biến thể của công tác sẽ kéo theo biến thể đó và các bản đơn
  // giá riêng của nó (Cascade hai tầng) — tức là mất tiền đã khai. Bắt gỡ trước.
  if (truoc._count.congTacLinks > 0) {
    return {
      ok: false,
      error: `Vật tư này đang là biến thể của ${truoc._count.congTacLinks} công tác. Gỡ khỏi các công tác đó trước.`,
    };
  }

  await db.vatTu.delete({ where: { id } });
  await recordAudit({
    actor: await requireSession(),
    entity: "VatTu",
    entityId: id,
    entityLabel: truoc.ma,
    action: "DELETE",
    changes: diffFields(truoc, null, VT_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/vat-tu");
  return { ok: true };
}

const giaMuaSchema = z.object({
  supplierId: z.string().trim().min(1, "Phải chọn nhà cung cấp"),
  khuVucId: z.string().trim().optional(),
  donGia: so,
  donVi: z.string().trim().optional(),
  hieuLucTu: z.string().trim().min(1, "Phải chọn ngày hiệu lực"),
  ghiChu: z.string().trim().optional(),
});

export async function luuGiaMuaVatTu(
  vatTuId: string,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const parsed = giaMuaSchema.safeParse({
    supplierId: String(form.get("supplierId") ?? ""),
    khuVucId: String(form.get("khuVucId") ?? ""),
    donGia: String(form.get("donGia") ?? ""),
    donVi: String(form.get("donVi") ?? ""),
    hieuLucTu: String(form.get("hieuLucTu") ?? ""),
    ghiChu: String(form.get("ghiChu") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.donGia === null || !Number.isFinite(d.donGia) || d.donGia < 0)
    return { ok: false, error: "Đơn giá không hợp lệ." };

  const vatTu = await db.vatTu.findUnique({
    where: { id: vatTuId },
    select: { ma: true },
  });
  if (!vatTu) return { ok: false, error: "Không tìm thấy vật tư." };

  const ngay = dauNgay(new Date(d.hieuLucTu));
  if (Number.isNaN(ngay.getTime()))
    return { ok: false, error: "Ngày hiệu lực không hợp lệ." };

  const s = await requireSession();
  const tao = await db.giaMuaVatTu.create({
    data: {
      vatTuId,
      supplierId: d.supplierId,
      khuVucId: d.khuVucId || null,
      donGia: d.donGia,
      donVi: d.donVi || null,
      hieuLucTu: ngay,
      nguon: "NHAP_TAY",
      ghiChu: d.ghiChu || null,
      createdById: s.userId,
      createdByName: s.name,
    },
  });

  await recordAudit({
    actor: s,
    entity: "GiaMuaVatTu",
    entityId: tao.id,
    entityLabel: vatTu.ma,
    action: "CREATE",
    changes: diffFields(null, { ...tao }, GM_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/vat-tu");
  return { ok: true };
}

export async function xoaGiaMuaVatTu(id: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }
  const truoc = await db.giaMuaVatTu.findUnique({
    where: { id },
    select: { ...GM_AUDIT_SELECT, vatTu: { select: { ma: true } } },
  });
  if (!truoc) return { ok: false, error: "Không tìm thấy dòng giá mua." };

  await db.giaMuaVatTu.delete({ where: { id } });
  await recordAudit({
    actor: await requireSession(),
    entity: "GiaMuaVatTu",
    entityId: id,
    entityLabel: truoc.vatTu.ma,
    action: "DELETE",
    changes: diffFields(truoc, null, GM_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien/vat-tu");
  return { ok: true };
}

/**
 * Cắt về 00:00 giờ địa phương — giá có hiệu lực theo NGÀY, không theo giờ.
 * (Bản sao có chủ đích của hàm cùng tên bên đơn giá công tác: hai tệp action không
 * nhập lẫn nhau, và một tệp tiện ích chung cho ba dòng code là thừa.)
 */
function dauNgay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
