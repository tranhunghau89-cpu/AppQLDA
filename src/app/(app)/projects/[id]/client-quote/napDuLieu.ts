// Nạp dữ liệu cho trang báo giá gửi khách — dùng chung cho trang ở dự án và ở cơ hội.
//
// Cùng lý do với napDuLieu bên báo giá chi tiết: hai trang chỉ khác phần đầu, còn danh
// sách bản báo giá thì giống hệt. Bản đồ Date -> chuỗi ISO này dài và dễ sót một trường
// nếu chép làm hai.
import "server-only";
import { db } from "@/lib/db";
import { whereCuaChu, type ChuBaoGia } from "@/lib/quoteOwner";
import type { ClientQuoteView, CustomerOption } from "./types";

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
