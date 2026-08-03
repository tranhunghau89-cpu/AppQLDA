"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { formatNumber, formatVND } from "@/lib/utils";
import { computeTemplateLines, type TemplateLine } from "@/lib/estimateTemplate";
import { applyEstimateTemplate } from "./actions";

export interface TemplateForClient {
  id: string;
  name: string;
  code: string | null;
  lines: TemplateLine[];
}

// Định dạng VN: "." = phân cách nghìn, "," = thập phân (vd "12.496,57" = 12496.57).
const parseNum = (s: string | undefined): number | null => {
  const t = (s ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function ApplyTemplate({
  projectId,
  templates,
}: {
  projectId: string;
  templates: TemplateForClient[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [sectionName, setSectionName] = useState(templates[0]?.name ?? "");
  const [values, setValues] = useState<Record<string, { qty: string; price: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const template = templates.find((t) => t.id === templateId) ?? null;

  function loadTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    setTemplateId(id);
    setSectionName(t?.name ?? "");
    const init: Record<string, { qty: string; price: string }> = {};
    for (const l of t?.lines ?? []) {
      init[l.id] = {
        qty: l.defaultQty != null ? String(l.defaultQty) : "",
        price: l.defaultUnitPrice != null ? String(l.defaultUnitPrice) : "",
      };
    }
    setValues(init);
  }

  function openModal() {
    setError(null);
    loadTemplate(templates[0]?.id ?? "");
    setOpen(true);
  }

  const computed = useMemo(() => {
    if (!template) return [];
    const numValues: Record<string, { qty: number | null; unitPrice: number | null }> = {};
    for (const l of template.lines) {
      numValues[l.id] = { qty: parseNum(values[l.id]?.qty), unitPrice: parseNum(values[l.id]?.price) };
    }
    return computeTemplateLines(template.lines, numValues);
  }, [template, values]);

  const computedById = useMemo(() => {
    const m = new Map<string, (typeof computed)[number]>();
    for (const c of computed) m.set(c.lineId, c);
    return m;
  }, [computed]);

  // Gom dòng theo groupLabel (giữ thứ tự sortOrder).
  const groups = useMemo(() => {
    if (!template) return [] as { label: string; lines: TemplateLine[] }[];
    const order: string[] = [];
    const map = new Map<string, TemplateLine[]>();
    for (const l of template.lines) {
      if (!map.has(l.groupLabel)) {
        map.set(l.groupLabel, []);
        order.push(l.groupLabel);
      }
      map.get(l.groupLabel)!.push(l);
    }
    return order.map((label) => ({ label, lines: map.get(label)! }));
  }, [template]);

  const total = computed.reduce((s, c) => s + (c.amount ?? 0), 0);

  function set(lineId: string, key: "qty" | "price", v: string) {
    setValues((prev) => ({ ...prev, [lineId]: { qty: prev[lineId]?.qty ?? "", price: prev[lineId]?.price ?? "", [key]: v } }));
  }

  function submit() {
    if (!template) return;
    setError(null);
    const payload = {
      templateId: template.id,
      sectionName,
      lines: template.lines.map((l) => ({
        lineId: l.id,
        qty: parseNum(values[l.id]?.qty),
        unitPrice: parseNum(values[l.id]?.price),
      })),
    };
    start(async () => {
      const res = await applyEstimateTemplate(projectId, payload);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (templates.length === 0) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={openModal}>
        <LayoutTemplate className="h-4 w-4" /> Thêm hạng mục từ mẫu
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm hạng mục từ mẫu" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mẫu hạng mục *">
              <Select value={templateId} onChange={(e) => loadTemplate(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code ? `${t.code} · ` : ""}
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tên hạng mục trong dự án *">
              <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="VD: Khung mái nhà A" />
            </Field>
          </div>

          <p className="text-xs text-slate-500">
            Ô <span className="font-medium text-blue-600">Khối lượng</span> nhập tay; dòng tô xám là <b>tự tính</b> (vận chuyển,
            lắp dựng…). Đơn giá sửa được. Dòng để trống sẽ không tạo.
          </p>

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left">Hạng mục</th>
                  <th className="px-2 py-1.5 text-left">ĐV</th>
                  <th className="px-2 py-1.5 text-right">Khối lượng</th>
                  <th className="px-2 py-1.5 text-right">Đơn giá</th>
                  <th className="px-2 py-1.5 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((grp) => {
                  const sub = grp.lines.reduce((s, l) => s + (computedById.get(l.id)?.amount ?? 0), 0);
                  return (
                    <Fragment key={grp.label}>
                      <tr className="bg-slate-50">
                        <td colSpan={4} className="px-2 py-1 font-semibold text-slate-700">
                          {grp.label}
                        </td>
                        <td className="px-2 py-1 text-right font-medium text-slate-600">{sub ? formatVND(sub) : ""}</td>
                      </tr>
                      {grp.lines.map((l) => {
                        const c = computedById.get(l.id);
                        const derived = l.role === "DERIVED";
                        return (
                          <tr key={l.id} className={derived ? "bg-slate-50/40" : ""}>
                            <td className="px-2 py-0.5 pl-4 text-slate-800">
                              {l.name}
                              {l.note ? <span className="text-slate-400"> · {l.note}</span> : null}
                            </td>
                            <td className="px-2 py-0.5 text-slate-500">{l.unit}</td>
                            <td className="px-1 py-0.5 text-right">
                              {derived ? (
                                <span className="text-slate-500">{formatNumber(c?.qty ?? null)}</span>
                              ) : (
                                <input
                                  value={values[l.id]?.qty ?? ""}
                                  onChange={(e) => set(l.id, "qty", e.target.value)}
                                  className="w-24 rounded border border-slate-200 px-1.5 py-1 text-right text-xs focus:border-blue-500 focus:outline-none"
                                  inputMode="decimal"
                                />
                              )}
                            </td>
                            <td className="px-1 py-0.5 text-right">
                              <input
                                value={values[l.id]?.price ?? ""}
                                onChange={(e) => set(l.id, "price", e.target.value)}
                                className="w-28 rounded border border-slate-200 px-1.5 py-1 text-right text-xs focus:border-blue-500 focus:outline-none"
                                inputMode="decimal"
                              />
                            </td>
                            <td className="px-2 py-0.5 text-right font-medium text-slate-700">{formatVND(c?.amount ?? 0)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white">
                <tr className="border-t border-slate-200">
                  <td colSpan={4} className="px-2 py-2 text-right font-semibold text-slate-700">
                    Tổng hạng mục
                  </td>
                  <td className="px-2 py-2 text-right text-base font-bold text-slate-900">{formatVND(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button onClick={submit} disabled={pending || !sectionName.trim()}>
              {pending ? "Đang tạo…" : "Tạo hạng mục"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
