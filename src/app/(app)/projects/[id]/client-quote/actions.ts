"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { validatePaymentPercents } from "@/lib/clientQuote";
import { sectionSubtotals } from "@/lib/quote";
import { deriveLines, repriceLines, type DeriveSpec } from "@/lib/clientQuoteDerive";
import {
  DEFAULT_CLOSING,
  DEFAULT_COLOR_NOTE,
  DEFAULT_EXCLUDE_NOTE,
  DEFAULT_GREETING,
  DEFAULT_LINE_DETAIL,
  DEFAULT_LOADS,
  DEFAULT_MAINTENANCE_MONTHS,
  DEFAULT_PAYMENTS,
  DEFAULT_SPECS,
  DEFAULT_STAGES,
  DEFAULT_VOLUME_NOTE,
  DEFAULT_VALID_DAYS,
  DEFAULT_VAT_PERCENT,
  DEFAULT_WARRANTY_MONTHS,
} from "@/lib/clientQuoteDefaults";

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

function paths(projectId: string) {
  revalidatePath(`/projects/${projectId}/client-quote`);
  revalidatePath("/client-quotes");
  revalidatePath(`/projects/${projectId}`);
}

const s = (form: FormData, key: string) => String(form.get(key) ?? "");

/**
 * Chặn khi thiếu quyền / ngoài phạm vi dự án, rồi truy MỌI id con ngược về báo giá
 * và đối chiếu báo giá đó có thuộc dự án không.
 *
 * Mọi id ở đây đều đến từ trình duyệt. Bỏ bước truy ngược này là mở đường ghi chéo
 * sang dự án khác: chỉ cần sửa một id trong request là sửa được báo giá của dự án
 * mà mình không được phân công.
 */
async function guard(
  projectId: string,
  opts: {
    clientQuoteId?: string | null;
    lineId?: string | null;
    specId?: string | null;
    stageId?: string | null;
    paymentId?: string | null;
  } = {}
): Promise<ActionResult | null> {
  const denied = await denyProject(
    "quote",
    "edit",
    projectId,
    "Bạn không có quyền chỉnh sửa báo giá."
  );
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
      select: { projectId: true },
    });
    if (!q || q.projectId !== projectId) {
      return { ok: false, error: "Báo giá không thuộc dự án này." };
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
  projectId: string,
  clientQuoteId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId });
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
    id = await taoMoiKemMacDinh(projectId, data);
  }

  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: id,
    entityLabel: d.quoteNo ? `${d.quoteNo} — ${d.title}` : d.title,
    projectId,
    action: clientQuoteId ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, CQ_AUDIT_FIELDS),
  });

  paths(projectId);
  return { ok: true };
}

/**
 * Tạo báo giá mới kèm toàn bộ phần mặc định (16 dòng vật liệu, 5 chặng thi công,
 * 4 đợt thanh toán) trong MỘT giao dịch — báo giá thiếu bảng vật liệu hay thiếu
 * điều khoản là một văn bản hỏng, không được phép tồn tại nửa vời.
 */
async function taoMoiKemMacDinh(
  projectId: string,
  data: Record<string, unknown>
): Promise<string> {
  return db.$transaction(async (tx) => {
    const q = await tx.clientQuote.create({
      data: {
        projectId,
        ...(data as { title: string }),
        vatPercent: (data.vatPercent as number | null) ?? DEFAULT_VAT_PERCENT,
        validDays: (data.validDays as number | null) ?? DEFAULT_VALID_DAYS,
        warrantyMonths: (data.warrantyMonths as number | null) ?? DEFAULT_WARRANTY_MONTHS,
        maintenanceMonths:
          (data.maintenanceMonths as number | null) ?? DEFAULT_MAINTENANCE_MONTHS,
        loadRoof: (data.loadRoof as number | null) ?? DEFAULT_LOADS.roof,
        loadHanging: (data.loadHanging as number | null) ?? DEFAULT_LOADS.hanging,
        loadFloor: (data.loadFloor as number | null) ?? DEFAULT_LOADS.floor,
        lineDetail: (data.lineDetail as string | null) ?? DEFAULT_LINE_DETAIL,
        greeting: (data.greeting as string | null) ?? DEFAULT_GREETING,
        closing: (data.closing as string | null) ?? DEFAULT_CLOSING,
        colorNote: (data.colorNote as string | null) ?? DEFAULT_COLOR_NOTE,
        volumeNote: (data.volumeNote as string | null) ?? DEFAULT_VOLUME_NOTE,
        excludeNote: (data.excludeNote as string | null) ?? DEFAULT_EXCLUDE_NOTE,
      },
    });
    await tx.clientQuoteSpec.createMany({
      data: DEFAULT_SPECS.map((sp, i) => ({ quoteId: q.id, ...sp, sortOrder: i })),
    });
    await tx.clientQuoteStage.createMany({
      data: DEFAULT_STAGES.map((st, i) => ({ quoteId: q.id, ...st, sortOrder: i })),
    });
    await tx.clientQuotePayment.createMany({
      data: DEFAULT_PAYMENTS.map((p, i) => ({ quoteId: q.id, ...p, sortOrder: i })),
    });
    return q.id;
  });
}

