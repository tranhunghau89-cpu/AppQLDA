"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { rutSuatKhoiLuong } from "@/lib/thuVien/boHangMuc";

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

// ===== Thư viện khối lượng: rút suất từ một bản dự toán đã làm =====

export interface BanDuToanLamMau {
  id: string;
  nhan: string;
  soPhanCoDienTich: number;
  soDong: number;
}

/**
 * Các bản dự toán dùng làm mẫu được cho một bộ hạng mục.
 *
 * Chỉ liệt kê bản có ÍT NHẤT MỘT phần khai diện tích và mã phần trùng với bộ: rút
 * suất là phép chia cho diện tích, bản không khai diện tích thì không cho ra gì, và
 * bày nó lên danh sách chỉ làm người dùng bấm vào rồi thất vọng.
 */
export async function banDuToanLamMauDuoc(boHangMucId: string): Promise<BanDuToanLamMau[]> {
  await requirePermission("thuVien", "view");

  const bo = await db.boHangMuc.findUnique({
    where: { id: boHangMucId },
    select: { phan: { select: { ma: true } } },
  });
  if (!bo) return [];
  const maPhan = new Set(bo.phan.map((p) => p.ma.trim().toUpperCase()));
  if (maPhan.size === 0) return [];

  const quotes = await db.quote.findMany({
    where: { sections: { some: { area: { gt: 0 } } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      project: { select: { code: true, name: true } },
      sections: { select: { code: true, area: true } },
      _count: { select: { items: true } },
    },
  });

  return quotes
    .map((q) => ({
      id: q.id,
      nhan: q.project ? `${q.project.code} — ${q.title}` : q.title,
      soPhanCoDienTich: q.sections.filter(
        (s) => (s.area ?? 0) > 0 && maPhan.has(s.code.trim().toUpperCase())
      ).length,
      soDong: q._count.items,
    }))
    .filter((q) => q.soPhanCoDienTich > 0 && q.soDong > 0);
}

export interface KetQuaLaySuat {
  daGan: number;
  boQua: number;
  canhBao: string[];
}

/**
 * Lấy suất khối lượng từ một bản dự toán đã làm và ghi vào bộ hạng mục.
 *
 * Đây là cách dựng "thư viện khối lượng mẫu" từ số THẬT thay vì gõ tay 90 dòng: chọn
 * một công trình đã làm xong, hệ thống chia khối lượng cho diện tích từng phần rồi
 * gắn suất vào đúng dòng công tác tương ứng.
 *
 * Ghi ĐÈ suất cũ: người dùng chủ động chọn một công trình làm chuẩn, nên ý định là
 * "lấy theo cái này". Suất cũ không bị mất vĩnh viễn — chạy lại với công trình khác
 * là ra bộ số khác.
 */
export async function laySuatTuDuToan(
  boHangMucId: string,
  quoteId: string
): Promise<{ ok: true; data: KetQuaLaySuat } | { ok: false; error: string }> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const [bo, quote] = await Promise.all([
    db.boHangMuc.findUnique({
      where: { id: boHangMucId },
      select: {
        ma: true,
        ten: true,
        phan: { select: { id: true, ma: true } },
        dong: { select: { id: true, phanId: true, maCongTac: true } },
      },
    }),
    db.quote.findUnique({
      where: { id: quoteId },
      select: {
        title: true,
        sections: { select: { id: true, code: true, area: true } },
        items: { select: { sectionId: true, workCode: true, qty: true } },
      },
    }),
  ]);
  if (!bo) return { ok: false, error: "Không tìm thấy bộ hạng mục." };
  if (!quote) return { ok: false, error: "Không tìm thấy bản dự toán mẫu." };

  const maPhanCuaSection = new Map(quote.sections.map((s) => [s.id, s.code]));
  const dienTich: Record<string, number | null> = {};
  for (const s of quote.sections) dienTich[s.code] = s.area;

  const kq = rutSuatKhoiLuong(
    quote.items.map((i) => ({
      phanMa: maPhanCuaSection.get(i.sectionId) ?? "",
      maCongTac: i.workCode,
      qty: i.qty,
    })),
    dienTich
  );

  // Tra ngược về dòng của bộ theo cặp (mã phần, mã công tác) — cùng khóa mà hàm thuần
  // đã dùng để rút.
  const maPhanCuaDong = new Map(bo.phan.map((p) => [p.id, p.ma.trim().toUpperCase()]));
  const theoKhoa = new Map(
    kq.suat.map((s) => [`${s.phanMa.trim().toUpperCase()}|${s.maCongTac.trim().toUpperCase()}`, s.suat])
  );

  let daGan = 0;
  const capNhat: { id: string; suat: number }[] = [];
  for (const d of bo.dong) {
    if (!d.maCongTac || !d.phanId) continue;
    const maPhan = maPhanCuaDong.get(d.phanId);
    if (!maPhan) continue;
    const s = theoKhoa.get(`${maPhan}|${d.maCongTac.trim().toUpperCase()}`);
    if (s == null) continue;
    capNhat.push({ id: d.id, suat: s });
    daGan++;
  }

  if (capNhat.length > 0) {
    await db.$transaction(
      capNhat.map((c) =>
        db.boHangMucDong.update({ where: { id: c.id }, data: { suatKhoiLuong: c.suat } })
      )
    );
  }

  await recordAudit({
    actor: await requireSession(),
    entity: "BoHangMuc",
    entityId: boHangMucId,
    entityLabel: `${bo.ma} — ${bo.ten}`,
    action: "UPDATE",
    changes: {
      suatKhoiLuong: {
        truoc: null,
        sau: `${daGan} dòng lấy suất từ "${quote.title}"`,
      },
    },
  });

  revalidatePath("/thu-vien/bo-hang-muc");
  return {
    ok: true,
    data: { daGan, boQua: bo.dong.length - daGan, canhBao: kq.canhBao },
  };
}

