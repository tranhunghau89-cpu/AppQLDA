import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { SupplierManager } from "./SupplierManager";

export default async function SuppliersPage() {
  const session = await requireView("supplier");
  const canEdit = can(session.role, "supplier", "edit");

  const suppliers = await db.supplier.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { projectLinks: true, estimateItems: true } },
    },
  });

  const rows = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    contactPerson: s.contactPerson,
    phone: s.phone,
    note: s.note,
    usageCount: s._count.projectLinks + s._count.estimateItems,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nhà cung cấp</h1>
        <p className="text-sm text-slate-500">
          Quản lý nhà cung cấp theo từng hạng mục
        </p>
      </div>
      <SupplierManager suppliers={rows} canEdit={canEdit} />
    </div>
  );
}
