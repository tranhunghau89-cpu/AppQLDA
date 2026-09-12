"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requirePermission, requireSession } from "@/lib/auth";
import { denyCoHoi } from "@/lib/coHoiAccess";
import { duLieuChu, duongDanChu, laCungChu, type ChuBaoGia } from "@/lib/quoteOwner";
import { diffFields, recordAudit } from "@/lib/audit";
import {
  computeClientQuoteTotals,
  expiryFrom,
  validatePaymentPercents,
} from "@/lib/clientQuote";
import { CLIENT_QUOTE_STATUS_MAP } from "@/lib/constants";
import { sectionSubtotals } from "@/lib/quote";
import { doanNhan } from "@/lib/clientQuoteSpecs";
import { deriveLines, repriceLines, type DeriveSpec } from "@/lib/clientQuoteDerive";
import { apDungMau } from "@/lib/quoteTemplate";
import { bangConCuaMau, napMau, taoMoiKemMacDinh } from "./taoBaoGia";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CQ_AUDIT_FIELDS = [
  "title",
  "quoteNo",
  "status",
  "customerId",
  "recipient",
  "customerPhone",
  "location",
  "scope",
  "quoteDate",
  "sentDate",
  "validDays",
  "expiryDate",
  "vatPercent",
  "warrantyMonths",
  "maintenanceMonths",
  "loadRoof",
  "loadHanging",
  "loadFloor",
  "salesName",
  "salesPhone",
  "salesEmail",
  "note",
] as const;
const CQ_AUDIT_SELECT = Object.fromEntries(
  CQ_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof CQ_AUDIT_FIELDS)[number], true>;

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const int = num.refine(
  (v) => v === null || Number.isInteger(v),
  "Phải là số nguyên"
);

function paths(chu: ChuBaoGia) {
  revalidatePath(duongDanChu(chu).replace("/quote", "/client-quote"));
  revalidatePath("/client-quotes");
  if (chu.loai === "DU_AN") revalidatePath(`/projects/${chu.id}`);
  else revalidatePath("/khach-hang");
}

/** Chỉ dự án mới có id dự án để ghi vào nhật ký; báo giá ở cơ hội thì chưa có. */
const duAnCuaChu = (chu: ChuBaoGia) => (chu.loai === "DU_AN" ? chu.id : null);

/**
 * Bên nhận và diện tích, lấy theo chủ sở hữu.
 *
 * Ở dự án thì lấy từ chủ đầu tư đã ký; ở cơ hội thì lấy từ khách đang chào. Hai nguồn
 * khác nhau nhưng cùng đổ vào các cột `recipient`/`customerPhone` — chúng là bản CHỤP
 * lúc lập, nên bản in không đổi khi bên kia đổi tên.
 */
async function boiCanhChu(chu: ChuBaoGia): Promise<{
  area: number | null;
  location: string | null;
  customerId: string | null;
  tenNhan: string | null;
  dienThoai: string | null;
}> {
  if (chu.loai === "DU_AN") {
    const p = await db.project.findUnique({
      where: { id: chu.id },
      select: {
        area: true,
        location: true,
        customerId: true,
        customer: { select: { name: true, phone: true } },
      },
    });
    return {
      area: p?.area ?? null,
      location: p?.location ?? null,
      customerId: p?.customerId ?? null,
      tenNhan: p?.customer?.name ?? null,
      dienThoai: p?.customer?.phone ?? null,
    };
  }
  const c = await db.coHoi.findUnique({
    where: { id: chu.id },
    select: {
      area: true,
      diaDiem: true,
      khachHang: {
        select: { tenCty: true, phone: true, customerId: true },
      },
    },
  });
  return {
    area: c?.area ?? null,
    location: c?.diaDiem ?? null,
    // Chỉ có giá trị khi khách đã được nối với một chủ đầu tư có sẵn; lúc chào giá
    // thường là null, và như vậy là đúng.
    customerId: c?.khachHang.customerId ?? null,
    tenNhan: c?.khachHang.tenCty ?? null,
    dienThoai: c?.khachHang.phone ?? null,
  };
}

const s = (form: FormData, key: string) => String(form.get(key) ?? "");

/**
 * Chặn khi thiếu quyền / ngoài phạm vi, rồi truy MỌI id con ngược về báo giá và đối
 * chiếu báo giá đó có đúng chủ không.
 *
 * Hai nhánh phạm vi vì báo giá sống được ở hai nơi: dự án chặn theo phân công
 * (ProjectMember), cơ hội chặn theo người phụ trách khách.
 *
 * Mọi id ở đây đều đến từ trình duyệt. Bỏ bước truy ngược này là mở đường ghi chéo:
 * chỉ cần sửa một id trong request là sửa được báo giá của chỗ mình không có quyền.
 */
