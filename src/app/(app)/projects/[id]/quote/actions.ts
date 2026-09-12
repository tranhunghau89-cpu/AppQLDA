"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { canAccessProject } from "@/lib/scope";
import { denyProject, requirePermission, requireSession } from "@/lib/auth";
import { canAccessCoHoi, denyCoHoi } from "@/lib/coHoiAccess";
import {
  chuCuaQuote,
  duLieuChu,
  duongDanChu,
  laCungChu,
  type ChuBaoGia,
} from "@/lib/quoteOwner";
import { diffFields, recordAudit } from "@/lib/audit";
import { computeQuoteTotals, sellFromBase } from "@/lib/quote";
import { banGiaTheoMa } from "@/lib/thuVien/napGia";

export type ActionResult = { ok: true } | { ok: false; error: string };

const QUOTE_AUDIT_FIELDS = [
  "title",
  "recipient",
  "location",
  "scope",
  "quoteDate",
  "markup",
  "note",
] as const;
const QUOTE_AUDIT_SELECT = Object.fromEntries(
  QUOTE_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof QUOTE_AUDIT_FIELDS)[number], true>;

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

function paths(chu: ChuBaoGia) {
  revalidatePath(duongDanChu(chu));
  revalidatePath("/quotes");
  if (chu.loai === "CO_HOI") revalidatePath("/khach-hang");
}

/** Chỉ dự án mới có id dự án để ghi vào nhật ký; dự toán ở cơ hội thì chưa có. */
const duAnCuaChu = (chu: ChuBaoGia) => (chu.loai === "DU_AN" ? chu.id : null);

/**
 * Chặn khi thiếu quyền / ngoài phạm vi, và đối chiếu báo giá / phần / dòng có thuộc
 * đúng chủ đó không (mọi id đều đến từ client).
 *
 * Hai nhánh phạm vi vì dự toán sống được ở hai nơi: dự án chặn theo phân công
 * (ProjectMember), cơ hội chặn theo người phụ trách khách. Trục vai trò thì chung một
 * luật "quote/edit" — làm dự toán vẫn là làm dự toán, ở đâu cũng vậy.
 */
async function guard(
  chu: ChuBaoGia,
  opts: { quoteId?: string | null; sectionId?: string | null; itemId?: string | null } = {}
): Promise<ActionResult | null> {
  const khongDuQuyen = "Bạn không có quyền chỉnh sửa báo giá.";
  const denied =
    chu.loai === "DU_AN"
      ? await denyProject("quote", "edit", chu.id, khongDuQuyen)
      : await denyCoHoi("quote", "edit", chu.id, khongDuQuyen);
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
    const q = await db.quote.findUnique({
      where: { id: qid },
      select: { projectId: true, coHoiId: true },
    });
    if (!q || !laCungChu(chu, q)) {
      return { ok: false, error: "Báo giá không thuộc mục này." };
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
  chu: ChuBaoGia,
  quoteId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { quoteId });
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
  const truoc = quoteId
    ? await db.quote.findUnique({ where: { id: quoteId }, select: QUOTE_AUDIT_SELECT })
    : null;
  let qid = quoteId;
  if (qid) await db.quote.update({ where: { id: qid }, data });
  // `duLieuChu` ghi cả hai cột chủ (cột kia là null), nên không có dòng hai chủ.
  else qid = (await db.quote.create({ data: { ...duLieuChu(chu), ...data } })).id;
  await recordAudit({
    actor: await requireSession(),
    entity: "Quote",
    entityId: qid,
    entityLabel: d.title,
    projectId: duAnCuaChu(chu),
    action: quoteId ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, QUOTE_AUDIT_FIELDS),
  });
  paths(chu);
  return { ok: true };
}

export async function deleteQuote(
  chu: ChuBaoGia,
  quoteId: string
): Promise<ActionResult> {
  const g = await guard(chu, { quoteId });
  if (g) return g;
  const truoc = await db.quote.findUnique({
    where: { id: quoteId },
    select: QUOTE_AUDIT_SELECT,
  });
  await db.quote.delete({ where: { id: quoteId } });
  await recordAudit({
    actor: await requireSession(),
    entity: "Quote",
    entityId: quoteId,
    entityLabel: truoc?.title ?? null,
    projectId: duAnCuaChu(chu),
    action: "DELETE",
    changes: diffFields(truoc, null, QUOTE_AUDIT_FIELDS),
  });
  paths(chu);
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
  chu: ChuBaoGia,
  quoteId: string,
  sectionId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { quoteId, sectionId });
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
  paths(chu);
  return { ok: true };
}

export async function deleteSection(
  chu: ChuBaoGia,
  sectionId: string
): Promise<ActionResult> {
  const g = await guard(chu, { sectionId });
  if (g) return g;
  await db.quoteSection.delete({ where: { id: sectionId } });
  paths(chu);
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
  chu: ChuBaoGia,
  quoteId: string,
  itemId: string | null,
  form: FormData
): Promise<ActionResult> {
  const g = await guard(chu, { quoteId, itemId });
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
  paths(chu);
  return { ok: true };
}

