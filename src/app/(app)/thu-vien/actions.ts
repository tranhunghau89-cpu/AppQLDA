"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { nhomChiPhiTheoNhomMa, workGroupOf, ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { computeBaseCost } from "@/lib/quote";

export type ActionResult = { ok: true } | { ok: false; error: string };

const KHONG_CO_QUYEN = "Chỉ quản trị viên được sửa thư viện đơn giá.";

const CT_AUDIT_FIELDS = [
  "ma",
  "ten",
  "tenNgan",
  "quyCach",
  "donVi",
  "nhomMa",
  "nhomChiPhi",
  "heSo",
  "ghiChu",
  "active",
] as const;
const CT_AUDIT_SELECT = Object.fromEntries(
  CT_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof CT_AUDIT_FIELDS)[number], true>;

const DG_AUDIT_FIELDS = [
  "vatTu",
  "nhanCongMay",
  "heSo",
  "donGia",
  "hieuLucTu",
  "khuVucId",
  "ghiChu",
] as const;
const DG_AUDIT_SELECT = Object.fromEntries(
  DG_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof DG_AUDIT_FIELDS)[number], true>;

const so = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const congTacSchema = z.object({
  ma: z.string().trim().min(1, "Mã công tác không được để trống"),
  ten: z.string().trim().min(1, "Tên công tác không được để trống"),
  tenNgan: z.string().trim().optional(),
  quyCach: z.string().trim().optional(),
  donVi: z.string().trim().optional(),
  nhomChiPhi: z.string().trim().optional(),
  heSo: so,
  ghiChu: z.string().trim().optional(),
});

/**
 * Lưu một công tác. KHÔNG nhận đơn giá — đơn giá là bảng riêng có lịch sử, sửa nó
 * phải đi qua `themBanGia` để lần sửa nào cũng để lại dấu vết ngày hiệu lực.
 *
 * Ngoại lệ duy nhất: lúc TẠO MỚI, ba ô VT/NC/HS nếu có điền sẽ sinh bản giá đầu
 * tiên hiệu lực từ hôm nay — để người nhập không phải tạo rồi mở lại chỉ để điền giá.
 */