async function guard(
  chu: ChuBaoGia,
  opts: {
    clientQuoteId?: string | null;
    lineId?: string | null;
    specId?: string | null;
    stageId?: string | null;
    paymentId?: string | null;
  } = {}
): Promise<ActionResult | null> {
  const khongDuQuyen = "Bạn không có quyền chỉnh sửa báo giá.";
  const denied =
    chu.loai === "DU_AN"
      ? await denyProject("quote", "edit", chu.id, khongDuQuyen)
      : await denyCoHoi("quote", "edit", chu.id, khongDuQuyen);
  if (denied) return denied;

  const quoteIds = new Set<string>();
  if (opts.clientQuoteId) quoteIds.add(opts.clientQuoteId);

  const con: [string | null | undefined, () => Promise<{ quoteId: string } | null>, string][] = [
    [opts.lineId, () => db.clientQuoteLine.findUnique({ where: { id: opts.lineId! }, select: { quoteId: true } }), "dòng hạng mục"],
    [opts.specId, () => db.clientQuoteSpec.findUnique({ where: { id: opts.specId! }, select: { quoteId: true } }), "dòng vật liệu"],
    [opts.stageId, () => db.clientQuoteStage.findUnique({ where: { id: opts.stageId! }, select: { quoteId: true } }), "chặng thi công"],
    [opts.paymentId, () => db.clientQuotePayment.findUnique({ where: { id: opts.paymentId! }, select: { quoteId: true } }), "đợt thanh toán"],
  ];
  for (const [id, tim, ten] of con) {
    if (!id) continue;
    const row = await tim();
    if (!row) return { ok: false, error: `Không tìm thấy ${ten}.` };
    quoteIds.add(row.quoteId);
  }

  for (const qid of quoteIds) {
    const q = await db.clientQuote.findUnique({
      where: { id: qid },
      select: { projectId: true, coHoiId: true },
    });
    if (!q || !laCungChu(chu, q)) {
      return { ok: false, error: "Báo giá không thuộc mục này." };
    }
  }
  return null;
}

// ---------- Báo giá (header) ----------

const quoteSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống"),
  quoteNo: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  recipient: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  location: z.string().trim().optional(),
  scope: z.string().trim().optional(),
  quoteDate: z.string().trim().optional(),
  salesName: z.string().trim().optional(),
  salesPhone: z.string().trim().optional(),
  salesEmail: z.string().trim().optional(),
  validDays: int,
  vatPercent: num,
  warrantyMonths: int,
  maintenanceMonths: int,
  loadRoof: num,
  loadHanging: num,
  loadFloor: num,
  lineDetail: z.string().optional(),
  greeting: z.string().optional(),
  closing: z.string().optional(),
  colorNote: z.string().optional(),
  volumeNote: z.string().optional(),
  excludeNote: z.string().optional(),
  note: z.string().optional(),
});

function quoteFields(form: FormData) {
  return {
    title: s(form, "title"),
    quoteNo: s(form, "quoteNo"),
    customerId: s(form, "customerId"),
    recipient: s(form, "recipient"),
    customerPhone: s(form, "customerPhone"),
    location: s(form, "location"),
    scope: s(form, "scope"),
    quoteDate: s(form, "quoteDate"),
    salesName: s(form, "salesName"),
    salesPhone: s(form, "salesPhone"),
    salesEmail: s(form, "salesEmail"),
    validDays: s(form, "validDays"),
    vatPercent: s(form, "vatPercent"),
    warrantyMonths: s(form, "warrantyMonths"),
    maintenanceMonths: s(form, "maintenanceMonths"),
    loadRoof: s(form, "loadRoof"),
    loadHanging: s(form, "loadHanging"),
    loadFloor: s(form, "loadFloor"),
    lineDetail: s(form, "lineDetail"),
    greeting: s(form, "greeting"),
    closing: s(form, "closing"),
    colorNote: s(form, "colorNote"),
    volumeNote: s(form, "volumeNote"),
    excludeNote: s(form, "excludeNote"),
    note: s(form, "note"),
  };
}

