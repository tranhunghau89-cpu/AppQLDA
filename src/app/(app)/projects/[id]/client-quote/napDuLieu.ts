// Nạp dữ liệu cho trang báo giá gửi khách — dùng chung cho trang ở dự án và ở cơ hội.
//
// Cùng lý do với napDuLieu bên báo giá chi tiết: hai trang chỉ khác phần đầu, còn danh
// sách bản báo giá thì giống hệt. Bản đồ Date -> chuỗi ISO này dài và dễ sót một trường
// nếu chép làm hai.
import "server-only";
import { db } from "@/lib/db";
import { whereCuaChu, type ChuBaoGia } from "@/lib/quoteOwner";
import { lineCost, sectionSubtotals } from "@/lib/quote";
import type { ClientQuoteView, CustomerOption, GiaVonPhan } from "./types";

/**
 * Giá vốn từng phần của bản dự toán đã sinh ra bản gửi khách.
 *
 * Đây là thứ nhân viên kinh doanh cần để quyết định giá bán: biết một m² mái tốn bao
 * nhiêu tiền vốn thì mới biết bán bao nhiêu là đủ lãi. Con số tính tại chỗ từ các dòng
 * công tác, KHÔNG lưu cứng — lưu thì nó ôi ngay lần đầu ai đó sửa một dòng.
 *
 * Một truy vấn cho tất cả bản dự toán nguồn, không phải một truy vấn mỗi bản.
 */
async function napGiaVonTheoPhan(quoteIds: readonly string[]): Promise<Map<string, GiaVonPhan[]>> {
  const ids = [...new Set(quoteIds)];
  if (ids.length === 0) return new Map();

  const quotes = await db.quote.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sections: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, code: true, name: true, area: true, parentId: true },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        select: { sectionId: true, name: true, unit: true, qty: true, baseCost: true },
      },
    },
  });

  const ra = new Map<string, GiaVonPhan[]>();
  for (const q of quotes) {
    // Dùng lại phép leo cây của sectionSubtotals, chỉ đổi con số sang GIÁ VỐN — dòng
    // nằm trong mục con vẫn phải cộng về phần gốc.
    const tong = sectionSubtotals(
      q.sections.map((s) => ({ id: s.id, parentId: s.parentId })),
      q.items.map((i) => ({
        sectionId: i.sectionId,
        qty: i.qty,
        baseCost: i.baseCost,
        sellPrice: null,
      })),
      lineCost
    );

    // Dòng chi tiết gom về phần GỐC, để bảng bung ra khớp với con số tổng ở trên.
    const chaCua = new Map(q.sections.map((s) => [s.id, s.parentId]));
    const goc = (id: string) => {
      let cur: string | null = id;
      for (let i = 0; cur != null && i <= q.sections.length; i++) {
        const cha: string | null | undefined = chaCua.get(cur);
        if (cha === undefined) return null;
        if (cha === null) return cur;
        cur = cha;
      }
      return null;
    };

    const dongCua = new Map<string, GiaVonPhan["dong"]>();
    for (const i of q.items) {
      const g = goc(i.sectionId);
      if (!g) continue;
      const ds = dongCua.get(g) ?? [];
      ds.push({
        ten: i.name,
        donVi: i.unit,
        qty: i.qty,
        donGia: i.baseCost,
        thanhTien: lineCost({ qty: i.qty, baseCost: i.baseCost, sellPrice: null }),
      });
      dongCua.set(g, ds);
    }

    ra.set(
      q.id,
      q.sections
        .filter((s) => !s.parentId)
        .map((s) => {
          const tongGiaVon = tong.get(s.id) ?? 0;
          const dt = s.area;
          return {
            sectionId: s.id,
            ma: s.code,
            ten: s.name,
            dienTich: dt,
            tongGiaVon,
            // Diện tích thiếu hoặc ≤ 0 thì KHÔNG suy — không để lọt Infinity vào một
            // con số người ta sẽ dựa vào để định giá bán.
            giaVonM2: dt != null && dt > 0 ? tongGiaVon / dt : null,
            dong: dongCua.get(s.id) ?? [],
          };
        })
    );
  }
  return ra;
}

