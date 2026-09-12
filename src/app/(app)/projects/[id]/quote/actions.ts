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
import {
  DO_KHOP_LABEL,
  chonDonGia,
  type DongGiaUngVien,
} from "@/lib/thuVien/gia";
import {
  dungKhungDuToan,
  locPhanConThieu,
  ropKhoiLuongTheoDienTich,
} from "@/lib/thuVien/boHangMuc";

export type ActionResult = { ok: true } | { ok: false; error: string };

const QUOTE_AUDIT_FIELDS = [
  "title",
  "recipient",
  "location",
  "scope",
  "quoteDate",
  "markup",
  "khuVucId",
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
  // Chỉ trả về NHÁNH LỖI hoặc null, không phải cả `ActionResult`: "chặn thành công"
  // là một khái niệm vô nghĩa, và khai rộng hơn thực tế làm mọi chỗ gọi phải tự ép kiểu.
): Promise<{ ok: false; error: string } | null> {
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
  khuVucId: z.string().trim().optional(),
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
    khuVucId: String(form.get("khuVucId") ?? ""),
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
    khuVucId: d.khuVucId || null,
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

  const chot = await chotGiaThuVien(
    quoteId,
    String(form.get("congTacId") ?? ""),
    String(form.get("congTacVatTuId") ?? ""),
    d.baseCost
  );

  const data = {
    workCode: d.workCode || null,
    name: d.name,
    unit: d.unit || null,
    qty: d.qty,
    baseCost: d.baseCost,
    sellPrice: d.sellPrice,
    spec: d.spec || null,
    note: d.note || null,
    ...chot,
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

// ---------- Đóng băng giá thư viện ----------

/**
 * Ứng viên đơn giá của một công tác, còn hiệu lực tới hôm nay.
 *
 * Tách riêng vì cả `chotGiaThuVien`, `goiYDonGia` và `capNhatGiaTuThuVien` đều cần
 * đúng một câu hỏi này.
 */
async function ungVienGia(congTacIds: string[], ngay: Date): Promise<DongGiaUngVien[]> {
  if (congTacIds.length === 0) return [];
  return db.donGiaCongTac.findMany({
    where: { congTacId: { in: congTacIds }, hieuLucTu: { lte: ngay } },
    select: {
      id: true,
      congTacId: true,
      congTacVatTuId: true,
      khuVucId: true,
      donGia: true,
      hieuLucTu: true,
      createdAt: true,
    },
  });
}

/**
 * Tính bộ giá trị đóng băng cho một dòng sắp lưu.
 *
 * `giaSuaTay` bật khi giá người dùng gõ KHÁC giá thư viện đề xuất. Đây là chỗ duy nhất
 * quyết định cờ đó, và nó suy ra từ con số chứ không từ một ô tích: người dùng sửa giá
 * là đã nói lên ý mình rồi, bắt họ tích thêm một ô nữa chỉ để xác nhận là thừa.
 */
async function chotGiaThuVien(
  quoteId: string,
  congTacIdRaw: string,
  bienTheIdRaw: string,
  baseCost: number | null
) {
  const congTacId = congTacIdRaw || null;
  if (!congTacId) {
    // Dòng gõ tay hoàn toàn: xóa sạch dấu vết thư viện. Nếu không, sửa một dòng từ
    // "chọn từ thư viện" thành "tự nhập" sẽ để lại ảnh chụp cũ và huy hiệu lệch giá
    // đòi cập nhật về một công tác không còn liên quan.
    return {
      congTacId: null,
      congTacVatTuId: null,
      donGiaId: null,
      donGiaThuVien: null,
      chotGiaLuc: null,
      giaSuaTay: false,
    };
  }

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { khuVucId: true },
  });

  // Biến thể phải thuộc đúng công tác — id đến từ client.
  let bienTheId = bienTheIdRaw || null;
  if (bienTheId) {
    const bt = await db.congTacVatTu.findUnique({
      where: { id: bienTheId },
      select: { congTacId: true },
    });
    if (!bt || bt.congTacId !== congTacId) bienTheId = null;
  }

  const ngay = new Date();
  const kq = chonDonGia(await ungVienGia([congTacId], ngay), {
    congTacId,
    congTacVatTuId: bienTheId,
    khuVucId: quote?.khuVucId ?? null,
    ngay,
  });

  return {
    congTacId,
    congTacVatTuId: bienTheId,
    donGiaId: kq.donGiaId,
    donGiaThuVien: kq.donGia,
    chotGiaLuc: ngay,
    giaSuaTay:
      kq.donGia !== null && baseCost !== null && Math.abs(baseCost - kq.donGia) >= 1,
  };
}

