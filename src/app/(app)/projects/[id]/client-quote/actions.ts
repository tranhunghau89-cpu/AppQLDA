"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requirePermission, requireSession } from "@/lib/auth";
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
import { apDungMau, type KhuonBaoGia, type MauNguon } from "@/lib/quoteTemplate";

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
 * Nạp một mẫu trong thư viện về dạng thuần để `apDungMau` nấu.
 *
 * Mẫu đã bị xóa (hoặc id bịa) trả null — báo giá vẫn lập được bằng giá trị mặc
 * định, chứ không báo lỗi chặn người dùng lại.
 */
async function napMau(templateId: string | null): Promise<MauNguon | null> {
  if (!templateId) return null;
  const t = await db.quoteTemplate.findUnique({
    where: { id: templateId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      specs: { orderBy: { sortOrder: "asc" } },
      stages: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!t) return null;

  return {
    vatPercent: t.vatPercent,
    validDays: t.validDays,
    warrantyMonths: t.warrantyMonths,
    maintenanceMonths: t.maintenanceMonths,
    loadRoof: t.loadRoof,
    loadHanging: t.loadHanging,
    loadFloor: t.loadFloor,
    lineDetail: t.lineDetail,
    greeting: t.greeting,
    closing: t.closing,
    colorNote: t.colorNote,
    volumeNote: t.volumeNote,
    excludeNote: t.excludeNote,
    lines: t.lines.map((l) => ({
      partCode: l.partCode,
      partName: l.partName,
      code: l.code,
      name: l.name,
      detail: l.detail,
      unit: l.unit,
      note: l.note,
      defaultUnitPrice: l.defaultUnitPrice,
      tags: l.tags,
      sourceSectionCode: l.sourceSectionCode,
      steelFrameKey: l.steelFrameKey,
    })),
    specs: t.specs.map((r) => ({
      groupCode: r.groupCode === "B" ? "B" : "A",
      tag: r.tag,
      name: r.name,
      spec: r.spec,
      origin: r.origin,
      inDescription: r.inDescription,
    })),
    stages: t.stages.map((r) => ({ name: r.name, days: r.days ?? 0 })),
    payments: t.payments.map((r) => ({
      label: r.label,
      percent: r.percent ?? 0,
      basis: r.basis,
      note: r.note,
    })),
  };
}

/** Ba bảng con giống hệt nhau ở mọi đường tạo báo giá — viết một lần. */
function bangConCuaMau(quoteId: string, k: KhuonBaoGia) {
  return {
    specs: k.specs.map((sp, i) => ({ quoteId, ...sp, sortOrder: i })),
    stages: k.stages.map((st, i) => ({ quoteId, ...st, sortOrder: i })),
    payments: k.payments.map((p, i) => ({ quoteId, ...p, sortOrder: i })),
  };
}

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
    // Mẫu chỉ có nghĩa lúc TẠO. Sửa báo giá cũ mà đổi mẫu thì phải ghi đè cả bảng
    // vật liệu và điều khoản người dùng đã chỉnh tay — không làm.
    id = await taoMoiKemMacDinh(projectId, data, s(form, "templateId") || null);
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
 * Tạo báo giá mới kèm toàn bộ phần đã soạn sẵn (bảng vật liệu, tiến độ thi công,
 * tiến độ thanh toán, và hạng mục nếu mẫu có khai) trong MỘT giao dịch — báo giá
 * thiếu bảng vật liệu hay thiếu điều khoản là một văn bản hỏng, không được phép
 * tồn tại nửa vời.
 *
 * Chọn mẫu thì lấy của mẫu, không chọn thì lấy mặc định trong clientQuoteDefaults.
 * Người lập vẫn đè được từng ô trong hộp thoại — ô nào để trống mới rơi về mẫu.
 */
async function taoMoiKemMacDinh(
  projectId: string,
  data: Record<string, unknown>,
  templateId: string | null
): Promise<string> {
  const k = apDungMau(await napMau(templateId));

  return db.$transaction(async (tx) => {
    const q = await tx.clientQuote.create({
      data: {
        projectId,
        ...(data as { title: string }),
        templateId,
        vatPercent: (data.vatPercent as number | null) ?? k.vatPercent,
        validDays: (data.validDays as number | null) ?? k.validDays,
        warrantyMonths: (data.warrantyMonths as number | null) ?? k.warrantyMonths,
        maintenanceMonths: (data.maintenanceMonths as number | null) ?? k.maintenanceMonths,
        loadRoof: (data.loadRoof as number | null) ?? k.loadRoof,
        loadHanging: (data.loadHanging as number | null) ?? k.loadHanging,
        loadFloor: (data.loadFloor as number | null) ?? k.loadFloor,
        lineDetail: (data.lineDetail as string | null) ?? k.lineDetail,
        greeting: (data.greeting as string | null) ?? k.greeting,
        closing: (data.closing as string | null) ?? k.closing,
        colorNote: (data.colorNote as string | null) ?? k.colorNote,
        volumeNote: (data.volumeNote as string | null) ?? k.volumeNote,
        excludeNote: (data.excludeNote as string | null) ?? k.excludeNote,
      },
    });

    const con = bangConCuaMau(q.id, k);
    if (k.lines.length > 0) {
      await tx.clientQuoteLine.createMany({
        data: k.lines.map((l, i) => ({
          quoteId: q.id,
          partCode: l.partCode,
          partName: l.partName,
          code: l.code,
          name: l.name,
          detail: l.detail,
          unit: l.unit,
          note: l.note,
          // Chưa có báo giá chi tiết để suy ra: dùng đơn giá mặc định của mẫu,
          // khối lượng để trống cho người lập điền.
          unitPrice: l.defaultUnitPrice,
          tags: l.tags,
          steelFrameKey: l.steelFrameKey,
          sortOrder: i,
        })),
      });
    }
    await tx.clientQuoteSpec.createMany({ data: con.specs });
    await tx.clientQuoteStage.createMany({ data: con.stages });
    await tx.clientQuotePayment.createMany({ data: con.payments });
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
  /** Nhãn loại vật tư, gửi lên dạng "TON_MAI,KHUNG_THEP". */
  tags: z.string().optional(),
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
  projectId: string,
  clientQuoteId: string,
  specId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId, specId });
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
        templateId,
        derivedFromId: nguon.src.id,
        quoteDate: new Date(),
        customerId: project?.customerId ?? null,
        recipient: project?.customer?.name ?? nguon.src.recipient,
        customerPhone: project?.customer?.phone ?? null,
        location: nguon.src.location ?? project?.location ?? null,
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
  projectId: string,
  clientQuoteId: string,
  status: string
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId });
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
    projectId,
    action: "UPDATE",
    changes: diffFields(truoc, data, ["status", "sentDate", "expiryDate"]),
  });

  paths(projectId);
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
  projectId: string,
  clientQuoteId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { clientQuoteId });
  if (g) return g;
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
    projectId,
    action: "UPDATE",
    changes: diffFields(truocDA, { salePrice: total }, ["salePrice"]),
  });

  paths(projectId);
  return { ok: true };
}
