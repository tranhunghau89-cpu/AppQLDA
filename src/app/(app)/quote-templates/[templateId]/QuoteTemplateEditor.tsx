"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseViNumber } from "@/lib/utils";
import { saveTemplate } from "../actions";
import { HeaderFields, type HeaderState, type SetHeader } from "./HeaderFields";
import { LinesPanel } from "./LinesPanel";
import { SpecsPanel } from "./SpecsPanel";
import { StagesPanel, PaymentsPanel } from "./TermsPanels";
import { useRows } from "./useRows";
import { s, type EditorTemplate, type LineRow, type PaymentRow, type SpecRow, type StageRow } from "./types";

export function QuoteTemplateEditor({
  initial,
  loaiCongTrinh,
}: {
  initial: EditorTemplate;
  loaiCongTrinh: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const [h, setH] = useState<HeaderState>({
    name: initial.name,
    buildingType: s(initial.buildingType),
    description: s(initial.description),
    active: initial.active,
    vatPercent: s(initial.vatPercent),
    validDays: s(initial.validDays),
    warrantyMonths: s(initial.warrantyMonths),
    maintenanceMonths: s(initial.maintenanceMonths),
    loadRoof: s(initial.loadRoof),
    loadHanging: s(initial.loadHanging),
    loadFloor: s(initial.loadFloor),
    lineDetail: s(initial.lineDetail),
    greeting: s(initial.greeting),
    closing: s(initial.closing),
    colorNote: s(initial.colorNote),
    volumeNote: s(initial.volumeNote),
    excludeNote: s(initial.excludeNote),
  });
  const set: SetHeader = (k, v) => {
    setH((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  const lines = useRows<LineRow>(
    initial.lines.map((l, i) => ({
      uid: `l-${i}`,
      partCode: l.partCode,
      partName: l.partName,
      code: s(l.code),
      name: l.name,
      detail: s(l.detail),
      unit: s(l.unit),
      note: s(l.note),
      price: s(l.defaultUnitPrice),
      tags: l.tags,
      sourceSectionCode: s(l.sourceSectionCode),
      steelFrameKey: s(l.steelFrameKey),
    })),
    (uid) => ({
      uid,
      partCode: "I",
      partName: "Phần kết cấu thép",
      code: "",
      name: "",
      detail: "",
      unit: "m2",
      note: "",
      price: "",
      tags: [],
      sourceSectionCode: "",
      steelFrameKey: "",
    })
  );

  const specs = useRows<SpecRow>(
    initial.specs.map((r, i) => ({
      uid: `s-${i}`,
      groupCode: r.groupCode,
      tag: s(r.tag),
      name: r.name,
      spec: s(r.spec),
      origin: s(r.origin),
      inDescription: r.inDescription,
    })),
    (uid) => ({
      uid,
      groupCode: "A",
      tag: "",
      name: "",
      spec: "",
      origin: "",
      inDescription: false,
    })
  );

  const stages = useRows<StageRow>(
    initial.stages.map((r, i) => ({ uid: `g-${i}`, name: r.name, days: s(r.days) })),
    (uid) => ({ uid, name: "", days: "" })
  );

  const payments = useRows<PaymentRow>(
    initial.payments.map((r, i) => ({
      uid: `p-${i}`,
      label: r.label,
      percent: s(r.percent),
      basis: s(r.basis),
      note: s(r.note),
    })),
    (uid) => ({ uid, label: "", percent: "", basis: "GTHĐ", note: "" })
  );

  const tongNgay = stages.rows.reduce((t, r) => t + (parseViNumber(r.days) ?? 0), 0);
  const tongPhanTram = payments.rows.reduce((t, r) => t + (parseViNumber(r.percent) ?? 0), 0);

  function save() {
    if (!h.name.trim()) {
      setError("Tên mẫu không được để trống.");
      return;
    }
    setError(null);
    const rong = (v: string) => v.trim() || null;

    start(async () => {
      const res = await saveTemplate(initial.id, {
        name: h.name,
        buildingType: rong(h.buildingType),
        description: rong(h.description),
        active: h.active,
        vatPercent: parseViNumber(h.vatPercent),
        validDays: parseViNumber(h.validDays),
        warrantyMonths: parseViNumber(h.warrantyMonths),
        maintenanceMonths: parseViNumber(h.maintenanceMonths),
        loadRoof: parseViNumber(h.loadRoof),
        loadHanging: parseViNumber(h.loadHanging),
        loadFloor: parseViNumber(h.loadFloor),
        lineDetail: rong(h.lineDetail),
        greeting: rong(h.greeting),
        closing: rong(h.closing),
        colorNote: rong(h.colorNote),
        volumeNote: rong(h.volumeNote),
        excludeNote: rong(h.excludeNote),
        lines: lines.rows.map((l) => ({
          partCode: l.partCode,
          partName: l.partName,
          code: rong(l.code),
          name: l.name,
          detail: rong(l.detail),
          unit: rong(l.unit),
          note: rong(l.note),
          defaultUnitPrice: parseViNumber(l.price),
          tags: l.tags,
          sourceSectionCode: rong(l.sourceSectionCode),
          steelFrameKey: rong(l.steelFrameKey),
        })),
        specs: specs.rows.map((r) => ({
          groupCode: r.groupCode,
          tag: rong(r.tag),
          name: r.name,
          spec: rong(r.spec),
          origin: rong(r.origin),
        })),
        stages: stages.rows.map((r) => ({ name: r.name, days: parseViNumber(r.days) })),
        payments: payments.rows.map((r) => ({
          label: r.label,
          percent: parseViNumber(r.percent),
          basis: rong(r.basis),
          note: rong(r.note),
        })),
      });
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <HeaderFields h={h} set={set} loaiCongTrinh={loaiCongTrinh} />
      <LinesPanel api={lines} />
      <SpecsPanel api={specs} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <StagesPanel api={stages} tongNgay={tongNgay} />
        <PaymentsPanel api={payments} tongPhanTram={tongPhanTram} />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">✓ Đã lưu mẫu.</p>}

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          <Save className="h-4 w-4" /> {pending ? "Đang lưu…" : "Lưu mẫu"}
        </Button>
      </div>
    </div>
  );
}