export interface GoiYGia {
  donGia: number | null;
  doKhop: string;
  nhan: string;
  canhBao: string[];
}

/**
 * Đơn giá thư viện đề xuất cho một công tác (kèm biến thể) trong bối cảnh của một bản
 * dự toán — tức là theo đúng khu vực của bản đó.
 *
 * Hỏi server thay vì tính ở trình duyệt vì khu vực thuộc về từng BẢN dự toán, mà một
 * trang liệt kê nhiều bản; đẩy hết bảng giá xuống client rồi tự chọn là nhân bản luật
 * chọn giá ra hai nơi.
 */
export async function goiYDonGia(
  chu: ChuBaoGia,
  quoteId: string,
  congTacId: string,
  congTacVatTuId: string | null
): Promise<{ ok: true; goiY: GoiYGia } | { ok: false; error: string }> {
  const g = await guard(chu, { quoteId });
  if (g) return g;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { khuVucId: true },
  });
  const ngay = new Date();
  const kq = chonDonGia(await ungVienGia([congTacId], ngay), {
    congTacId,
    congTacVatTuId,
    khuVucId: quote?.khuVucId ?? null,
    ngay,
  });

  return {
    ok: true,
    goiY: {
      donGia: kq.donGia,
      doKhop: kq.doKhop,
      nhan: DO_KHOP_LABEL[kq.doKhop],
      canhBao: kq.canhBao,
    },
  };
}

/**
 * Kéo đơn giá của các dòng về đúng giá thư viện hiện hành.
 *
 * BỎ QUA dòng người dùng đã sửa tay — cùng ngữ nghĩa với `repriceLines` bỏ qua
 * `priceOverridden` bên báo giá gửi khách, để người dùng chỉ phải học một luật. Muốn
 * kéo cả dòng đã sửa tay thì phải xóa dấu sửa tay trước, đó là một quyết định riêng.
 *
 * `itemIds` rỗng = làm cả bản.
 */