export async function saveClientQuote(
  chu: ChuBaoGia,
  clientQuoteId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId });
  if (g) return g;

  const parsed = quoteSchema.safeParse(quoteFields(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    title: d.title,
    quoteNo: d.quoteNo || null,
    customerId: d.customerId || null,
    recipient: d.recipient || null,
    customerPhone: d.customerPhone || null,
    location: d.location || null,
    scope: d.scope || null,
    quoteDate: d.quoteDate ? new Date(d.quoteDate) : null,
    salesName: d.salesName || null,
    salesPhone: d.salesPhone || null,
    salesEmail: d.salesEmail || null,
    validDays: d.validDays,
    vatPercent: d.vatPercent,
    warrantyMonths: d.warrantyMonths,
    maintenanceMonths: d.maintenanceMonths,
    loadRoof: d.loadRoof,
    loadHanging: d.loadHanging,
    loadFloor: d.loadFloor,
    lineDetail: d.lineDetail || null,
    greeting: d.greeting || null,
    closing: d.closing || null,
    colorNote: d.colorNote || null,
    volumeNote: d.volumeNote || null,
    excludeNote: d.excludeNote || null,
    note: d.note || null,
  };

  const truoc = clientQuoteId
    ? await db.clientQuote.findUnique({
        where: { id: clientQuoteId },
        select: CQ_AUDIT_SELECT,
      })
    : null;

  let id = clientQuoteId;
  if (id) {
    await db.clientQuote.update({ where: { id }, data });
  } else {
    // Mẫu chỉ có nghĩa lúc TẠO. Sửa báo giá cũ mà đổi mẫu thì phải ghi đè cả bảng
    // vật liệu và điều khoản người dùng đã chỉnh tay — không làm.
    id = await taoMoiKemMacDinh(chu, data, s(form, "templateId") || null);
  }

  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: id,
    entityLabel: d.quoteNo ? `${d.quoteNo} — ${d.title}` : d.title,
    projectId: duAnCuaChu(chu),
    action: clientQuoteId ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, CQ_AUDIT_FIELDS),
  });

  paths(chu);
  return { ok: true };
}

const thongTinInSchema = z.object({
  recipient: z.string(),
  customerPhone: z.string(),
  location: z.string(),
  scope: z.string(),
  quoteDate: z.string(),
  salesName: z.string(),
  salesPhone: z.string(),
  salesEmail: z.string(),
  validDays: int,
});

const O_THONG_TIN_IN = [
  "recipient",
  "customerPhone",
  "location",
  "scope",
  "quoteDate",
  "salesName",
  "salesPhone",
  "salesEmail",
  "validDays",
] as const;

/**
 * Lưu chín ô thông tin in ra, sửa thẳng trên dải ở đầu bản báo giá.
 *
 * Cố ý KHÔNG gọi lại `saveClientQuote`: hàm đó ghi đè MỌI cột của bản ghi, nên gửi lên
 * vỏn vẹn chín ô là xóa sạch VAT, bảo hành, tải trọng và các đoạn chữ. Hàm này chỉ
 * chạm đúng chín cột nó nhận.
 */
export async function luuThongTinIn(
  chu: ChuBaoGia,
  clientQuoteId: string,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId });
  if (g) return g;

  const parsed = thongTinInSchema.safeParse(
    Object.fromEntries(O_THONG_TIN_IN.map((k) => [k, s(form, k)]))
  );
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    recipient: d.recipient.trim() || null,
    customerPhone: d.customerPhone.trim() || null,
    location: d.location.trim() || null,
    scope: d.scope.trim() || null,
    quoteDate: d.quoteDate ? new Date(d.quoteDate) : null,
    salesName: d.salesName.trim() || null,
    salesPhone: d.salesPhone.trim() || null,
    salesEmail: d.salesEmail.trim() || null,
    validDays: d.validDays,
  };

  const truoc = await db.clientQuote.findUnique({
    where: { id: clientQuoteId },
    select: CQ_AUDIT_SELECT,
  });
  await db.clientQuote.update({ where: { id: clientQuoteId }, data });

  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: clientQuoteId,
    entityLabel: truoc?.quoteNo ? `${truoc.quoteNo} — ${truoc.title}` : (truoc?.title ?? ""),
    projectId: duAnCuaChu(chu),
    action: "UPDATE",
    changes: diffFields(truoc, data, CQ_AUDIT_FIELDS),
  });

  paths(chu);
  return { ok: true };
}

export async function deleteClientQuote(
  chu: ChuBaoGia,
  clientQuoteId: string
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId });
  if (g) return g;
  const truoc = await db.clientQuote.findUnique({
    where: { id: clientQuoteId },
    select: CQ_AUDIT_SELECT,
  });
  await db.clientQuote.delete({ where: { id: clientQuoteId } });
  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: clientQuoteId,
    entityLabel: truoc?.title ?? null,
    projectId: duAnCuaChu(chu),
    action: "DELETE",
    changes: diffFields(truoc, null, CQ_AUDIT_FIELDS),
  });
  paths(chu);
  return { ok: true };
}

// ---------- Dòng hạng mục ----------