export async function napDuLieuBaoGiaKhach(
  chu: ChuBaoGia,
  canViewCrm: boolean
): Promise<{ quotes: ClientQuoteView[]; customers: CustomerOption[] }> {
  const [rawQuotes, customers] = await Promise.all([
    db.clientQuote.findMany({
      where: whereCuaChu(chu),
      orderBy: { createdAt: "desc" },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        specs: { orderBy: { sortOrder: "asc" } },
        stages: { orderBy: { sortOrder: "asc" } },
        payments: { orderBy: { sortOrder: "asc" } },
        contacts: { orderBy: { contactDate: "desc" }, take: 50 },
        derivedFrom: { select: { title: true } },
        clonedFrom: { select: { title: true } },
      },
    }),
    db.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, contactPerson: true, phone: true },
    }),
  ]);

  // Giá vốn của các bản dự toán nguồn — một truy vấn cho cả trang.
  const giaVonCua = await napGiaVonTheoPhan(
    rawQuotes.map((q) => q.derivedFromId).filter((x): x is string => !!x)
  );

  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  const quotes: ClientQuoteView[] = rawQuotes.map((q) => ({
    id: q.id,
    quoteNo: q.quoteNo,
    title: q.title,
    quoteDate: iso(q.quoteDate),
    customerId: q.customerId,
    recipient: q.recipient,
    customerPhone: q.customerPhone,
    location: q.location,
    scope: q.scope,
    salesName: q.salesName,
    salesPhone: q.salesPhone,
    salesEmail: q.salesEmail,
    status: q.status,
    sentDate: iso(q.sentDate),
    validDays: q.validDays,
    expiryDate: iso(q.expiryDate),
    vatPercent: q.vatPercent,
    warrantyMonths: q.warrantyMonths,
    maintenanceMonths: q.maintenanceMonths,
    loadRoof: q.loadRoof,
    loadHanging: q.loadHanging,
    loadFloor: q.loadFloor,
    lineDetail: q.lineDetail,
    greeting: q.greeting,
    closing: q.closing,
    colorNote: q.colorNote,
    volumeNote: q.volumeNote,
    excludeNote: q.excludeNote,
    note: q.note,
    derivedFromTitle: q.derivedFrom?.title ?? null,
    giaVon: q.derivedFromId ? (giaVonCua.get(q.derivedFromId) ?? []) : [],
    clonedFromTitle: q.clonedFrom?.title ?? null,
    lines: q.lines.map((l) => ({
      id: l.id,
      partCode: l.partCode,
      partName: l.partName,
      code: l.code,
      name: l.name,
      detail: l.detail,
      unit: l.unit,
      qty: l.qty,
      unitPrice: l.unitPrice,
      amount: l.amount,
      note: l.note,
      tags: l.tags,
      sourceSectionId: l.sourceSectionId,
      priceOverridden: l.priceOverridden,
      steelFrameKey: l.steelFrameKey,
    })),
    specs: q.specs.map((sp) => ({
      id: sp.id,
      groupCode: sp.groupCode,
      tag: sp.tag,
      name: sp.name,
      spec: sp.spec,
      origin: sp.origin,
      inDescription: sp.inDescription,
    })),
    stages: q.stages.map((st) => ({ id: st.id, name: st.name, days: st.days })),
    // Không có quyền xem CĐT thì không gửi dữ liệu xuống trình duyệt, chứ không chỉ ẩn
    // bằng CSS.
    contacts: canViewCrm
      ? q.contacts.map((n) => ({
          id: n.id,
          kind: n.kind,
          contactDate: n.contactDate.toISOString(),
          content: n.content,
          authorName: n.authorName,
          nextFollowUpDate: iso(n.nextFollowUpDate),
        }))
      : [],
    payments: q.payments.map((p) => ({
      id: p.id,
      label: p.label,
      percent: p.percent,
      basis: p.basis,
      note: p.note,
    })),
  }));

  return { quotes, customers };
}
