import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getReceivables } from "@/lib/debt";
import { CustomerManager } from "./CustomerManager";

export default async function CustomersPage() {
  const session = await requireView("customer");
  const canEdit = can(session.role, "customer", "edit");
  const canViewDebt = can(session.role, "debt", "view");

  const [customers, receivables] = await Promise.all([
    db.customer.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
    canViewDebt ? getReceivables() : Promise.resolve([]),
  ]);

  const debtMap = new Map(receivables.map((r) => [r.customerId, r]));

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
