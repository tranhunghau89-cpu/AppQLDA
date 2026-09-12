import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { templateChoices } from "@/lib/quoteTemplatePick";
import { QuoteEditor } from "./QuoteEditor";
import { napDuLieuBaoGia } from "./napDuLieu";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireProjectView("quote", id);
  const canEdit = can(session.role as Role, "quote", "edit");

  const [project, duLieu] = await Promise.all([
    db.project.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, location: true, area: true, buildingType: true },
    }),
    napDuLieuBaoGia(session, { loai: "DU_AN", id }),
  ]);
  if (!project) notFound();

  // Cần buildingType nên phải chờ truy vấn dự án xong mới hỏi được mẫu báo giá.
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
            Báo giá chi tiết — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">
            Lập báo giá theo Mã CV{project.location ? ` · ${project.location}` : ""}
          </p>
        </div>
        <Link
          href="/thu-vien"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          <Tags className="h-4 w-4" /> Bảng đơn giá
        </Link>
      </div>

      <QuoteEditor
        chu={{ loai: "DU_AN", id: project.id }}
        quotes={duLieu.quotes}
        catalog={duLieu.catalog}
        cloneSources={duLieu.cloneSources}
        canEdit={canEdit}
        projectArea={project.area}
        templates={mau.options}
        templateGoiY={mau.goiY}
      />
    </div>
  );
}