export async function deleteItem(
  chu: ChuBaoGia,
  itemId: string
): Promise<ActionResult> {
  const g = await guard(chu, { itemId });
  if (g) return g;
  await db.quoteItem.delete({ where: { id: itemId } });
  paths(chu);
  return { ok: true };
}

// ---------- Clone từ báo giá khác ----------
export async function cloneQuoteFrom(
  chu: ChuBaoGia,
  sourceQuoteId: string,
  markupOverride?: number | null
): Promise<ActionResult> {
  const g = await guard(chu);
  if (g) return g;

  const src = await db.quote.findUnique({
    where: { id: sourceQuoteId },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
      project: { select: { code: true, name: true } },
      coHoi: { select: { tenCongTrinh: true } },
    },
  });
  if (!src) return { ok: false, error: "Không tìm thấy báo giá nguồn." };

  // Bản nguồn ở đâu thì phải được phép vào ĐÚNG chỗ đó. Chép được nghĩa là đọc được
  // toàn bộ đơn giá của bên kia, nên phép kiểm này chặt như lúc mở trang.
  const session = await requireSession();
  const chuNguon = chuCuaQuote(src);
  const vaoDuocNguon =
    chuNguon?.loai === "DU_AN"
      ? await canAccessProject(session, chuNguon.id)
      : chuNguon?.loai === "CO_HOI"
        ? await canAccessCoHoi(session, chuNguon.id)
        : false;
  if (!vaoDuocNguon) {
    return { ok: false, error: "Bạn không được xem báo giá nguồn." };
  }
  const tenNguon = src.project?.code ?? src.coHoi?.tenCongTrinh ?? "bản khác";
  const moTaNguon = src.project
    ? `${src.project.code} ${src.project.name}`
    : (src.coHoi?.tenCongTrinh ?? "công trình chào giá");

  const markup = markupOverride ?? src.markup ?? 1;
  // Bản chép lấy đơn giá thư viện HIỆN HÀNH, không bê nguyên giá của bản nguồn:
  // chép một báo giá từ năm ngoái mà giữ nguyên giá năm ngoái là cái bẫy đắt tiền.
  const priceMap = await banGiaTheoMa();

  // Toàn bộ bản sao (báo giá + phần/mục + dòng) nằm trong 1 giao dịch: đứt giữa
  // chừng sẽ không để lại báo giá rỗng hoặc thiếu dòng.
  await db.$transaction(async (tx) => {
    const newQuote = await tx.quote.create({
      data: {
        ...duLieuChu(chu),
        title: `${src.title} — sao từ ${tenNguon}`,
        recipient: src.recipient,
        location: src.location,
        scope: src.scope,
        markup,
        clonedFromId: src.id,
        note: `Tạo từ báo giá "${src.title}" (${moTaNguon}); đơn giá lấy theo bảng đơn giá hiện tại.`,
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

  paths(chu);
  return { ok: true };
}

// ---------- Cập nhật đơn giá từ catalog ----------
export async function repriceQuote(
  chu: ChuBaoGia,
  quoteId: string
): Promise<ActionResult> {
  const g = await guard(chu, { quoteId });
  if (g) return g;
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  });
  if (!quote) return { ok: false, error: "Không tìm thấy báo giá." };
  const markup = quote.markup ?? 1;
  // Đơn giá thư viện HIỆN HÀNH (theo hôm nay). Từ khi giá có lịch sử, "giá của một
  // công tác" luôn phải kèm câu hỏi "tại thời điểm nào".
  const priceMap = await banGiaTheoMa();

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
  paths(chu);
  return { ok: true };
}

// ---------- Đẩy giá bán sang dự án ----------
export async function pushSalePrice(
  chu: ChuBaoGia,
  quoteId: string
): Promise<ActionResult> {
  const g = await guard(chu, { quoteId });
  if (g) return g;
  // Cơ hội chưa có dự án nào để đẩy giá vào. Chặn ở đây chứ không chỉ ẩn nút: nút ẩn
  // không ngăn được lời gọi thẳng vào action.
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
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { items: { select: { qty: true, sellPrice: true, baseCost: true } } },
  });
  if (!quote) return { ok: false, error: "Không tìm thấy báo giá." };
  const total = computeQuoteTotals(quote.items).sell;
  const truocDA = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, salePrice: true },
  });
  await db.project.update({ where: { id: projectId }, data: { salePrice: total } });
  // Đây là thao tác ghi thẳng vào giá bán dự án — bắt buộc phải có vết.
  await recordAudit({
    actor: await requireSession(),
    entity: "Project",
    entityId: projectId,
    entityLabel: truocDA?.code ?? null,
    projectId,
    action: "UPDATE",
    changes: diffFields(truocDA, { salePrice: total }, ["salePrice"]),
  });
  revalidatePath(`/projects/${projectId}`);
  paths(chu);
  return { ok: true };
}