/**
 * Sửa suất khối lượng của MỘT dòng công tác trong bộ.
 *
 * Ô trống = xoá suất, dòng đó quay về dùng khối lượng tuyệt đối. Suất ≤ 0 bị từ chối:
 * nó là số nhân, 0 cho ra khối lượng 0 ở mọi công trình và âm thì vô nghĩa.
 */
export async function luuSuatDong(
  dongId: string,
  suat: number | null
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }
  if (suat != null && (!Number.isFinite(suat) || suat <= 0)) {
    return { ok: false, error: "Suất khối lượng phải là số dương." };
  }
  const dong = await db.boHangMucDong.findUnique({
    where: { id: dongId },
    select: { id: true, ten: true, suatKhoiLuong: true, boHangMucId: true },
  });
  if (!dong) return { ok: false, error: "Không tìm thấy dòng công tác." };

  await db.boHangMucDong.update({ where: { id: dongId }, data: { suatKhoiLuong: suat } });
  await recordAudit({
    actor: await requireSession(),
    entity: "BoHangMuc",
    entityId: dong.boHangMucId,
    entityLabel: dong.ten,
    action: "UPDATE",
    changes: { suatKhoiLuong: { truoc: dong.suatKhoiLuong, sau: suat } },
  });
  revalidatePath("/thu-vien/bo-hang-muc");
  return { ok: true };
}

/**
 * Gắn — hoặc gỡ — mã công tác thư viện cho MỘT dòng của bộ hạng mục.
 *
 * Đây là quyết định về TIỀN, không phải dán nhãn cho đẹp: khi áp bộ vào dự toán, đơn
 * giá lấy từ THƯ VIỆN theo mã này, còn `donGiaMacDinh` của bộ tụt xuống làm số dự
 * phòng. Gắn nhầm mã là mọi dự toán sau đó sai giá vốn.
 *
 * Vì thế gỡ mã (`congTacId = null`) cũng phải làm được. Một dòng chưa phân định được
 * quy cách — "Diềm" nằm giữa khổ <200mm và <400mm — thà để trống và dùng giá mặc định
 * còn hơn gắn bừa rồi không ai biết nó bừa.
 */
export async function luuCongTacDong(
  dongId: string,
  congTacId: string | null
): Promise<ActionResult> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }

  const dong = await db.boHangMucDong.findUnique({
    where: { id: dongId },
    select: { id: true, ten: true, boHangMucId: true, congTacId: true, maCongTac: true },
  });
  if (!dong) return { ok: false, error: "Không tìm thấy dòng công tác." };

  let ma: string | null = null;
  if (congTacId) {
    const ct = await db.congTac.findUnique({ where: { id: congTacId }, select: { ma: true } });
    if (!ct) return { ok: false, error: "Không tìm thấy công tác trong thư viện." };
    ma = ct.ma;
  }

  await db.boHangMucDong.update({
    where: { id: dongId },
    // Biến thể thuộc về công tác cũ — đổi công tác mà giữ biến thể là trỏ sang một
    // dòng giá của việc khác.
    data: { congTacId, maCongTac: ma, congTacVatTuId: null },
  });
  await recordAudit({
    actor: await requireSession(),
    entity: "BoHangMuc",
    entityId: dong.boHangMucId,
    entityLabel: dong.ten,
    action: "UPDATE",
    changes: { maCongTac: { truoc: dong.maCongTac, sau: ma } },
  });
  revalidatePath("/thu-vien/bo-hang-muc");
  return { ok: true };
}
