"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { canAccessProject } from "@/lib/scope";
import { denyProject, requirePermission, requireSession } from "@/lib/auth";
import { computeQuoteTotals, sellFromBase } from "@/lib/quote";

export type ActionResult = { ok: true } | { ok: false; error: string };

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

function paths(projectId: string) {
  revalidatePath(`/projects/${projectId}/quote`);
  revalidatePath("/quotes");
}

/**
 * Chặn khi thiếu quyền / ngoài phạm vi dự án, và đối chiếu báo giá / phần / dòng
 * có thuộc dự án đó không (mọi id đều đến từ client).
 */
async function guard(
  projectId: string,
  opts: { quoteId?: string | null; sectionId?: string | null; itemId?: string | null } = {}
): Promise<ActionResult | null> {
  const denied = await denyProject(
    "quote",
    "edit",
    projectId,
    "Bạn không có quyền chỉnh sửa báo giá."
  );
  if (denied) return denied;

  const quoteIds = new Set<string>();
  if (opts.quoteId) quoteIds.add(opts.quoteId);
  if (opts.sectionId) {
    const sec = await db.quoteSection.findUnique({
      where: { id: opts.sectionId },
      select: { quoteId: true },
    });
    if (!sec) return { ok: false, error: "Không tìm thấy phần/mục." };
    quoteIds.add(sec.quoteId);
  }
  if (opts.itemId) {
    const it = await db.quoteItem.findUnique({
      where: { id: opts.itemId },
      select: { quoteId: true },
    });
    if (!it) return { ok: false, error: "Không tìm thấy dòng báo giá." };
    quoteIds.add(it.quoteId);
  }

  for (const qid of quoteIds) {
    const q = await db.quote.findUnique({ where: { id: qid }, select: { projectId: true } });
    if (!q || q.projectId !== projectId) {
      return { ok: false, error: "Báo giá không thuộc dự án này." };
    }
  }
  return null;
}

// ---------- Quote (header) ----------
const quoteSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống"),
  recipient: z.string().trim().optional(),
  location: z.string().trim().optional(),
  scope: z.string().trim().optional(),
  quoteDate: z.string().trim().optional(),
  markup: num,
  note: z.string().trim().optional(),
});

export async function saveQuote(
  projectId: string,
  quoteId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { quoteId });
  if (g) return g;
  const parsed = quoteSchema.safeParse({
    title: String(form.get("title") ?? ""),
    recipient: String(form.get("recipient") ?? ""),
    location: String(form.get("location") ?? ""),
    scope: String(form.get("scope") ?? ""),
    quoteDate: String(form.get("quoteDate") ?? ""),
    markup: String(form.get("markup") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    title: d.title,
    recipient: d.recipient || null,
    location: d.location || null,
    scope: d.scope || null,
    quoteDate: d.quoteDate ? new Date(d.quoteDate) : null,
    markup: d.markup ?? 1,
    note: d.note || null,
  };
  if (quoteId) await db.quote.update({ where: { id: quoteId }, data });
  else await db.quote.create({ data: { projectId, ...data } });
  paths(projectId);
  return { ok: true };
}

export async function deleteQuote(
  projectId: string,
  quoteId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { quoteId });
  if (g) return g;
  await db.quote.delete({ where: { id: quoteId } });
  paths(projectId);
  return { ok: true };
}

// ---------- Section ----------
const sectionSchema = z.object({
  code: z.string().trim().min(1, "Mã phần/mục không được để trống"),
  name: z.string().trim().min(1, "Tên không được để trống"),
  kind: z.enum(["PHAN", "SUB"]),
  parentId: z.string().trim().optional(),
  area: num,
});

