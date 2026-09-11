import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { myProjectIds } from "@/lib/scope";
import { getReceivables } from "@/lib/debt";
import { CustomerManager } from "./CustomerManager";
import type { NoteView } from "@/components/crm/InteractionLog";

export default async function CustomersPage() {
  const session = await requireView("customer");
  const canEdit = can(session.role, "customer", "edit");
  const canViewDebt = can(session.role, "debt", "view");

  const [customers, receivables, notes] = await Promise.all([
    db.customer.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
    canViewDebt ? getReceivables(await myProjectIds(session)) : Promise.resolve([]),
    // Nhật ký trao đổi của mọi CĐT trong một truy vấn rồi gom theo CĐT — rẻ hơn N+1.
    // Chặn 500 dòng: trang này chỉ để xem lại gần đây, không phải kho lưu trữ.
    db.customerNote.findMany({
      // Chỉ ghi chép treo ở CĐT. Ghi chép của khách đang chào giá nằm bên /khach-hang.
      where: { customerId: { not: null } },
      orderBy: { contactDate: "desc" },
      take: 500,
      include: { clientQuote: { select: { quoteNo: true, title: true } } },
    }),
  ]);

  const debtMap = new Map(receivables.map((r) => [r.customerId, r]));

  const noteMap = new Map<string, NoteView[]>();
  for (const n of notes) {
    if (!n.customerId) continue;
    const ds = noteMap.get(n.customerId) ?? [];
    ds.push({
      id: n.id,
      kind: n.kind,
      contactDate: n.contactDate.toISOString(),
      content: n.content,
      authorName: n.authorName,
      nextFollowUpDate: n.nextFollowUpDate?.toISOString() ?? null,
      quoteLabel: n.clientQuote
        ? n.clientQuote.quoteNo ?? n.clientQuote.title
        : null,
    });
    noteMap.set(n.customerId, ds);
  }

  const rows = customers.map((c) => {
    const d = debtMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      contactPerson: c.contactPerson,
      phone: c.phone,
      address: c.address,
      note: c.note,
      projectCount: c._count.projects,
      notes: noteMap.get(c.id) ?? [],
      receivable: d?.totalReceivable ?? null,
      debtProjects:
        d?.projects.map((p) => ({
          projectId: p.projectId,
          label: `${p.code} · ${p.name}`,
          receivable: p.receivable,
        })) ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Chủ đầu tư</h1>
        <p className="text-sm text-slate-500">Quản lý thông tin chủ đầu tư / khách hàng</p>
      </div>
      <CustomerManager customers={rows} canEdit={canEdit} canViewDebt={canViewDebt} />
    </div>
  );
}
