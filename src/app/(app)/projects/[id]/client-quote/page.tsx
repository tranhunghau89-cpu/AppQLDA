import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { templateChoices } from "@/lib/quoteTemplatePick";
import { ClientQuoteEditor } from "./ClientQuoteEditor";
import { napDuLieuBaoGiaKhach } from "./napDuLieu";

export default async function ClientQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireProjectView("quote", id);
  const canEdit = can(session.role as Role, "quote", "edit");
  // Vai Vật tư không có khóa "customer" -> không được thấy nhật ký trao đổi.
  const canViewCrm = can(session.role as Role, "customer", "view");
  const canEditCrm = can(session.role as Role, "customer", "edit");

  const [project, duLieu] = await Promise.all([
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
    napDuLieuBaoGiaKhach({ loai: "DU_AN", id }, canViewCrm),
  ]);
  if (!project) notFound();

  // Cần buildingType của dự án nên phải chờ truy vấn trên xong mới hỏi được mẫu.
  const mau = await templateChoices(project.buildingType);

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
          <Receipt className="h-4 w-4" /> Dự toán chào giá
        </Link>
      </div>

      <ClientQuoteEditor
        chu={{ loai: "DU_AN", id: project.id }}
        quotes={duLieu.quotes}
        customers={duLieu.customers}
        canEdit={canEdit}
        canViewCrm={canViewCrm}
        canEditCrm={canEditCrm}
        templates={mau.options}
        templateGoiY={mau.goiY}
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
