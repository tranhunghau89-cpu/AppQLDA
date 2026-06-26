import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { CatalogEditor, type WorkPriceView } from "./CatalogEditor";

export default async function CatalogPage() {
  const session = await requireView("quote");
  const canEdit = can(session.role as Role, "quote", "edit");

  const rows = await db.workPrice.findMany({
    orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });

  const items: WorkPriceView[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    shortName: r.shortName,
    spec: r.spec,
    unit: r.unit,
    groupCode: r.groupCode,
    material: r.material,
    laborMachine: r.laborMachine,
    coefficient: r.coefficient,
    baseCost: r.baseCost,
    note: r.note,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Bảng đơn giá (Mã CV)</h1>
        <p className="text-sm text-slate-500">
          Danh mục công việc &amp; đơn giá dùng chung cho mọi báo giá — {items.length} mã
        </p>
      </div>
      <CatalogEditor items={items} canEdit={canEdit} />
    </div>
  );
}
