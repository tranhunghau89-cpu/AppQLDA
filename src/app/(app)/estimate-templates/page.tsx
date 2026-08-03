import { requireView } from "@/lib/auth";
import { db } from "@/lib/db";
import { TemplateList, type TemplateRow } from "./TemplateList";

export default async function EstimateTemplatesPage() {
  await requireView("template");

  const templates = await db.estimateTemplate.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { lines: true } } },
  });

  const rows: TemplateRow[] = templates.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    active: t.active,
    lineCount: t._count.lines,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Mẫu dự toán</h1>
        <p className="text-sm text-slate-500">
          Quản lý mẫu hạng mục (Khung mái, Vách…) dùng cho chức năng “Thêm hạng mục từ mẫu” khi lập dự toán.
        </p>
      </div>
      <TemplateList templates={rows} />
    </div>
  );
}