export async function deleteClientQuote(
  projectId: string,
  clientQuoteId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId });
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
    projectId,
    action: "DELETE",
    changes: diffFields(truoc, null, CQ_AUDIT_FIELDS),
  });
  paths(projectId);
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
});

export async function saveLine(
  projectId: string,
  clientQuoteId: string,
  lineId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId, lineId });
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

  paths(projectId);
  return { ok: true };
}

export async function deleteLine(projectId: string, lineId: string): Promise<ActionResult> {
  const g = await guard(projectId, { lineId });
  if (g) return g;
  await db.clientQuoteLine.delete({ where: { id: lineId } });
  paths(projectId);
  return { ok: true };
}

/** Bỏ cờ đè giá để dòng này lại được "Tính lại đơn giá" cập nhật. */
export async function clearPriceOverride(
  projectId: string,
  lineId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { lineId });
  if (g) return g;
  await db.clientQuoteLine.update({ where: { id: lineId }, data: { priceOverridden: false } });
  paths(projectId);
  return { ok: true };
}

// ---------- Dòng vật liệu & thông số kỹ thuật ----------

const specSchema = z.object({
  groupCode: z.enum(["A", "B"]),
  name: z.string().trim().min(1, "Tên vật liệu không được để trống"),
  spec: z.string().trim().optional(),
  origin: z.string().trim().optional(),
});