export async function capNhatGiaTuThuVien(
  chu: ChuBaoGia,
  quoteId: string,
  itemIds?: string[]
): Promise<ActionResult> {
  const g = await guard(chu, { quoteId });
  if (g) return g;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { markup: true, khuVucId: true },
  });
  if (!quote) return { ok: false, error: "Không tìm thấy báo giá." };
  const markup = quote.markup ?? 1;

  const items = await db.quoteItem.findMany({
    where: {
      quoteId,
      giaSuaTay: false,
      // Dòng cũ chỉ có `workCode` (chuỗi mã) chứ chưa gắn `congTacId` — vẫn phải cập
      // nhật được, nếu không thì 72 dòng lập trước khi có thư viện bị bỏ rơi vĩnh viễn.
      OR: [{ congTacId: { not: null } }, { workCode: { not: null } }],
      ...(itemIds && itemIds.length > 0 ? { id: { in: itemIds } } : {}),
    },
    select: {
      id: true,
      congTacId: true,
      congTacVatTuId: true,
      workCode: true,
      baseCost: true,
    },
  });
  if (items.length === 0) return { ok: true };

  // Bắc cầu từ mã sang id cho những dòng chưa gắn công tác.
  const maCanTra = items.filter((it) => !it.congTacId && it.workCode).map((it) => it.workCode!);
  const theoMa = new Map(
    maCanTra.length === 0
      ? []
      : (
          await db.congTac.findMany({
            where: { ma: { in: maCanTra } },
            select: { id: true, ma: true },
          })
        ).map((c) => [c.ma, c.id] as const)
  );

  const congTacCuaDong = new Map(
    items
      .map((it) => [it.id, it.congTacId ?? (it.workCode ? theoMa.get(it.workCode) : null)] as const)
      .filter((x): x is readonly [string, string] => Boolean(x[1]))
  );
  if (congTacCuaDong.size === 0) return { ok: true };

  const ngay = new Date();
  const ungVien = await ungVienGia([...new Set(congTacCuaDong.values())], ngay);

  const capNhat = [];
  for (const it of items) {
    const congTacId = congTacCuaDong.get(it.id);
    if (!congTacId) continue; // mã tự nhập, không có trong thư viện
    const kq = chonDonGia(ungVien, {
      congTacId,
      congTacVatTuId: it.congTacVatTuId,
      khuVucId: quote.khuVucId,
      ngay,
    });
    if (kq.donGia === null) continue; // thư viện không còn giá -> để nguyên
    capNhat.push(
      db.quoteItem.update({
        where: { id: it.id },
        data: {
          baseCost: kq.donGia,
          sellPrice: sellFromBase(kq.donGia, markup),
          // Gắn luôn công tác cho dòng cũ: từ lần này nó có ảnh chụp đầy đủ và tra
          // ngược về thư viện được, thay vì mãi khớp bằng chuỗi mã.
          congTacId,
          donGiaId: kq.donGiaId,
          donGiaThuVien: kq.donGia,
          chotGiaLuc: ngay,
        },
      })
    );
  }

  // Một giao dịch: đứt giữa chừng sẽ để lại báo giá nửa giá cũ nửa giá mới.
  if (capNhat.length > 0) await db.$transaction(capNhat);
  paths(chu);
  return { ok: true };
}

/** Xóa dấu "đã sửa tay" để dòng này lại theo thư viện. */
export async function boDauSuaTay(
  chu: ChuBaoGia,
  itemId: string
): Promise<ActionResult> {
  const g = await guard(chu, { itemId });
  if (g) return g;
  await db.quoteItem.update({ where: { id: itemId }, data: { giaSuaTay: false } });
  paths(chu);
  return { ok: true };
}

// ---------- Áp bộ hạng mục chuẩn ----------

/**
 * Dựng sẵn cây phần/mục và các dòng công tác của một bộ hạng mục vào một bản dự toán.
 *
 * Đây là thứ tiết kiệm thời gian nhất cho người lập: chọn loại công trình một phát là
 * có khung, chỉ còn điền khối lượng.
 *
 * Hai điều cố ý:
 *
 * - CHỈ ÁP VÀO BẢN CÒN RỖNG. Trộn một bộ vào bản đã có dòng sẽ sinh phần trùng mã và
 *   không ai đoán được kết quả; muốn thêm thì tạo bản mới rồi chép.
 * - Đơn giá lấy từ THƯ VIỆN theo khu vực của bản, không lấy `donGiaMacDinh` của bộ —
 *   giá trong bộ là con số soạn từ lâu, còn thư viện mới là nguồn đang sống. Dòng nào
 *   thư viện chưa có giá thì mới rơi về số mặc định của bộ.
 */
/**
 * Diện tích của một phần, đã gạn số rác.
 *
 * Diện tích ≤ 0 coi như chưa khai: nó là MẪU SỐ của đơn giá m², và một số 0 lọt vào
 * đó cho ra Infinity trên bản báo giá gửi khách.
 */
