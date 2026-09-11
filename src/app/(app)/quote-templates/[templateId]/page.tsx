import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireView } from "@/lib/auth";
import { db } from "@/lib/db";
import { QuoteTemplateEditor } from "./QuoteTemplateEditor";
import type { EditorTemplate } from "./types";

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  await requireView("template");

  const [t, loai] = await Promise.all([
    db.quoteTemplate.findUnique({
      where: { id: templateId },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        specs: { orderBy: { sortOrder: "asc" } },
        stages: { orderBy: { sortOrder: "asc" } },
        payments: { orderBy: { sortOrder: "asc" } },
      },
    }),
    // Loại công trình đang có thật trong dữ liệu — gợi ý để người soạn gõ đúng
    // chuỗi mà matchTemplate sẽ đem đi so.
    db.project.findMany({
      where: { buildingType: { not: null } },
      select: { buildingType: true },
      distinct: ["buildingType"],
      orderBy: { buildingType: "asc" },
    }),
  ]);
  if (!t) notFound();

  const data: EditorTemplate = {
    id: t.id,
    name: t.name,
    buildingType: t.buildingType,
    description: t.description,
    active: t.active,
    vatPercent: t.vatPercent,
    validDays: t.validDays,
    warrantyMonths: t.warrantyMonths,
    maintenanceMonths: t.maintenanceMonths,
    loadRoof: t.loadRoof,
    loadHanging: t.loadHanging,
    loadFloor: t.loadFloor,
    lineDetail: t.lineDetail,
    greeting: t.greeting,
    closing: t.closing,
    colorNote: t.colorNote,
    volumeNote: t.volumeNote,
    excludeNote: t.excludeNote,
    lines: t.lines.map((l) => ({
      partCode: l.partCode,
      partName: l.partName,
      code: l.code,
      name: l.name,
      detail: l.detail,
      unit: l.unit,
      note: l.note,
      defaultUnitPrice: l.defaultUnitPrice,
      tags: l.tags,
      sourceSectionCode: l.sourceSectionCode,
      steelFrameKey: l.steelFrameKey,
    })),
    specs: t.specs.map((r) => ({
      groupCode: r.groupCode,
      tag: r.tag,
      name: r.name,
      spec: r.spec,
      origin: r.origin,
    })),
    stages: t.stages.map((r) => ({ name: r.name, days: r.days })),
    payments: t.payments.map((r) => ({
      label: r.label,
      percent: r.percent,
      basis: r.basis,
      note: r.note,
    })),
  };

  const loaiCongTrinh = loai
    .map((p) => p.buildingType)
    .filter((v): v is string => Boolean(v?.trim()));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/quote-templates"
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sửa mẫu báo giá</h1>
          <p className="text-sm text-slate-500">
            Gắn mẫu với một loại công trình để nó được chọn sẵn khi lập báo giá cho dự án
            cùng loại.
          </p>
        </div>
      </div>
      <QuoteTemplateEditor initial={data} loaiCongTrinh={loaiCongTrinh} />
    </div>
  );
}
