import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getPayables } from "@/lib/debt";
import { SupplierManager } from "./SupplierManager";

export default async function SuppliersPage() {
  const session = await requireView("supplier");
  const canEdit = can(session.role, "supplier", "edit");
  const canViewDebt = can(session.role, "debt", "view");

  const [suppliers, payables] = await Promise.all([
    db.supplier.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { projectLinks: true, estimateItems: true } },
      },
    }),
    canViewDebt ? getPayables() : Promise.resolve([]),
  ]);

  const debtMap = new Map(payables.filter((p) => p.supplierId).map((p) => [p.supplierId, p]));

  const rows = suppliers.map((s) => {
    const d = debtMap.get(s.id);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      contactPerson: s.contactPerson,
      phone: s.phone,
      note: s.note,
      usageCount: s._count.projectLinks + s._count.estimateItems,
      payable: d?.totalPayable ?? null,
      debtProjects:
        d?.projects.map((p) => ({
          projectId: p.projectId,
          label: `${p.code} · ${p.name}`,
          payable: p.payable,
        })) ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nhà cung cấp</h1>
        <p className="text-sm text-slate-500">
          Quản lý nhà cung cấp theo từng hạng mục
        </p>
      </div>
      <SupplierManager suppliers={rows} canEdit={canEdit} canViewDebt={canViewDebt} />
    </div>
  );
}
