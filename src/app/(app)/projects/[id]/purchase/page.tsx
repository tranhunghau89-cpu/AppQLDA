import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PurchaseEditor, type OrderView } from "./PurchaseEditor";

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireView("purchase");
  const canEdit = can(session.role, "purchase", "edit");

  const project = await db.project.findUnique({
    where: { id },
    include: {
      purchaseOrders: {
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            orderBy: { sortOrder: "asc" },
            include: { images: { orderBy: { sortOrder: "asc" }, select: { id: true } } },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const suppliers = await db.supplier.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const orders: OrderView[] = project.purchaseOrders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    orderDate: o.orderDate?.toISOString() ?? null,
    category: o.category,
    supplierId: o.supplierId,
    supplierName: o.supplier?.name ?? null,
    status: o.status,
    orderedDate: o.orderedDate?.toISOString() ?? null,
    receivedDate: o.receivedDate?.toISOString() ?? null,
    value: o.value,
    totalWeight: o.totalWeight,
    filePath: o.filePath,
    note: o.note,
    items: o.items.map((i) => ({
      id: i.id,
      category: i.category,
      groupName: i.groupName,
      name: i.name,
      unit: i.unit,
      qty: i.qty,
      unitPrice: i.unitPrice,
      amount: i.amount,
      weight: i.weight,
      note: i.note,
      imageIds: i.images.map((im) => im.id),
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Đơn hàng & Mua hàng — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">Đơn đặt hàng vật tư, nhà cung cấp và trạng thái</p>
        </div>
      </div>

      <PurchaseEditor
        projectId={project.id}
        orders={orders}
        suppliers={suppliers}
        canEdit={canEdit}
      />
    </div>
  );
}