export async function luuCongTac(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const parsed = congTacSchema.safeParse({
    ma: String(form.get("ma") ?? ""),
    ten: String(form.get("ten") ?? ""),
    tenNgan: String(form.get("tenNgan") ?? ""),
    quyCach: String(form.get("quyCach") ?? ""),
    donVi: String(form.get("donVi") ?? ""),
    nhomChiPhi: String(form.get("nhomChiPhi") ?? ""),
    heSo: String(form.get("heSo") ?? ""),
    ghiChu: String(form.get("ghiChu") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const nhomMa = workGroupOf(d.ma);
  const nhomChiPhi =
    d.nhomChiPhi && d.nhomChiPhi in ESTIMATE_GROUP_MAP
      ? d.nhomChiPhi
      : nhomChiPhiTheoNhomMa(nhomMa);

  const data = {
    ma: d.ma,
    ten: d.ten,
    tenNgan: d.tenNgan || null,
    quyCach: d.quyCach || null,
    donVi: d.donVi || null,
    nhomMa,
    nhomChiPhi,
    heSo: d.heSo,
    ghiChu: d.ghiChu || null,
  };

  const trung = await db.congTac.findUnique({ where: { ma: d.ma } });
  if (trung && trung.id !== id)
    return { ok: false, error: `Mã công tác "${d.ma}" đã tồn tại.` };

  const truoc = id
    ? await db.congTac.findUnique({ where: { id }, select: CT_AUDIT_SELECT })
    : null;

  let ctId = id;
  if (ctId) {
    await db.congTac.update({ where: { id: ctId }, data });
  } else {
    ctId = (await db.congTac.create({ data })).id;

    const giaVatTu = soHoacNull(form.get("giaVatTu"));
    const giaNhanCongMay = soHoacNull(form.get("giaNhanCongMay"));
    if (giaVatTu !== null || giaNhanCongMay !== null) {
      const donGia = computeBaseCost(giaVatTu, giaNhanCongMay, d.heSo);
      await db.donGiaCongTac.create({
        data: {
          congTacId: ctId,
          vatTu: giaVatTu,
          nhanCongMay: giaNhanCongMay,
          heSo: d.heSo,
          donGia,
          hieuLucTu: dauNgay(new Date()),
          nguon: "NHAP_TAY",
          ghiChu: "Bản giá đầu tiên khi tạo công tác",
          ...(await nguoiTao()),
        },
      });
    }
  }

  await recordAudit({
    actor: await requireSession(),
    entity: "CongTac",
    entityId: ctId,
    entityLabel: d.ma,
    action: id ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, CT_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien");
  return { ok: true };
}

export async function xoaCongTac(id: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }
  const truoc = await db.congTac.findUnique({ where: { id }, select: CT_AUDIT_SELECT });
  if (!truoc) return { ok: false, error: "Không tìm thấy công tác." };

  // Xóa công tác kéo theo toàn bộ lịch sử giá của nó (khóa ngoại Cascade). Các dòng
  // báo giá đã lập KHÔNG mất gì: chúng giữ mã và đơn giá đã chụp, chỉ là từ nay
  // không tra ngược về thư viện được nữa.
  await db.congTac.delete({ where: { id } });

  await recordAudit({
    actor: await requireSession(),
    entity: "CongTac",
    entityId: id,
    entityLabel: truoc.ma,
    action: "DELETE",
    changes: diffFields(truoc, null, CT_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien");
  return { ok: true };
}

const banGiaSchema = z.object({
  vatTu: so,
  nhanCongMay: so,
  heSo: so,
  donGia: so,
  hieuLucTu: z.string().trim().min(1, "Phải chọn ngày hiệu lực"),
  congTacVatTuId: z.string().trim().optional(),
  khuVucId: z.string().trim().optional(),
  ghiChu: z.string().trim().optional(),
});

/**
 * Thêm một bản giá mới cho công tác.
 *
 * Đây là cách DUY NHẤT để đổi giá: bản mới không ghi đè bản cũ mà xếp chồng lên,
 * và luật "hiệu lực <= ngày, lấy mới nhất" lo phần còn lại. Giá của những báo giá
 * đã lập không đổi theo, vì mỗi dòng ở đó đã chụp lại bản giá của riêng nó.
 */
export async function themBanGia(
  congTacId: string,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const parsed = banGiaSchema.safeParse({
    vatTu: String(form.get("vatTu") ?? ""),
    nhanCongMay: String(form.get("nhanCongMay") ?? ""),
    heSo: String(form.get("heSo") ?? ""),
    donGia: String(form.get("donGia") ?? ""),
    hieuLucTu: String(form.get("hieuLucTu") ?? ""),
    congTacVatTuId: String(form.get("congTacVatTuId") ?? ""),
    khuVucId: String(form.get("khuVucId") ?? ""),
    ghiChu: String(form.get("ghiChu") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const congTac = await db.congTac.findUnique({
    where: { id: congTacId },
    select: { ma: true },
  });
  if (!congTac) return { ok: false, error: "Không tìm thấy công tác." };

  // Biến thể phải thuộc ĐÚNG công tác này — id đến từ client, và gắn bản giá vào biến
  // thể của công tác khác sẽ tạo ra một dòng giá không bao giờ được chọn tới.
  const bienTheId = d.congTacVatTuId || null;
  if (bienTheId) {
    const bt = await db.congTacVatTu.findUnique({
      where: { id: bienTheId },
      select: { congTacId: true },
    });
    if (!bt || bt.congTacId !== congTacId)
      return { ok: false, error: "Biến thể không thuộc công tác này." };
  }

  const khuVucId = d.khuVucId || null;
  if (khuVucId) {
    const kv = await db.khuVuc.findUnique({ where: { id: khuVucId }, select: { id: true } });
    if (!kv) return { ok: false, error: "Không tìm thấy khu vực." };
  }

  const ngay = dauNgay(new Date(d.hieuLucTu));
  if (Number.isNaN(ngay.getTime()))
    return { ok: false, error: "Ngày hiệu lực không hợp lệ." };

  // Đơn giá gõ thẳng thì tôn trọng con số đó; bỏ trống thì tính từ (VT + NC) × HS.
  // Nhiều công tác chỉ có một con số trọn gói, bắt tách ba thành phần là bắt bịa số.
  const donGia = d.donGia ?? computeBaseCost(d.vatTu, d.nhanCongMay, d.heSo);
  if (!Number.isFinite(donGia) || donGia < 0)
    return { ok: false, error: "Đơn giá không hợp lệ." };

  // Kiểm ở đây NGOÀI bốn chỉ mục riêng phần trong cơ sở dữ liệu: chỉ mục là lưới an
  // toàn cuối cùng, còn chỗ này mới cho ra được câu báo lỗi người dùng đọc hiểu.
  const trung = await db.donGiaCongTac.findFirst({
    where: { congTacId, congTacVatTuId: bienTheId, khuVucId, hieuLucTu: ngay },
  });
  if (trung) {
    return {
      ok: false,
      error:
        "Đã có bản giá cho đúng tổ hợp vật liệu/khu vực này vào ngày này. Sửa bản đó hoặc chọn ngày khác.",
    };
  }

  const tao = await db.donGiaCongTac.create({
    data: {
      congTacId,
      congTacVatTuId: bienTheId,
      khuVucId,
      vatTu: d.vatTu,
      nhanCongMay: d.nhanCongMay,
      heSo: d.heSo,
      donGia,
      hieuLucTu: ngay,
      nguon: "NHAP_TAY",
      ghiChu: d.ghiChu || null,
      ...(await nguoiTao()),
    },
  });

  await recordAudit({
    actor: await requireSession(),
    entity: "DonGiaCongTac",
    entityId: tao.id,
    entityLabel: congTac.ma,
    action: "CREATE",
    changes: diffFields(null, { ...tao }, DG_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien");
  revalidatePath(`/thu-vien/cong-tac/${congTacId}`);
  return { ok: true };
}

export async function xoaBanGia(donGiaId: string): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }
  const truoc = await db.donGiaCongTac.findUnique({
    where: { id: donGiaId },
    select: { ...DG_AUDIT_SELECT, congTacId: true, congTac: { select: { ma: true } } },
  });
  if (!truoc) return { ok: false, error: "Không tìm thấy bản giá." };

  await db.donGiaCongTac.delete({ where: { id: donGiaId } });

  await recordAudit({
    actor: await requireSession(),
    entity: "DonGiaCongTac",
    entityId: donGiaId,
    entityLabel: truoc.congTac.ma,
    action: "DELETE",
    changes: diffFields(truoc, null, DG_AUDIT_FIELDS),
  });

  revalidatePath("/thu-vien");
  revalidatePath(`/thu-vien/cong-tac/${truoc.congTacId}`);
  return { ok: true };
}

// ----- phụ trợ -----

function soHoacNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cắt về 00:00 giờ địa phương. Đơn giá có hiệu lực theo NGÀY, không theo giờ; lưu
 * kèm giờ tạo ra hai bản giá "cùng ngày" mà máy lại thấy khác nhau, và chỉ mục
 * chống trùng theo ngày sẽ không bắt được.
 */
function dauNgay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function nguoiTao() {
  const s = await requireSession();
  return { createdById: s.userId, createdByName: s.name };
}
