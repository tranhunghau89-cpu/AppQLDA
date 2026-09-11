import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { scopedByProjectWhere } from "@/lib/scope";
import { can, type Role } from "@/lib/rbac";
import { QuoteEditor } from "./QuoteEditor";
import type { QuoteView, CatalogOption, CloneSource } from "./types";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireProjectView("quote", id);
  const canEdit = can(session.role as Role, "quote", "edit");

  // 4 truy vấn độc lập -> chạy song song (guard phân quyền đã xong ở trên).
  const [project, rawQuotes, catalogRows, sourceRows] = await Promise.all([
    db.project.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, location: true, area: true },
    }),
    db.quote.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        items: { orderBy: { sortOrder: "asc" } },
        clonedFrom: { select: { title: true } },
      },
    }),
    db.workPrice.findMany({
      orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }],
      select: { code: true, name: true, unit: true, baseCost: true },
    }),
    // Chỉ được clone từ báo giá của dự án mình được phân công.
    db.quote.findMany({
      where: await scopedByProjectWhere(session),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        project: { select: { code: true, name: true } },
      },
    }),
  ]);
  if (!project) notFound();

  const quotes: QuoteView[] = rawQuotes.map((q) => ({
    id: q.id,
    title: q.title,
    recipient: q.recipient,
    location: q.location,
    scope: q.scope,
    quoteDate: q.quoteDate ? q.quoteDate.toISOString() : null,
    markup: q.markup,
    note: q.note,
    clonedFromTitle: q.clonedFrom?.title ?? null,
    sections: q.sections.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      kind: s.kind,
      parentId: s.parentId,
      area: s.area,
    })),
    items: q.items.map((it) => ({
      id: it.id,
      sectionId: it.sectionId,
      workCode: it.workCode,
      name: it.name,
      unit: it.unit,
      qty: it.qty,
      baseCost: it.baseCost,
      sellPrice: it.sellPrice,
      spec: it.spec,
      note: it.note,
    })),
  }));

  const catalog: CatalogOption[] = catalogRows.map((c) => ({
    code: c.code,
    name: c.name,
    unit: c.unit,
    baseCost: c.baseCost,
  }));

  const cloneSources: CloneSource[] = sourceRows.map((s) => ({
    id: s.id,
    label: `${s.project.code} · ${s.title}`,
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
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Báo giá chi tiết — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">
            Lập báo giá theo Mã CV{project.location ? ` · ${project.location}` : ""}
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          <Tags className="h-4 w-4" /> Bảng đơn giá
        </Link>
      </div>

      <QuoteEditor
        projectId={project.id}
        quotes={quotes}
        catalog={catalog}
        cloneSources={cloneSources}
        canEdit={canEdit}
        projectArea={project.area}
      />
    </div>
  );
}
