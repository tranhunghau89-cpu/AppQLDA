import { requireView } from "@/lib/auth";
import { db } from "@/lib/db";
import { TemplateList, type QuoteTemplateRow } from "./TemplateList";

export default async function QuoteTemplatesPage() {
  await requireView("template");

  const templates = await db.quoteTemplate.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { lines: true, specs: true, stages: true, payments: true } },
    },
  });

  const rows: QuoteTemplateRow[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    buildingType: t.buildingType,
    active: t.active,
    lineCount: t._count.lines,
    specCount: t._count.specs,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Mẫu báo giá</h1>
        <p className="text-sm text-slate-500">
          Thư viện mẫu cho báo giá gửi khách, gắn theo loại công trình. Khi lập báo giá,
          mẫu khớp loại công trình của dự án được chọn sẵn.
        </p>
      </div>
      <TemplateList templates={rows} />
    </div>
  );
}
