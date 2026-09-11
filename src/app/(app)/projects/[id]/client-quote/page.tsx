import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { ClientQuoteEditor } from "./ClientQuoteEditor";
import type { ClientQuoteView, CustomerOption } from "./types";

export default async function ClientQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireProjectView("quote", id);
  const canEdit = can(session.role as Role, "quote", "edit");

  // 3 truy vấn độc lập -> chạy song song (guard phân quyền đã xong ở trên).
  const [project, rawQuotes, customers] = await Promise.all([
    db.project.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        location: true,
        buildingType: true,
        area: true,
        customerId: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    }),
    db.clientQuote.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        specs: { orderBy: { sortOrder: "asc" } },
        stages: { orderBy: { sortOrder: "asc" } },
        payments: { orderBy: { sortOrder: "asc" } },
        derivedFrom: { select: { title: true } },
        clonedFrom: { select: { title: true } },
      },
    }),
    db.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, contactPerson: true, phone: true },
    }),
  ]);
  if (!project) notFound();

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
      sourceSectionId: l.sourceSectionId,
      priceOverridden: l.priceOverridden,
      steelFrameKey: l.steelFrameKey,
    })),
    specs: q.specs.map((sp) => ({
      id: sp.id,
      groupCode: sp.groupCode,
      name: sp.name,
      spec: sp.spec,
      origin: sp.origin,
    })),
    stages: q.stages.map((st) => ({ id: st.id, name: st.name, days: st.days })),
    payments: q.payments.map((p) => ({
      id: p.id,
      label: p.label,
      percent: p.percent,
      basis: p.basis,
      note: p.note,
    })),
  }));

  const customerOptions: CustomerOption[] = customers;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Báo giá gửi khách — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">
            Báo giá theo hạng mục (m²)
            {project.location ? ` · ${project.location}` : ""}
            {project.area ? ` · ${project.area} m²` : ""}
          </p>
        </div>
        <Link
          href={`/projects/${project.id}/quote`}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          <Receipt className="h-4 w-4" /> Báo giá chi tiết
        </Link>
      </div>

      <ClientQuoteEditor
        projectId={project.id}
        quotes={quotes}
        customers={customerOptions}
        canEdit={canEdit}
        goiY={{
          customerId: project.customerId,
          recipient: project.customer?.name ?? null,
          customerPhone: project.customer?.phone ?? null,
          location: project.location,
          salesName: session.name,
          salesEmail: session.email,
        }}
      />
    </div>
  );
}