export async function saveSpec(
  projectId: string,
  clientQuoteId: string,
  specId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId, specId });
  if (g) return g;

  const parsed = specSchema.safeParse({
    groupCode: s(form, "groupCode"),
    name: s(form, "name"),
    spec: s(form, "spec"),
    origin: s(form, "origin"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    groupCode: d.groupCode,
    name: d.name,
    spec: d.spec || null,
    origin: d.origin || null,
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

  paths(projectId);
  return { ok: true };
}

export async function deleteSpec(projectId: string, specId: string): Promise<ActionResult> {
  const g = await guard(projectId, { specId });
  if (g) return g;
  await db.clientQuoteSpec.delete({ where: { id: specId } });
  paths(projectId);
  return { ok: true };
}

// ---------- Điều khoản: tiến độ thi công + tiến độ thanh toán ----------

/**
 * Lưu cả hai bảng điều khoản trong một giao dịch. Xóa hết rồi tạo lại là cách
 * rẻ nhất để xử lý việc người dùng thêm/bớt/đổi thứ tự dòng ngay trên bảng —
 * hai bảng này mỗi cái chỉ vài dòng.
 */
export async function saveTerms(
  projectId: string,
  clientQuoteId: string,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId });
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

  paths(projectId);
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
  projectId: string,
  sourceQuoteId: string,
  form: FormData
): Promise<DeriveActionResult> {
  const g = await guard(projectId);
  if (g) return g;

  const nguon = await nguonBaoGiaChiTiet(sourceQuoteId);
  if (!nguon) return { ok: false, error: "Không tìm thấy báo giá chi tiết nguồn." };
  // Kiểm lại quyền sở hữu: sourceQuoteId đến từ trình duyệt.
  if (nguon.src.projectId !== projectId) {
    return { ok: false, error: "Báo giá chi tiết không thuộc dự án này." };
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

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, area: true, location: true, customerId: true, customer: { select: { name: true, phone: true } } },
  });

  // Chưa có thư viện mẫu thì khuôn dòng lấy thẳng từ các phần của báo giá chi tiết —
  // luôn khớp với dữ liệu thật, không phải đoán tên hạng mục.
  const specs: DeriveSpec[] = nguon.goc.map((sec, i) => ({
    partCode: "I",
    partName: "Phần kết cấu thép",
    code: String(i + 1).padStart(2, "0"),
    name: sec.name,
    detail: null,
    unit: "m2",
    note: null,
    sourceSectionCode: sec.code,
    defaultUnitPrice: null,
  }));

  const { lines, warnings } = deriveLines(
    specs,
    nguon.goc.map((sec) => ({ id: sec.id, code: sec.code, area: sec.area })),
    nguon.subtotals,
    project?.area ?? null
  );

  const title = s(form, "title").trim() || `Báo giá gửi khách — ${nguon.src.title}`;

  // Cả báo giá + dòng + vật liệu + điều khoản trong MỘT giao dịch: một bản báo giá
  // có dòng tiền nhưng thiếu bảng vật liệu hay thiếu điều khoản là văn bản hỏng.
  const id = await db.$transaction(async (tx) => {
    const q = await tx.clientQuote.create({
      data: {
        projectId,
        title,
        derivedFromId: nguon.src.id,
        quoteDate: new Date(),
        customerId: project?.customerId ?? null,
        recipient: project?.customer?.name ?? nguon.src.recipient,
        customerPhone: project?.customer?.phone ?? null,
        location: nguon.src.location ?? project?.location ?? null,
        scope: nguon.src.scope ?? "Kết cấu thép và bao che",
        vatPercent: DEFAULT_VAT_PERCENT,
        validDays: DEFAULT_VALID_DAYS,
        warrantyMonths: DEFAULT_WARRANTY_MONTHS,
        maintenanceMonths: DEFAULT_MAINTENANCE_MONTHS,
        loadRoof: DEFAULT_LOADS.roof,
        loadHanging: DEFAULT_LOADS.hanging,
        loadFloor: DEFAULT_LOADS.floor,
        lineDetail: DEFAULT_LINE_DETAIL,
        greeting: DEFAULT_GREETING,
        closing: DEFAULT_CLOSING,
        colorNote: DEFAULT_COLOR_NOTE,
        volumeNote: DEFAULT_VOLUME_NOTE,
        excludeNote: DEFAULT_EXCLUDE_NOTE,
        note: `Sinh từ báo giá chi tiết "${nguon.src.title}"; đơn giá m² = tổng tiền mỗi phần chia diện tích.`,
      },
    });
    await tx.clientQuoteLine.createMany({
      data: lines.map((l, i) => ({ quoteId: q.id, ...l, sortOrder: i })),
    });
    await tx.clientQuoteSpec.createMany({
      data: DEFAULT_SPECS.map((sp, i) => ({ quoteId: q.id, ...sp, sortOrder: i })),
    });
    await tx.clientQuoteStage.createMany({
      data: DEFAULT_STAGES.map((st, i) => ({ quoteId: q.id, ...st, sortOrder: i })),
    });
    await tx.clientQuotePayment.createMany({
      data: DEFAULT_PAYMENTS.map((p, i) => ({ quoteId: q.id, ...p, sortOrder: i })),
    });
    return q.id;
  });

  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: id,
    entityLabel: title,
    projectId,
    action: "CREATE",
    changes: null,
  });

  paths(projectId);
  return { ok: true, warnings };
}

/**
 * Tính lại đơn giá m² từ báo giá chi tiết gốc.
 * Dòng đã sửa tay (priceOverridden) được giữ nguyên — xem repriceLines.
 */
export async function recomputePrices(
  projectId: string,
  clientQuoteId: string
): Promise<DeriveActionResult> {
  const g = await guard(projectId, { clientQuoteId });
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
  if (nguon.src.projectId !== projectId) {
    return { ok: false, error: "Báo giá chi tiết không thuộc dự án này." };
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { area: true },
  });

  const { updates, skipped, warnings } = repriceLines(
    q.lines,
    nguon.goc.map((sec) => ({ id: sec.id, code: sec.code, area: sec.area })),
    nguon.subtotals,
    project?.area ?? null
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

  paths(projectId);
  return { ok: true, warnings: ketQua };
}
