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
import { napCongTacCoGia } from "@/lib/thuVien/napGia";
import type { CatalogOption, QuoteView } from "./types";

export async function napDuLieuBaoGia(
  session: SessionUser,
  chu: ChuBaoGia
): Promise<{ quotes: QuoteView[]; catalog: CatalogOption[]; cloneSources: CloneSourceRow[] }> {
  // Thư viện trả về đơn giá HIỆN HÀNH, chỉ để gợi ý cho dòng sắp thêm. Dòng đã có
  // trong báo giá không bị đụng tới — chúng giữ đơn giá đã chốt lúc lập.
  const [rawQuotes, congTacs, cloneSources] = await Promise.all([
    db.quote.findMany({
      where: whereCuaChu(chu),
      orderBy: { createdAt: "desc" },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        items: { orderBy: { sortOrder: "asc" } },
        clonedFrom: { select: { title: true } },
      },
    }),
    napCongTacCoGia(),
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

  const catalog: CatalogOption[] = congTacs.map((c) => ({
    code: c.ma,
    name: c.ten,
    unit: c.donVi,
    baseCost: c.donGia,
  }));

  return { quotes, catalog, cloneSources };
}
