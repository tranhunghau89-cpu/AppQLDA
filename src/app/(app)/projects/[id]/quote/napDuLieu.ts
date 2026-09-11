// Nạp dữ liệu cho trang dự toán chi tiết — dùng chung cho trang ở dự án và ở cơ hội.
//
// Hai trang chỉ khác nhau ở phần đầu (tên, diện tích, đường quay lại). Phần còn lại —
// danh sách bản dự toán, bảng đơn giá, nguồn chép — giống hệt, nên để một chỗ: sửa
// cách đọc mà quên một bên là cách sinh ra hai màn hình lệch nhau.
import "server-only";
import { db } from "@/lib/db";
import { nguonCloneBaoGia, type CloneSourceRow } from "@/lib/quoteCloneSources";
import type { ChuBaoGia } from "@/lib/quoteOwner";
import { whereCuaChu } from "@/lib/quoteOwner";
import type { SessionUser } from "@/lib/session";
import type { CatalogOption, QuoteView } from "./types";

export async function napDuLieuBaoGia(
  session: SessionUser,
  chu: ChuBaoGia
): Promise<{ quotes: QuoteView[]; catalog: CatalogOption[]; cloneSources: CloneSourceRow[] }> {
  const [rawQuotes, catalogRows, cloneSources] = await Promise.all([
    db.quote.findMany({
      where: whereCuaChu(chu),
      orderBy: { createdAt: "desc" },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        items: { orderBy: { sortOrder: "asc" } },
        clonedFrom: { select: { title: true } },
      },
    }),
    db.workPrice.findMany({
      orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }],
      select: { code: true, name: true, unit: true, baseCost: true },
    }),
    // Chép được từ mọi bản dự toán trong phạm vi — dự án được phân công lẫn cơ hội của
    // khách mình phụ trách.
    nguonCloneBaoGia(session),
  ]);

  const quotes: QuoteView[] = rawQuotes.map((q) => ({
    id: q.id,
    title: q.title,
    recipient: q.recipient,
    location: q.location,
    scope: q.scope,
    quoteDate: q.quoteDate ? q.quoteDate.toISOString() : null,
    markup: q.markup,
    note: q.note,
    clonedFromTitle: q.clonedFrom?.title ?? null,
    sections: q.sections.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      kind: s.kind,
      parentId: s.parentId,
      area: s.area,
    })),
    items: q.items.map((it) => ({
      id: it.id,
      sectionId: it.sectionId,
      workCode: it.workCode,
      name: it.name,
      unit: it.unit,
      qty: it.qty,
      baseCost: it.baseCost,
      sellPrice: it.sellPrice,
      spec: it.spec,
      note: it.note,
    })),
  }));

  const catalog: CatalogOption[] = catalogRows.map((c) => ({
    code: c.code,
    name: c.name,
    unit: c.unit,
    baseCost: c.baseCost,
  }));

  return { quotes, catalog, cloneSources };
}