export async function saveSection(
  projectId: string,
  quoteId: string,
  sectionId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { quoteId, sectionId });
  if (g) return g;
  const parsed = sectionSchema.safeParse({
    code: String(form.get("code") ?? ""),
    name: String(form.get("name") ?? ""),
    kind: String(form.get("kind") ?? "PHAN"),
    parentId: String(form.get("parentId") ?? ""),
    area: String(form.get("area") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const parentId = d.kind === "SUB" && d.parentId ? d.parentId : null;
  if (d.kind === "SUB" && !parentId)
    return { ok: false, error: "Mục con phải thuộc một Phần." };

  if (sectionId) {
    await db.quoteSection.update({
      where: { id: sectionId },
      data: { code: d.code, name: d.name, kind: d.kind, parentId, area: d.area },
    });
  } else {
    const max = await db.quoteSection.aggregate({
      where: { quoteId },
      _max: { sortOrder: true },
    });
    await db.quoteSection.create({
      data: {
        quoteId,
        code: d.code,
        name: d.name,
        kind: d.kind,
        parentId,
        area: d.area,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }
  paths(projectId);
  return { ok: true };
}

export async function deleteSection(
  projectId: string,
  sectionId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { sectionId });
  if (g) return g;
  await db.quoteSection.delete({ where: { id: sectionId } });
  paths(projectId);
  return { ok: true };
}

// ---------- Item ----------
const itemSchema = z.object({
  sectionId: z.string().trim().min(1, "Thiếu mục chứa dòng"),
  workCode: z.string().trim().optional(),
  name: z.string().trim().min(1, "Tên công việc không được để trống"),
  unit: z.string().trim().optional(),
  qty: num,
  baseCost: num,
  sellPrice: num,
  spec: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function saveItem(
  projectId: string,
  quoteId: string,
  itemId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(projectId, { quoteId, itemId });
  if (g) return g;
  const parsed = itemSchema.safeParse({
    sectionId: String(form.get("sectionId") ?? ""),
    workCode: String(form.get("workCode") ?? ""),
    name: String(form.get("name") ?? ""),
    unit: String(form.get("unit") ?? ""),
    qty: String(form.get("qty") ?? ""),
    baseCost: String(form.get("baseCost") ?? ""),
    sellPrice: String(form.get("sellPrice") ?? ""),
    spec: String(form.get("spec") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    workCode: d.workCode || null,
    name: d.name,
    unit: d.unit || null,
    qty: d.qty,
    baseCost: d.baseCost,
    sellPrice: d.sellPrice,
    spec: d.spec || null,
    note: d.note || null,
  };
  if (itemId) {
    await db.quoteItem.update({ where: { id: itemId }, data });
  } else {
    const max = await db.quoteItem.aggregate({
      where: { sectionId: d.sectionId },
      _max: { sortOrder: true },
    });
    await db.quoteItem.create({
      data: { quoteId, sectionId: d.sectionId, ...data, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }
  paths(projectId);
  return { ok: true };
}

export async function deleteItem(
  projectId: string,
  itemId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { itemId });
  if (g) return g;
  await db.quoteItem.delete({ where: { id: itemId } });
  paths(projectId);
  return { ok: true };
}

// ---------- Clone từ báo giá khác ----------
export async function cloneQuoteFrom(
  projectId: string,
  sourceQuoteId: string,
  markupOverride?: number | null
): Promise<ActionResult> {
  const g = await guard(projectId);
  if (g) return g;

  const src = await db.quote.findUnique({
    where: { id: sourceQuoteId },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
      project: { select: { code: true, name: true } },
    },
  });
  if (!src) return { ok: false, error: "Không tìm thấy báo giá nguồn." };

  // Báo giá nguồn nằm ở dự án khác ⇒ dự án đó cũng phải trong phạm vi được giao.
  const session = await requireSession();
  if (!(await canAccessProject(session, src.projectId))) {
    return { ok: false, error: "Bạn không được phân công dự án của báo giá nguồn." };
  }

  const markup = markupOverride ?? src.markup ?? 1;
  const catalog = await db.workPrice.findMany({ select: { code: true, baseCost: true } });
  const priceMap = new Map(catalog.map((c) => [c.code, c.baseCost]));

  // Toàn bộ bản sao (báo giá + phần/mục + dòng) nằm trong 1 giao dịch: đứt giữa
  // chừng sẽ không để lại báo giá rỗng hoặc thiếu dòng.
  await db.$transaction(async (tx) => {
    const newQuote = await tx.quote.create({
      data: {
        projectId,
        title: `${src.title} — sao từ ${src.project.code}`,
        recipient: src.recipient,
        location: src.location,
        scope: src.scope,
        markup,
        clonedFromId: src.id,
        note: `Tạo từ báo giá "${src.title}" (${src.project.code} ${src.project.name}); đơn giá lấy theo bảng đơn giá hiện tại.`,
      },
    });

    // Tạo lại sections theo thứ tự (PHAN trước SUB nhờ sortOrder) + map id cũ -> mới.
    const idMap = new Map<string, string>();
    for (const s of src.sections) {
      const created = await tx.quoteSection.create({
        data: {
          quoteId: newQuote.id,
          code: s.code,
          name: s.name,
          kind: s.kind,
          parentId: s.parentId ? idMap.get(s.parentId) ?? null : null,
          area: s.area,
          sortOrder: s.sortOrder,
        },
      });
      idMap.set(s.id, created.id);
    }

    for (const it of src.items) {
      const newSectionId = idMap.get(it.sectionId);
      if (!newSectionId) continue;
      const base = it.workCode ? priceMap.get(it.workCode) ?? it.baseCost : it.baseCost;
      await tx.quoteItem.create({
        data: {
          quoteId: newQuote.id,
          sectionId: newSectionId,
          workCode: it.workCode,
          name: it.name,
          unit: it.unit,
          qty: it.qty,
          baseCost: base,
          sellPrice: base != null ? sellFromBase(base, markup) : it.sellPrice,
          spec: it.spec,
          note: it.note,
          sortOrder: it.sortOrder,
        },
      });
    }
  });

  paths(projectId);
  return { ok: true };
}

// ---------- Cập nhật đơn giá từ catalog ----------
export async function repriceQuote(
  projectId: string,
  quoteId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { quoteId });
  if (g) return g;
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  });
  if (!quote) return { ok: false, error: "Không tìm thấy báo giá." };
  const markup = quote.markup ?? 1;
  const catalog = await db.workPrice.findMany({ select: { code: true, baseCost: true } });
  const priceMap = new Map(catalog.map((c) => [c.code, c.baseCost]));

  // Cập nhật hàng loạt trong 1 giao dịch: tránh báo giá còn một nửa giá cũ,
  // một nửa giá mới nếu đứt kết nối giữa chừng.
  const updates = quote.items
    .filter((it) => it.workCode && priceMap.get(it.workCode) != null)
    .map((it) => {
      const base = priceMap.get(it.workCode!)!;
      return db.quoteItem.update({
        where: { id: it.id },
        data: { baseCost: base, sellPrice: sellFromBase(base, markup) },
      });
    });
  if (updates.length > 0) await db.$transaction(updates);
  paths(projectId);
  return { ok: true };
}

// ---------- Đẩy giá bán sang dự án ----------
export async function pushSalePrice(
  projectId: string,
  quoteId: string
): Promise<ActionResult> {
  const g = await guard(projectId, { quoteId });
  if (g) return g;
  try {
    await requirePermission("project", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền sửa giá bán dự án." };
  }
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { items: { select: { qty: true, sellPrice: true, baseCost: true } } },
  });
  if (!quote) return { ok: false, error: "Không tìm thấy báo giá." };
  const total = computeQuoteTotals(quote.items).sell;
  await db.project.update({ where: { id: projectId }, data: { salePrice: total } });
  revalidatePath(`/projects/${projectId}`);
  paths(projectId);
  return { ok: true };
}
