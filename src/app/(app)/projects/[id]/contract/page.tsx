import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ContractEditor, type ContractView } from "./ContractEditor";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireView("contract");
  const canEdit = can(session.role, "contract", "edit");

  const project = await db.project.findUnique({
    where: { id },
    include: {
      contracts: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!project) notFound();

  const contracts: ContractView[] = project.contracts.map((c) => ({
    id: c.id,
    contractNo: c.contractNo,
    signDate: c.signDate?.toISOString() ?? null,
    subject: c.subject,
    partyAName: c.partyAName,
    partyAInfo: c.partyAInfo,
    status: c.status,
    vatPercent: c.vatPercent,
    paymentTerms: c.paymentTerms,
    filePath: c.filePath,
    note: c.note,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      qty: i.qty,
      unitPrice: i.unitPrice,
      amount: i.amount,
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
            Hợp đồng & Báo giá — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">Hạng mục, giá trị, điều khoản và file hợp đồng</p>
        </div>
      </div>

      <ContractEditor projectId={project.id} contracts={contracts} canEdit={canEdit} />
    </div>
  );
}
