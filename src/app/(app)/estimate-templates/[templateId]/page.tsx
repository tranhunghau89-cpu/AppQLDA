import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireView } from "@/lib/auth";
import { db } from "@/lib/db";
import { TemplateEditor, type EditorTemplate } from "./TemplateEditor";

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  await requireView("template");

  const t = await db.estimateTemplate.findUnique({
    where: { id: templateId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!t) notFound();

  const data: EditorTemplate = {
    id: t.id,
    name: t.name,
    code: t.code,
    description: t.description,
    active: t.active,
    lines: t.lines.map((l) => ({
      groupLabel: l.groupLabel,
      name: l.name,
      unit: l.unit,
      defaultUnitPrice: l.defaultUnitPrice,
      role: l.role,
      param: l.feedsParam ?? l.takesFromParam ?? null,
      factor: l.factor,
      groupCode: l.groupCode,
      note: l.note,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/estimate-templates" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sửa mẫu dự toán</h1>
          <p className="text-sm text-slate-500">Đặt vai trò dòng (Nhập / Tự tính) + tham số để tự tính số lượng.</p>
        </div>
      </div>
      <TemplateEditor initial={data} />
    </div>
  );
}
