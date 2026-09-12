// Nạp dữ liệu cho trang dự toán chào giá — dùng chung cho trang ở dự án và ở cơ hội.
//
// Hai trang chỉ khác nhau ở phần đầu (tên, diện tích, đường quay lại). Phần còn lại —
// danh sách bản dự toán, thư viện công tác, nguồn chép — giống hệt, nên để một chỗ:
// sửa cách đọc mà quên một bên là cách sinh ra hai màn hình lệch nhau.
import "server-only";
import { db } from "@/lib/db";
import { nguonCloneBaoGia, type CloneSourceRow } from "@/lib/quoteCloneSources";
import type { ChuBaoGia } from "@/lib/quoteOwner";
import { whereCuaChu } from "@/lib/quoteOwner";
import type { SessionUser } from "@/lib/session";
import { chonDonGia, phatHienTroiGia, type DongGiaUngVien } from "@/lib/thuVien/gia";
import type { CatalogOption, QuoteView } from "./types";

export async function napDuLieuBaoGia(
  session: SessionUser,
  chu: ChuBaoGia
): Promise<{
  quotes: QuoteView[];
  catalog: CatalogOption[];
  cloneSources: CloneSourceRow[];
  khuVucs: { id: string; ma: string; ten: string }[];
  boHangMucs: { id: string; ma: string; ten: string; loaiCongTrinh: string | null; soPhan: number; soDong: number }[];
}> {
  const ngay = new Date();

  const [rawQuotes, congTacs, banGias, khuVucs, boRows, cloneSources] = await Promise.all([
    db.quote.findMany({
      where: whereCuaChu(chu),
      orderBy: { createdAt: "desc" },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            bienThe: {
              select: { tenBienThe: true, vatTu: { select: { ten: true } } },
            },
          },
        },
        khuVuc: { select: { ten: true } },
        clonedFrom: { select: { title: true } },
      },
    }),
    db.congTac.findMany({
      where: { active: true },
      orderBy: [{ nhomMa: "asc" }, { sortOrder: "asc" }, { ma: "asc" }],
      select: {
        id: true,
        ma: true,
        ten: true,
        donVi: true,
        bienThe: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            tenBienThe: true,
            laMacDinh: true,
            vatTu: { select: { ten: true } },
          },
        },
      },
    }),
    // MỘT truy vấn cho toàn bộ bản giá còn hiệu lực, rồi chọn trong bộ nhớ. Hỏi giá
    // từng dòng một là hàng trăm lượt đi về cơ sở dữ liệu cho một lần tải trang.
    db.donGiaCongTac.findMany({
      where: { hieuLucTu: { lte: ngay } },
      select: {
        id: true,
        congTacId: true,
        congTacVatTuId: true,
        khuVucId: true,
        donGia: true,
        hieuLucTu: true,
        createdAt: true,
      },
    }),
    db.khuVuc.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
      select: { id: true, ma: true, ten: true },
    }),
    db.boHangMuc.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
      select: {
        id: true,
        ma: true,
        ten: true,
        loaiCongTrinh: true,
        _count: { select: { phan: true, dong: true } },
      },
    }),
    // Chép được từ mọi bản dự toán trong phạm vi — dự án được phân công lẫn cơ hội của
    // khách mình phụ trách.
    nguonCloneBaoGia(session),
  ]);

  const theoCongTac = new Map<string, DongGiaUngVien[]>();
  for (const g of banGias) {
    const ds = theoCongTac.get(g.congTacId);
    if (ds) ds.push(g);
    else theoCongTac.set(g.congTacId, [g]);
  }

  const quotes: QuoteView[] = rawQuotes.map((q) => ({
    id: q.id,
    title: q.title,
    recipient: q.recipient,
    location: q.location,
    scope: q.scope,
    quoteDate: q.quoteDate ? q.quoteDate.toISOString() : null,
    markup: q.markup,
    note: q.note,
    khuVucId: q.khuVucId,
    khuVucTen: q.khuVuc?.ten ?? null,
    clonedFromTitle: q.clonedFrom?.title ?? null,
    sections: q.sections.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      kind: s.kind,
      parentId: s.parentId,
      area: s.area,
    })),
    items: q.items.map((it) => {
      // Giá thư viện HIỆN HÀNH cho đúng tổ hợp mà dòng này đã chốt, tra theo khu vực
      // của bản dự toán. Dòng gõ tay (không gắn công tác) thì không có gì để so.
      const hienHanh = it.congTacId
        ? chonDonGia(theoCongTac.get(it.congTacId) ?? [], {
            congTacId: it.congTacId,
            congTacVatTuId: it.congTacVatTuId,
            khuVucId: q.khuVucId,
            ngay,
          }).donGia
        : null;
      return {
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
        layTuThamSo: it.layTuThamSo,
        congTacId: it.congTacId,
        congTacVatTuId: it.congTacVatTuId,
        bienTheTen: it.bienThe
          ? (it.bienThe.tenBienThe ?? it.bienThe.vatTu.ten)
          : null,
        donGiaThuVien: it.donGiaThuVien,
        giaSuaTay: it.giaSuaTay,
        donGiaHienHanh: hienHanh,
        coTroiGia: phatHienTroiGia(it.donGiaThuVien, hienHanh).coTroi,
      };
    }),
  }));

  const catalog: CatalogOption[] = congTacs.map((c) => ({
    code: c.ma,
    congTacId: c.id,
    name: c.ten,
    unit: c.donVi,
    baseCost: chonDonGia(theoCongTac.get(c.id) ?? [], { congTacId: c.id, ngay }).donGia,
    bienThe: c.bienThe.map((b) => ({
      id: b.id,
      ten: b.tenBienThe ?? b.vatTu.ten,
      laMacDinh: b.laMacDinh,
    })),
  }));

  const boHangMucs = boRows.map((b) => ({
    id: b.id,
    ma: b.ma,
    ten: b.ten,
    loaiCongTrinh: b.loaiCongTrinh,
    soPhan: b._count.phan,
    soDong: b._count.dong,
  }));

  return { quotes, catalog, cloneSources, khuVucs, boHangMucs };
}