function dienTichCua(bang: Record<string, number | null>, ma: string): number | null {
  const v = bang[ma];
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

/** Một phần sẽ được dựng, kèm số dòng công tác — để người lập nhập diện tích trước. */
export interface PhanSeThem {
  ma: string;
  ten: string;
  soDong: number;
  /** Số dòng có suất khối lượng — nhập diện tích là chúng tự điền khối lượng. */
  soDongCoSuat: number;
}

export interface XemTruocApBo {
  phanSeThem: PhanSeThem[];
  /** Mã phần bản dự toán đã có — giữ nguyên, không áp đè. */
  phanBoQua: string[];
  canhBao: string[];
}

/**
 * Nạp bộ hạng mục và lọc ra phần bản dự toán CHƯA có.
 *
 * Dùng chung cho bước xem trước và bước ghi, để hai bên không thể nói hai chuyện khác
 * nhau: người dùng nhập diện tích cho đúng những phần mà lúc ghi sẽ được tạo.
 */
async function khungConThieu(quoteId: string, boHangMucId: string) {
  const [quote, bo, phanDaCo] = await Promise.all([
    db.quote.findUnique({
      where: { id: quoteId },
      select: { markup: true, khuVucId: true },
    }),
    db.boHangMuc.findUnique({
      where: { id: boHangMucId },
      include: {
        phan: { orderBy: { sortOrder: "asc" } },
        dong: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.quoteSection.findMany({ where: { quoteId }, select: { code: true } }),
  ]);
  if (!quote) return { ok: false as const, error: "Không tìm thấy bản dự toán." };
  if (!bo) return { ok: false as const, error: "Không tìm thấy bộ hạng mục." };

  const day = dungKhungDuToan(bo.phan, bo.dong);
  if (day.phan.length === 0) {
    return { ok: false as const, error: "Bộ hạng mục này chưa khai phần nào." };
  }

  const loc = locPhanConThieu(day, phanDaCo.map((s) => s.code));
  if (loc.khung.phan.length === 0) {
    return {
      ok: false as const,
      error: "Bản dự toán đã có đủ các phần của bộ này — không còn gì để thêm.",
    };
  }
  return {
    ok: true as const,
    quote,
    bo: { ma: bo.ma, ten: bo.ten },
    khung: loc.khung,
    boQua: loc.boQua,
  };
}

export async function xemTruocApBoHangMuc(
  chu: ChuBaoGia,
  quoteId: string,
  boHangMucId: string
): Promise<{ ok: true; data: XemTruocApBo } | { ok: false; error: string }> {
  const g = await guard(chu, { quoteId });
  if (g) return g;

  const n = await khungConThieu(quoteId, boHangMucId);
  if (!n.ok) return { ok: false, error: n.error };

  const soDongTheoPhan = new Map<string, number>();
  const soSuatTheoPhan = new Map<string, number>();
  for (const d of n.khung.dong) {
    soDongTheoPhan.set(d.phanMa, (soDongTheoPhan.get(d.phanMa) ?? 0) + 1);
    if (d.suatKhoiLuong != null) {
      soSuatTheoPhan.set(d.phanMa, (soSuatTheoPhan.get(d.phanMa) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    data: {
      phanSeThem: n.khung.phan.map((p) => ({
        ma: p.ma,
        ten: p.ten,
        soDong: soDongTheoPhan.get(p.ma) ?? 0,
        soDongCoSuat: soSuatTheoPhan.get(p.ma) ?? 0,
      })),
      phanBoQua: n.boQua,
      canhBao: n.khung.canhBao,
    },
  };
}

export async function apBoHangMucVaoDuToan(
  chu: ChuBaoGia,
  quoteId: string,
  boHangMucId: string,
  /**
   * Diện tích từng phần, khóa theo mã phần. Đây là mẫu số của đơn giá m² trên bản gửi
   * khách — mái, vách và canopy mỗi thứ một diện tích khác nhau, nên hỏi ngay lúc áp
   * bộ rẻ hơn nhiều so với mở lại từng phần sau đó.
   */
  dienTich: Record<string, number | null> = {}
): Promise<{ ok: true; soPhan: number; soDong: number; canhBao: string[] } | { ok: false; error: string }> {
  const g = await guard(chu, { quoteId });
  if (g) return g;

  const n = await khungConThieu(quoteId, boHangMucId);
  if (!n.ok) return { ok: false, error: n.error };
  const { quote, bo, khung } = n;

  // Phần mới xếp SAU phần đang có, để áp bộ vào bản đã có nội dung không xáo trộn
  // thứ tự người lập đã dựng.
  const daCo = await db.quoteSection.count({ where: { quoteId } });

  // Thư viện khối lượng: dòng nào có suất thì khối lượng = suất × diện tích phần.
  // Đây chính là lý do hỏi diện tích ngay lúc áp bộ — nó vừa là mẫu số của đơn giá
  // m² gửi khách, vừa là số nhân để điền sẵn khối lượng.
  const dongCoKhoiLuong = ropKhoiLuongTheoDienTich(khung.dong, dienTich);

  const markup = quote.markup ?? 1;
  const ngay = new Date();
  const congTacIds = [...new Set(khung.dong.map((d) => d.congTacId).filter((x): x is string => !!x))];
  const ungVien = await ungVienGia(congTacIds, ngay);

  await db.$transaction(async (tx) => {
    // Tạo phần gốc trước rồi mới tới mục con: mục con cần id của cha, mà id chỉ có
    // sau khi cha được ghi.
    const idCuaMa = new Map<string, string>();
    for (const p of khung.phan.filter((x) => !x.maCha)) {
      const tao = await tx.quoteSection.create({
        data: {
          quoteId,
          code: p.ma,
          name: p.ten,
          kind: "PHAN",
          area: dienTichCua(dienTich, p.ma),
          sortOrder: daCo + p.sortOrder,
        },
      });
      idCuaMa.set(p.ma, tao.id);
    }
    for (const p of khung.phan.filter((x) => x.maCha)) {
      const tao = await tx.quoteSection.create({
        data: {
          quoteId,
          code: p.ma,
          name: p.ten,
          kind: "SUB",
          parentId: idCuaMa.get(p.maCha!) ?? null,
          area: dienTichCua(dienTich, p.ma),
          sortOrder: daCo + p.sortOrder,
        },
      });
      idCuaMa.set(p.ma, tao.id);
    }

    for (const d of dongCoKhoiLuong) {
      const sectionId = idCuaMa.get(d.phanMa);
      if (!sectionId) continue; // dungKhungDuToan đã lọc, đây là lưới an toàn
      const kq = d.congTacId
        ? chonDonGia(ungVien, {
            congTacId: d.congTacId,
            congTacVatTuId: d.congTacVatTuId,
            khuVucId: quote.khuVucId,
            ngay,
          })
        : null;
      const giaVon = kq?.donGia ?? d.donGia;
      await tx.quoteItem.create({
        data: {
          quoteId,
          sectionId,
          workCode: d.maCongTac,
          name: d.ten,
          unit: d.donVi,
          qty: d.qty,
          baseCost: giaVon,
          sellPrice: giaVon === null ? null : sellFromBase(giaVon, markup),
          sortOrder: d.sortOrder,
          congTacId: d.congTacId,
          congTacVatTuId: d.congTacVatTuId,
          donGiaId: kq?.donGiaId ?? null,
          donGiaThuVien: kq?.donGia ?? null,
          chotGiaLuc: kq?.donGia == null ? null : ngay,
        },
      });
    }
  });

  await recordAudit({
    actor: await requireSession(),
    entity: "Quote",
    entityId: quoteId,
    entityLabel: bo.ten,
    projectId: duAnCuaChu(chu),
    action: "UPDATE",
    changes: {
      boHangMuc: { truoc: null, sau: `${bo.ma} — ${bo.ten}` },
    },
  });

  paths(chu);
  return {
    ok: true,
    soPhan: khung.phan.length,
    soDong: khung.dong.length,
    canhBao: khung.canhBao,
  };
}