const lineSchema = z.object({
  partCode: z.string().trim().optional(),
  partName: z.string().trim().optional(),
  code: z.string().trim().optional(),
  name: z.string().trim().min(1, "Nội dung công việc không được để trống"),
  detail: z.string().optional(),
  unit: z.string().trim().optional(),
  qty: num,
  unitPrice: num,
  amount: num,
  note: z.string().trim().optional(),
  /** Nhãn loại vật tư, gửi lên dạng "TON_MAI,KHUNG_THEP". */
  tags: z.string().optional(),
});

export async function saveLine(
  chu: ChuBaoGia,
  clientQuoteId: string,
  lineId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId, lineId });
  if (g) return g;

  const parsed = lineSchema.safeParse({
    partCode: s(form, "partCode"),
    partName: s(form, "partName"),
    code: s(form, "code"),
    name: s(form, "name"),
    detail: s(form, "detail"),
    unit: s(form, "unit"),
    qty: s(form, "qty"),
    unitPrice: s(form, "unitPrice"),
    amount: s(form, "amount"),
    note: s(form, "note"),
    tags: s(form, "tags"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    partCode: d.partCode || "I",
    partName: d.partName || "Phần kết cấu thép",
    code: d.code || null,
    name: d.name,
    detail: d.detail || null,
    unit: d.unit || null,
    qty: d.qty,
    unitPrice: d.unitPrice,
    amount: d.amount,
    note: d.note || null,
    // Lọc rỗng để không lưu nhãn ma: nhãn sai thì dòng vật liệu không bao giờ hiện.
    tags: (d.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };

  if (lineId) {
    // Sửa tay đơn giá của một dòng được sinh tự động = đánh dấu đã đè giá, để
    // "Tính lại đơn giá" sau này không ghi đè công sức của người dùng.
    const truoc = await db.clientQuoteLine.findUnique({
      where: { id: lineId },
      select: { unitPrice: true, sourceSectionId: true, priceOverridden: true },
    });
    const daDeGia =
      truoc?.priceOverridden ||
      (truoc?.sourceSectionId != null && truoc.unitPrice !== d.unitPrice);
    await db.clientQuoteLine.update({
      where: { id: lineId },
      data: { ...data, priceOverridden: daDeGia ?? false },
    });
  } else {
    const max = await db.clientQuoteLine.aggregate({
      where: { quoteId: clientQuoteId },
      _max: { sortOrder: true },
    });
    await db.clientQuoteLine.create({
      data: { quoteId: clientQuoteId, ...data, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }

  paths(chu);
  return { ok: true };
}

const oHangMucSchema = z.object({
  name: z.string().trim().min(1, "Nội dung công việc không được để trống"),
  unit: z.string().trim().optional(),
  qty: num,
  unitPrice: num,
  amount: num,
  partCode: z.string().trim().optional(),
  partName: z.string().trim().optional(),
});

/**
 * Lưu một dòng hạng mục gõ THẲNG trên bảng: `lineId` rỗng thì tạo dòng mới, còn lại
 * chỉ sửa đúng năm cột có mặt trên bảng.
 *
 * Cố ý KHÔNG gọi lại `saveLine`: hàm đó ghi đè cả `tags`, `detail`, `note`, `code` và
 * cách xếp phần. Gửi lên vỏn vẹn năm ô là xóa sạch nhãn vật tư và mô tả riêng của
 * dòng — chính những thứ quyết định bảng "Vật liệu & thông số kỹ thuật" in ra dòng nào.
 */
export async function luuOHangMuc(
  chu: ChuBaoGia,
  clientQuoteId: string,
  lineId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId, lineId });
  if (g) return g;

  const parsed = oHangMucSchema.safeParse({
    name: s(form, "name"),
    unit: s(form, "unit"),
    qty: s(form, "qty"),
    unitPrice: s(form, "unitPrice"),
    amount: s(form, "amount"),
    partCode: s(form, "partCode"),
    partName: s(form, "partName"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const oBang = {
    name: d.name,
    unit: d.unit || null,
    qty: d.qty,
    unitPrice: d.unitPrice,
    amount: d.amount,
  };

  if (lineId) {
    // Sửa tay đơn giá của một dòng được sinh tự động = đánh dấu đã đè giá, để
    // "Tính lại đơn giá" sau này không ghi đè công sức của người dùng. Cùng luật với
    // `saveLine` — sửa ở bảng hay trong hộp thoại đều phải cho cùng kết quả.
    const truoc = await db.clientQuoteLine.findUnique({
      where: { id: lineId },
      select: { unitPrice: true, sourceSectionId: true, priceOverridden: true },
    });
    const daDeGia =
      truoc?.priceOverridden ||
      (truoc?.sourceSectionId != null && truoc.unitPrice !== d.unitPrice);
    await db.clientQuoteLine.update({
      where: { id: lineId },
      data: { ...oBang, priceOverridden: daDeGia ?? false },
    });
  } else {
    const max = await db.clientQuoteLine.aggregate({
      where: { quoteId: clientQuoteId },
      _max: { sortOrder: true },
    });
    // Dòng mới mang mã phần của nhóm nó vừa được gõ vào, nên dù `sortOrder` lớn nhất
    // nó vẫn hiện ở CUỐI ĐÚNG NHÓM đó chứ không rơi xuống cuối bảng.
    await db.clientQuoteLine.create({
      data: {
        quoteId: clientQuoteId,
        ...oBang,
        partCode: d.partCode || "I",
        partName: d.partName || "Phần kết cấu thép",
        tags: [],
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }

  paths(chu);
  return { ok: true };
}

export async function deleteLine(chu: ChuBaoGia, lineId: string): Promise<ActionResult> {
  const g = await guard(chu, { lineId });
  if (g) return g;
  await db.clientQuoteLine.delete({ where: { id: lineId } });
  paths(chu);
  return { ok: true };
}

/** Bỏ cờ đè giá để dòng này lại được "Tính lại đơn giá" cập nhật. */
export async function clearPriceOverride(
  chu: ChuBaoGia,
  lineId: string
): Promise<ActionResult> {
  const g = await guard(chu, { lineId });
  if (g) return g;
  await db.clientQuoteLine.update({ where: { id: lineId }, data: { priceOverridden: false } });
  paths(chu);
  return { ok: true };
}

// ---------- Dòng vật liệu & thông số kỹ thuật ----------

const specSchema = z.object({
  groupCode: z.enum(["A", "B"]),
  /** Nhãn loại vật tư; để trống = vật tư dùng chung, luôn in. */
  tag: z.string().trim().optional(),
  name: z.string().trim().min(1, "Tên vật liệu không được để trống"),
  spec: z.string().trim().optional(),
  origin: z.string().trim().optional(),
  /**
   * Ô tick "nhắc lại dưới tên hạng mục". Trình duyệt gửi "on" khi tick, và KHÔNG
   * gửi khóa nào khi bỏ tick — nên không tick đồng nghĩa với tắt.
   */
  inDescription: z.string().optional(),
});

export async function saveSpec(
  chu: ChuBaoGia,
  clientQuoteId: string,
  specId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId, specId });
  if (g) return g;

  const parsed = specSchema.safeParse({
    groupCode: s(form, "groupCode"),
    tag: s(form, "tag"),
    name: s(form, "name"),
    spec: s(form, "spec"),
    origin: s(form, "origin"),
    inDescription: s(form, "inDescription"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    groupCode: d.groupCode,
    tag: d.tag || null,
    name: d.name,
    spec: d.spec || null,
    origin: d.origin || null,
    inDescription: d.inDescription === "on",
  };

  if (specId) {
    await db.clientQuoteSpec.update({ where: { id: specId }, data });
  } else {
    const max = await db.clientQuoteSpec.aggregate({
      where: { quoteId: clientQuoteId },
      _max: { sortOrder: true },
    });
    await db.clientQuoteSpec.create({
      data: { quoteId: clientQuoteId, ...data, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }

  paths(chu);
  return { ok: true };
}

export async function deleteSpec(chu: ChuBaoGia, specId: string): Promise<ActionResult> {
  const g = await guard(chu, { specId });
  if (g) return g;
  await db.clientQuoteSpec.delete({ where: { id: specId } });
  paths(chu);
  return { ok: true };
}

// ---------- Điều khoản: tiến độ thi công + tiến độ thanh toán ----------

/**
 * Lưu cả hai bảng điều khoản trong một giao dịch. Xóa hết rồi tạo lại là cách
 * rẻ nhất để xử lý việc người dùng thêm/bớt/đổi thứ tự dòng ngay trên bảng —
 * hai bảng này mỗi cái chỉ vài dòng.
 */
export async function saveTerms(
  chu: ChuBaoGia,
  clientQuoteId: string,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId });
  if (g) return g;

  const stages = docDongJson(form, "stages", (r) => ({
    name: String(r.name ?? "").trim(),
    days: soHoacNull(r.days),
  })).filter((r) => r.name.length > 0);

  const payments = docDongJson(form, "payments", (r) => ({
    label: String(r.label ?? "").trim(),
    percent: soHoacNull(r.percent),
    basis: String(r.basis ?? "").trim() || null,
    note: String(r.note ?? "").trim() || null,
  })).filter((r) => r.label.length > 0);

  const check = validatePaymentPercents(payments);
  if (!check.ok) return { ok: false, error: check.error! };

  await db.$transaction([
    db.clientQuoteStage.deleteMany({ where: { quoteId: clientQuoteId } }),
    db.clientQuoteStage.createMany({
      data: stages.map((st, i) => ({ quoteId: clientQuoteId, ...st, sortOrder: i })),
    }),
    db.clientQuotePayment.deleteMany({ where: { quoteId: clientQuoteId } }),
    db.clientQuotePayment.createMany({
      data: payments.map((p, i) => ({ quoteId: clientQuoteId, ...p, sortOrder: i })),
    }),
  ]);

  paths(chu);
  return { ok: true };
}

/** Bảng điều khoản gửi lên dưới dạng một chuỗi JSON trong FormData. */
function docDongJson<T>(
  form: FormData,
  key: string,
  map: (r: Record<string, unknown>) => T
): T[] {
  const raw = s(form, key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => map(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

function soHoacNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// ---------- Sinh báo giá m² TỪ báo giá chi tiết ----------

/**
 * Action sinh/tính lại có thể thành công một phần: đơn giá suy ra được cho phần này
 * nhưng không cho phần kia. Trả kèm cảnh báo thay vì im lặng — người lập báo giá
 * phải biết dòng nào còn trống trước khi gửi đi.
 */
export type DeriveActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string };

/** Nạp phần + dòng của báo giá chi tiết và cộng tiền theo từng phần gốc. */
async function nguonBaoGiaChiTiet(sourceQuoteId: string) {
  const src = await db.quote.findUnique({
    where: { id: sourceQuoteId },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!src) return null;
  return {
    src,
    goc: src.sections.filter((x) => !x.parentId),
    subtotals: sectionSubtotals(src.sections, src.items),
  };
}

export async function generateFromQuote(
  chu: ChuBaoGia,
  sourceQuoteId: string,
  form: FormData
): Promise<DeriveActionResult> {
  const g = await guard(chu);
  if (g) return g;

  const nguon = await nguonBaoGiaChiTiet(sourceQuoteId);
  if (!nguon) return { ok: false, error: "Không tìm thấy báo giá chi tiết nguồn." };
  // Kiểm lại quyền sở hữu: sourceQuoteId đến từ trình duyệt. Bản chi tiết phải cùng
  // chủ với bản gửi khách sắp sinh ra — khác chủ là sinh giá của người khác.
  if (!laCungChu(chu, nguon.src)) {
    return { ok: false, error: "Báo giá chi tiết không thuộc mục này." };
  }
  if (nguon.goc.length === 0) {
    return { ok: false, error: "Báo giá chi tiết chưa có phần nào để suy đơn giá." };
  }

  // Mọi phần đều bằng 0 nghĩa là báo giá chi tiết chưa điền đơn giá bán — sinh ra
  // một bản toàn số 0 rồi gửi cho khách thì tệ hơn là không sinh.
  const coTien = nguon.goc.some((sec) => (nguon.subtotals.get(sec.id) ?? 0) > 0);
  if (!coTien) {
    return {
      ok: false,
      error: "Báo giá chi tiết chưa có đơn giá bán nào — hãy điền đơn giá trước khi sinh.",
    };
  }

  const boiCanh = await boiCanhChu(chu);

  const templateId = s(form, "templateId") || null;
  const k = apDungMau(await napMau(templateId));

  // Mẫu có khai hạng mục thì dùng khuôn của mẫu (giữ được thứ tự, nhãn vật tư, mô
  // tả riêng đã soạn). Không có mẫu — hoặc mẫu để trống phần hạng mục — thì khuôn
  // lấy thẳng từ các phần của báo giá chi tiết: luôn khớp dữ liệu thật, không phải
  // đoán tên hạng mục.
  const specs: DeriveSpec[] =
    k.lines.length > 0
      ? k.lines.map((l) => ({
          partCode: l.partCode,
          partName: l.partName,
          code: l.code,
          name: l.name,
          detail: l.detail,
          unit: l.unit,
          note: l.note,
          sourceSectionCode: l.sourceSectionCode,
          defaultUnitPrice: l.defaultUnitPrice,
          tags: l.tags,
          steelFrameKey: l.steelFrameKey,
        }))
      : nguon.goc.map((sec, i) => ({
          partCode: "I",
          partName: "Phần kết cấu thép",
          code: String(i + 1).padStart(2, "0"),
          name: sec.name,
          detail: null,
          unit: "m2",
          note: null,
          sourceSectionCode: sec.code,
          defaultUnitPrice: null,
          // Không có mẫu thì đoán nhãn vật tư từ tên phần ("...tôn phần mái" ->
          // KHUNG_THEP + TON_MAI) để bảng vật liệu tự lọc đúng ngay. Người lập sửa được.
          tags: doanNhan(sec.name),
        }));

  const { lines, warnings } = deriveLines(
    specs,
    nguon.goc.map((sec) => ({ id: sec.id, code: sec.code, area: sec.area })),
    nguon.subtotals,
    boiCanh.area
  );

  const title = s(form, "title").trim() || `Báo giá gửi khách — ${nguon.src.title}`;

  // Cả báo giá + dòng + vật liệu + điều khoản trong MỘT giao dịch: một bản báo giá
  // có dòng tiền nhưng thiếu bảng vật liệu hay thiếu điều khoản là văn bản hỏng.
  const id = await db.$transaction(async (tx) => {
    const q = await tx.clientQuote.create({
      data: {
        ...duLieuChu(chu),
        title,
        templateId,
        derivedFromId: nguon.src.id,
        quoteDate: new Date(),
        customerId: boiCanh.customerId,
        recipient: boiCanh.tenNhan ?? nguon.src.recipient,
        customerPhone: boiCanh.dienThoai,
        location: nguon.src.location ?? boiCanh.location,
        scope: nguon.src.scope ?? "Kết cấu thép và bao che",
        vatPercent: k.vatPercent,
        validDays: k.validDays,
        warrantyMonths: k.warrantyMonths,
        maintenanceMonths: k.maintenanceMonths,
        loadRoof: k.loadRoof,
        loadHanging: k.loadHanging,
        loadFloor: k.loadFloor,
        lineDetail: k.lineDetail,
        greeting: k.greeting,
        closing: k.closing,
        colorNote: k.colorNote,
        volumeNote: k.volumeNote,
        excludeNote: k.excludeNote,
        note: `Sinh từ báo giá chi tiết "${nguon.src.title}"; đơn giá m² = tổng tiền mỗi phần chia diện tích.`,
      },
    });
    const con = bangConCuaMau(q.id, k);
    await tx.clientQuoteLine.createMany({
      data: lines.map((l, i) => ({ quoteId: q.id, ...l, sortOrder: i })),
    });
    await tx.clientQuoteSpec.createMany({ data: con.specs });
    await tx.clientQuoteStage.createMany({ data: con.stages });
    await tx.clientQuotePayment.createMany({ data: con.payments });
    return q.id;
  });

  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: id,
    entityLabel: title,
    projectId: duAnCuaChu(chu),
    action: "CREATE",
    changes: null,
  });

  paths(chu);
  return { ok: true, warnings };
}

/**
 * Tính lại đơn giá m² từ báo giá chi tiết gốc.
 * Dòng đã sửa tay (priceOverridden) được giữ nguyên — xem repriceLines.
 */
export async function recomputePrices(
  chu: ChuBaoGia,
  clientQuoteId: string
): Promise<DeriveActionResult> {
  const g = await guard(chu, { clientQuoteId });
  if (g) return g;

  const q = await db.clientQuote.findUnique({
    where: { id: clientQuoteId },
    select: { derivedFromId: true, lines: { select: { id: true, sourceSectionId: true, priceOverridden: true } } },
  });
  if (!q?.derivedFromId) {
    return { ok: false, error: "Báo giá này không được sinh từ báo giá chi tiết nào." };
  }

  const nguon = await nguonBaoGiaChiTiet(q.derivedFromId);
  if (!nguon) return { ok: false, error: "Báo giá chi tiết gốc đã bị xóa." };
  if (!laCungChu(chu, nguon.src)) {
    return { ok: false, error: "Báo giá chi tiết không thuộc mục này." };
  }

  const boiCanh = await boiCanhChu(chu);

  const { updates, skipped, warnings } = repriceLines(
    q.lines,
    nguon.goc.map((sec) => ({ id: sec.id, code: sec.code, area: sec.area })),
    nguon.subtotals,
    boiCanh.area
  );

  if (updates.length > 0) {
    await db.$transaction(
      updates.map((u) =>
        db.clientQuoteLine.update({
          where: { id: u.id },
          data: { qty: u.qty, unitPrice: u.unitPrice },
        })
      )
    );
  }

  const ketQua = [...warnings];
  if (skipped > 0) {
    ketQua.push(`Giữ nguyên ${skipped} dòng đã sửa đơn giá bằng tay.`);
  }
  if (updates.length === 0 && ketQua.length === 0) {
    ketQua.push("Không có dòng nào cần tính lại.");
  }

  paths(chu);
  return { ok: true, warnings: ketQua };
}

// ---------- Vòng đời báo giá (CRM) ----------

/**
 * Đổi trạng thái báo giá.
 *
 * Hai việc xảy ra một lần duy nhất khi chuyển sang "Đã gửi":
 *   · `sentDate` ghi lại thời điểm gửi;
 *   · `expiryDate` được CHỐT CỨNG. Sau đó sửa ngày báo giá hay số ngày hiệu lực
 *     không còn dịch chuyển hạn nữa — khách đã cầm trên tay một văn bản ghi rõ hạn
 *     hiệu lực, hạn đó không được phép tự đổi sau lưng họ.
 *
 * Chuyển về "Đã gửi" lần thứ hai (từ Đàm phán, từ Hủy) KHÔNG đặt lại hai trường này.
 */
export async function setClientQuoteStatus(
  chu: ChuBaoGia,
  clientQuoteId: string,
  status: string
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId });
  if (g) return g;

  if (!CLIENT_QUOTE_STATUS_MAP[status]) {
    return { ok: false, error: "Trạng thái không hợp lệ." };
  }

  const truoc = await db.clientQuote.findUnique({
    where: { id: clientQuoteId },
    select: {
      status: true,
      sentDate: true,
      quoteDate: true,
      validDays: true,
      expiryDate: true,
      quoteNo: true,
      title: true,
      payments: { select: { percent: true } },
    },
  });
  if (!truoc) return { ok: false, error: "Không tìm thấy báo giá." };
  if (truoc.status === status) return { ok: true };

  const data: Record<string, unknown> = { status };

  if (status === "DA_GUI") {
    // Chặn TRƯỚC khi gửi, không phải lúc in: một văn bản có tiến độ thanh toán
    // cộng không đủ 100% mà đã ra khỏi công ty thì không rút lại được.
    const kiem = validatePaymentPercents(truoc.payments);
    if (truoc.payments.length === 0) {
      return { ok: false, error: "Chưa khai tiến độ thanh toán — không gửi được." };
    }
    if (!kiem.ok) {
      return { ok: false, error: kiem.error ?? "Tiến độ thanh toán không hợp lệ." };
    }
    if (!truoc.sentDate) {
      const gui = new Date();
      data.sentDate = gui;
      data.expiryDate = expiryFrom(truoc.quoteDate ?? gui, truoc.validDays);
    }
  }

  await db.clientQuote.update({ where: { id: clientQuoteId }, data });

  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: clientQuoteId,
    entityLabel: truoc.quoteNo ? `${truoc.quoteNo} — ${truoc.title}` : truoc.title,
    projectId: duAnCuaChu(chu),
    action: "UPDATE",
    changes: diffFields(truoc, data, ["status", "sentDate", "expiryDate"]),
  });

  paths(chu);
  return { ok: true };
}

/**
 * Đẩy tổng sau thuế của báo giá vào giá bán dự án.
 *
 * Cố ý là một NÚT RIÊNG chứ không kèm theo việc chuyển sang "Đã chốt": giá bán dự án
 * là con số mọi báo cáo lãi lỗ dựa vào, ghi đè nó phải là một quyết định có chủ ý.
 * Cùng khuôn với pushSalePrice của báo giá chi tiết, kể cả phần ghi vết.
 */
export async function pushSalePriceFromClientQuote(
  chu: ChuBaoGia,
  clientQuoteId: string
): Promise<ActionResult> {
  const g = await guard(chu, { clientQuoteId });
  if (g) return g;
  // Cơ hội chưa có dự án nào để nhận giá. Chặn ở tầng ghi chứ không chỉ ẩn nút.
  if (chu.loai !== "DU_AN") {
    return {
      ok: false,
      error: "Chưa có dự án để nhận giá bán — ký hợp đồng và tạo dự án trước đã.",
    };
  }
  const projectId = chu.id;
  try {
    await requirePermission("project", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền sửa giá bán dự án." };
  }

  const q = await db.clientQuote.findUnique({
    where: { id: clientQuoteId },
    select: {
      vatPercent: true,
      lines: { select: { qty: true, unitPrice: true, amount: true } },
    },
  });
  if (!q) return { ok: false, error: "Không tìm thấy báo giá." };

  const total = computeClientQuoteTotals(q.lines, q.vatPercent).withVat;
  if (total <= 0) {
    return { ok: false, error: "Báo giá chưa có tiền — không có gì để đẩy." };
  }

  const truocDA = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, salePrice: true },
  });
  await db.project.update({ where: { id: projectId }, data: { salePrice: total } });

  await recordAudit({
    actor: await requireSession(),
    entity: "Project",
    entityId: projectId,
    entityLabel: truocDA?.code ?? null,
    projectId: duAnCuaChu(chu),
    action: "UPDATE",
    changes: diffFields(truocDA, { salePrice: total }, ["salePrice"]),
  });

  paths(chu);
  return { ok: true };
}
