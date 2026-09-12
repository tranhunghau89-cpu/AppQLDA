"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject } from "@/lib/auth";
import { ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { computeTemplateLines, type TemplateLine } from "@/lib/estimateTemplate";
import {
  doXuongDuToan,
  type DongNguon,
  type PhanNguon,
} from "@/lib/thuVien/doXuong";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface ApplyLineValue {
  lineId: string;
  qty: number | null;
  unitPrice: number | null;
}
export interface ApplyTemplatePayload {
  templateId: string;
  sectionName: string;
  lines: ApplyLineValue[];
}

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const schema = z.object({
  groupCode: z.string().refine((v) => v in ESTIMATE_GROUP_MAP, "Nhóm không hợp lệ"),
  name: z.string().trim().min(1, "Tên hạng mục không được để trống"),
  unit: z.string().trim().optional(),
  designQty: num,
  actualQty: num,
  unitPrice: num,
  amount: num,
  supplierId: z.string().trim().optional(),
  orderStatus: z.string().trim().optional(),
  dispatchStatus: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function parse(form: FormData) {
  return schema.safeParse({
    groupCode: String(form.get("groupCode") ?? ""),
    name: String(form.get("name") ?? ""),
    unit: String(form.get("unit") ?? ""),
    designQty: String(form.get("designQty") ?? ""),
    actualQty: String(form.get("actualQty") ?? ""),
    unitPrice: String(form.get("unitPrice") ?? ""),
    amount: String(form.get("amount") ?? ""),
    supplierId: String(form.get("supplierId") ?? ""),
    orderStatus: String(form.get("orderStatus") ?? ""),
    dispatchStatus: String(form.get("dispatchStatus") ?? ""),
    note: String(form.get("note") ?? ""),
  });
}


/**
 * Chặn khi thiếu quyền / ngoài phạm vi; đối chiếu dòng dự toán có thuộc dự án không.
 *
 * Trả HẸP hơn ActionResult: guard chỉ bao giờ trả nhánh lỗi hoặc null, nên khai đúng
 * như vậy để chỗ gọi `return denied` không phải ép kiểu.
 */
async function guard(
  projectId: string,
  fallback: string,
  itemId?: string | null
): Promise<{ ok: false; error: string } | null> {
  const denied = await denyProject("estimate", "edit", projectId, fallback);
  if (denied) return denied;
  if (itemId) {
    const it = await db.estimateItem.findUnique({
      where: { id: itemId },
      select: { projectId: true },
    });
    if (!it || it.projectId !== projectId) {
      return { ok: false, error: "Dòng dự toán không thuộc dự án này." };
    }
  }
  return null;
}

export async function saveEstimateItem(
  projectId: string,
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa dự toán.", id);
  if (denied) return denied;

  const parsed = parse(form);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    groupCode: d.groupCode,
    name: d.name,
    unit: d.unit || null,
    designQty: d.designQty,
    actualQty: d.actualQty,
    unitPrice: d.unitPrice,
    amount: d.amount,
    supplierId: d.supplierId || null,
    orderStatus: d.orderStatus || null,
    dispatchStatus: d.dispatchStatus || null,
    note: d.note || null,
  };

  if (id) await db.estimateItem.update({ where: { id }, data });
  else await db.estimateItem.create({ data: { projectId, ...data } });

  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true };
}

export async function deleteEstimateItem(
  projectId: string,
  id: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa dòng dự toán.", id);
  if (denied) return denied;
  await db.estimateItem.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath("/estimates");
  return { ok: true };
}

// ===== Áp mẫu hạng mục (tạo Section + nhiều Item, tự tính) =====
export async function applyEstimateTemplate(
  projectId: string,
  payload: ApplyTemplatePayload
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa dự toán.");
  if (denied) return denied;

  // "Mẫu hạng mục" giờ là một PHẦN của bộ hạng mục. Engine computeTemplateLines
  // giữ nguyên — chỉ đổi tên trường khi nạp vào.
  const template = await db.boHangMucPhan.findUnique({
    where: { id: payload.templateId },
    include: { dong: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return { ok: false, error: "Không tìm thấy hạng mục trong thư viện." };

  const lines: TemplateLine[] = template.dong.map((l) => ({
    id: l.id,
    groupLabel: l.groupLabel ?? "",
    name: l.ten,
    unit: l.donVi,
    defaultUnitPrice: l.donGiaMacDinh,
    role: l.vaiTro,
    feedsParam: l.napThamSo,
    takesFromParam: l.layTuThamSo,
    factor: l.heSoQuyDoi,
    defaultQty: l.khoiLuongMacDinh,
    groupCode: l.nhomChiPhi,
    note: l.ghiChu,
    sortOrder: l.sortOrder,
  }));

  const values: Record<string, { qty: number | null; unitPrice: number | null }> = {};
  for (const v of payload.lines) values[v.lineId] = { qty: v.qty, unitPrice: v.unitPrice };

  const computed = computeTemplateLines(lines, values).filter(
    (c) => c.qty != null && c.qty !== 0
  );
  if (computed.length === 0)
    return { ok: false, error: "Chưa nhập số lượng nào — không có dòng để tạo." };

  const sectionName = payload.sectionName.trim() || template.ten;
  const count = await db.estimateSection.count({ where: { projectId } });

  await db.estimateSection.create({
    data: {
      projectId,
      name: sectionName,
      code: template.ma,
      templateId: template.id,
      sortOrder: count,
      items: {
        create: computed.map((c, idx) => ({
          projectId,
          groupLabel: c.groupLabel,
          groupCode: c.groupCode,
          name: c.name,
          unit: c.unit,
          designQty: c.qty,
          unitPrice: c.unitPrice,
          amount: c.amount,
          note: c.note,
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true };
}

export async function deleteEstimateSection(
  projectId: string,
  sectionId: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa hạng mục.");
  if (denied) return denied;
  const section = await db.estimateSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });
  if (!section || section.projectId !== projectId)
    return { ok: false, error: "Không tìm thấy hạng mục." };

  await db.estimateSection.delete({ where: { id: sectionId } });
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true };
}

// ===== Đổ dự toán chào giá xuống dự toán thi công =====
//
// Báo giá chia theo ĐẦU VIỆC (phần khung, phần mái, phần vách); mua hàng chia theo
// THỨ PHẢI MUA (thép, tôn, bulong, nhân công). `CongTac.nhomChiPhi` là cây cầu giữa
// hai cách chia đó — nó có mặt trong thư viện từ ngày đầu chính vì chỗ này.

export interface HangMucXemTruoc {
  ma: string | null;
  ten: string;
  soDong: number;
  thanhTien: number;
}

export interface XemTruocDoXuong {
  quoteTitle: string;
  khuVucTen: string | null;
  hangMuc: HangMucXemTruoc[];
  soDong: number;
  soDongThieuKhoiLuong: number;
  tongTien: number;
  canhBao: string[];
  /** Số dòng dự toán thi công dự án ĐANG có — đổ xuống là THÊM, không thay thế. */
  soDongDaCo: number;
}

/**
 * Nạp một bản dự toán chào giá và tra sẵn công tác cho từng dòng.
 *
 * Tra công tác qua `congTacId` trước, không có thì lùi về `workCode`. Bước lùi này
 * không phải đề phòng suông: toàn bộ 72 dòng đang có trên bản thật đều chỉ có
 * `workCode` — chúng được lập trước khi thư viện ra đời. Bỏ nhánh đó đi thì mọi dòng
 * cũ rơi hết vào nhóm "Khác".
 */
async function napNguonDoXuong(projectId: string, quoteId: string) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      khuVuc: { select: { id: true, ten: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote)
    return { ok: false as const, error: "Không tìm thấy bản dự toán chào giá." };
  if (quote.projectId !== projectId)
    return { ok: false as const, error: "Bản dự toán này không thuộc dự án." };

  const maCanTra = [
    ...new Set(quote.items.map((i) => i.workCode).filter((m): m is string => !!m)),
  ];
  const idCanTra = [
    ...new Set(quote.items.map((i) => i.congTacId).filter((m): m is string => !!m)),
  ];
  const congTacs =
    maCanTra.length || idCanTra.length
      ? await db.congTac.findMany({
          where: { OR: [{ ma: { in: maCanTra } }, { id: { in: idCanTra } }] },
          select: { id: true, ma: true, nhomChiPhi: true },
        })
      : [];
  const theoId = new Map(congTacs.map((c) => [c.id, c]));
  const theoMa = new Map(congTacs.map((c) => [c.ma, c]));

  const phanNguon: PhanNguon[] = quote.sections.map((s) => ({
    id: s.id,
    ma: s.code,
    ten: s.name,
    loai: s.kind,
    parentId: s.parentId,
    sortOrder: s.sortOrder,
  }));

  const dongNguon: DongNguon[] = quote.items.map((i) => {
    const ct = (i.congTacId && theoId.get(i.congTacId)) || (i.workCode && theoMa.get(i.workCode)) || null;
    return {
      id: i.id,
      sectionId: i.sectionId,
      ten: i.name,
      donVi: i.unit,
      khoiLuong: i.qty,
      // Giá VỐN, không phải giá bán: dự toán thi công theo dõi chi phí bỏ ra.
      giaVon: i.baseCost,
      ghiChu: i.note,
      sortOrder: i.sortOrder,
      congTacId: ct?.id ?? null,
      donGiaId: i.donGiaId,
      giaSuaTay: i.giaSuaTay,
      nhomChiPhi: ct?.nhomChiPhi ?? null,
    };
  });

  return { ok: true as const, quote, phanNguon, dongNguon };
}

export async function xemTruocDoXuong(
  projectId: string,
  quoteId: string
): Promise<{ ok: true; data: XemTruocDoXuong } | { ok: false; error: string }> {
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa dự toán.");
  if (denied) return denied;

  const nguon = await napNguonDoXuong(projectId, quoteId);
  if (!nguon.ok) return { ok: false, error: nguon.error };

  const kq = doXuongDuToan(nguon.phanNguon, nguon.dongNguon);
  const soDongDaCo = await db.estimateItem.count({ where: { projectId } });

  const theoHangMuc = new Map<string, { soDong: number; thanhTien: number }>();
  for (const d of kq.dong) {
    const acc = theoHangMuc.get(d.hangMucKhoa) ?? { soDong: 0, thanhTien: 0 };
    acc.soDong += 1;
    acc.thanhTien += d.thanhTien ?? 0;
    theoHangMuc.set(d.hangMucKhoa, acc);
  }

  return {
    ok: true,
    data: {
      quoteTitle: nguon.quote.title,
      khuVucTen: nguon.quote.khuVuc?.ten ?? null,
      hangMuc: kq.hangMuc.map((h) => ({
        ma: h.ma,
        ten: h.ten,
        soDong: theoHangMuc.get(h.khoa)?.soDong ?? 0,
        thanhTien: theoHangMuc.get(h.khoa)?.thanhTien ?? 0,
      })),
      soDong: kq.dong.length,
      soDongThieuKhoiLuong: kq.dong.filter((d) => d.khoiLuong == null).length,
      tongTien: kq.dong.reduce((t, d) => t + (d.thanhTien ?? 0), 0),
      canhBao: kq.canhBao,
      soDongDaCo,
    },
  };
}

/**
 * Dựng hạng mục và dòng dự toán thi công từ một bản dự toán chào giá.
 *
 * CHỈ CHÈN THÊM, không xoá và không sửa dòng nào đang có. Dự toán thi công là nơi
 * mua hàng và kế toán đang ghi trạng thái đặt hàng, xuất hàng, khối lượng thực — một
 * thao tác "đồng bộ" thông minh sẽ xoá mất chính những thứ đó. Người dùng thấy trước
 * số dòng sẽ thêm và số dòng đang có, rồi tự quyết.
 */
export async function doXuongDuToanThiCong(
  projectId: string,
  quoteId: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa dự toán.");
  if (denied) return denied;

  const nguon = await napNguonDoXuong(projectId, quoteId);
  if (!nguon.ok) return { ok: false, error: nguon.error };

  const kq = doXuongDuToan(nguon.phanNguon, nguon.dongNguon);
  if (kq.dong.length === 0)
    return { ok: false, error: "Bản dự toán chào giá không có dòng nào để đổ xuống." };

  // Vùng đang tính giá: bản dự toán tự khai trước, không thì lấy của dự án.
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { khuVucId: true },
  });
  const khuVucId = nguon.quote.khuVucId ?? project?.khuVucId ?? null;

  const daCo = await db.estimateSection.count({ where: { projectId } });
  const dongTheoHangMuc = new Map<string, typeof kq.dong>();
  for (const d of kq.dong) {
    const ds = dongTheoHangMuc.get(d.hangMucKhoa) ?? [];
    ds.push(d);
    dongTheoHangMuc.set(d.hangMucKhoa, ds);
  }

  // Một giao dịch cho cả lô: nửa bản dự toán thi công còn tệ hơn không có bản nào —
  // người dùng sẽ tưởng đã đổ xong và bấm lần nữa.
  await db.$transaction(
    kq.hangMuc.map((h) =>
      db.estimateSection.create({
        data: {
          projectId,
          name: h.ten,
          code: h.ma,
          sortOrder: daCo + h.sortOrder,
          items: {
            create: (dongTheoHangMuc.get(h.khoa) ?? []).map((d) => ({
              projectId,
              groupLabel: d.groupLabel,
              groupCode: d.groupCode,
              name: d.ten,
              unit: d.donVi,
              designQty: d.khoiLuong,
              unitPrice: d.donGia,
              amount: d.thanhTien,
              note: d.ghiChu,
              sortOrder: d.sortOrder,
              congTacId: d.congTacId,
              donGiaId: d.donGiaId,
              khuVucId,
            })),
          },
        },
      })
    )
  );

  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true };
}
