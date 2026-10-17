"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { formatNumber, formatVND } from "@/lib/utils";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";
import { computeTemplateLines, type TemplateLine } from "@/lib/estimateTemplate";
import { applyEstimateTemplate } from "./actions";
import { luuCongTacDong } from "@/app/(app)/thu-vien/bo-hang-muc/actions";
import { useToast } from "@/components/ui/toast";
import { norm } from "@/lib/text";
import type { CongTacChon } from "@/components/ui/OChonCongTac";

export interface TemplateForClient {
  id: string;
  name: string;
  code: string | null;
  lines: TemplateLine[];
}

/** Số → chuỗi ô nhập kiểu Việt; đơn giá từ 1.000 trở lên làm tròn đồng, khỏi "27204,5454…". */
const soO = (v: number | null) =>
  v == null ? "" : String(Math.abs(v) >= 1000 ? Math.round(v) : Math.round(v * 100) / 100).replace(".", ",");

// Ô khối lượng / đơn giá nhận số kiểu Việt hoặc công thức bắt đầu bằng "=" (=12*3,5).
const parseNum = (s: string | undefined): number | null => tinhBieuThuc(s);
const loiO = (s: string | undefined) => !!s?.trim() && tinhBieuThuc(s) == null;

/** Ô nhập số/công thức: viền đỏ khi không đọc được, dòng nhỏ "= kết quả" khi là công thức. */
function OCongThuc({
  value,
  onChange,
  rong,
}: {
  value: string;
  onChange: (v: string) => void;
  rong: string;
}) {
  const loi = loiO(value);
  const kq = laCongThuc(value) && !loi ? tinhBieuThuc(value) : null;
  return (
    <div className="inline-flex flex-col items-end">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={loi ? "Không đọc được số / công thức" : undefined}
        className={`${rong} rounded border px-1.5 py-1 text-right text-xs focus:outline-none ${
          loi ? "border-red-400 bg-red-50 focus:border-red-500" : "border-slate-200 focus:border-blue-500"
        }`}
        inputMode="decimal"
      />
      {kq != null && <span className="text-[11px] text-slate-400">= {formatNumber(kq)}</span>}
    </div>
  );
}

export function ApplyTemplate({
  projectId,
  templates,
  catalog,
  suaThuVien,
}: {
  projectId: string;
  templates: TemplateForClient[];
  catalog: CongTacChon[];
  /** Được gắn mã công tác cho dòng mẫu — lưu thẳng vào bộ hạng mục. */
  suaThuVien: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  // Mã vừa gắn trong hộp này, chờ trang tải lại bộ hạng mục.
  const [maGan, setMaGan] = useState<Record<string, string | null>>({});
  const [dangGan, startGan] = useTransition();
  const ctTheoId = useMemo(() => new Map(catalog.map((c) => [c.congTacId, c])), [catalog]);

  function ganMa(lineId: string, congTacId: string | null) {
    startGan(async () => {
      const r = await luuCongTacDong(lineId, congTacId);
      if (!r.ok) return toast.error(r.error);
      setMaGan((m) => ({ ...m, [lineId]: congTacId }));
      const ct = congTacId ? ctTheoId.get(congTacId) : null;
      if (ct?.baseCost != null) set(lineId, "price", soO(ct.baseCost));
      router.refresh();
    });
  }
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
        // Dấu phẩy thập phân: ô đọc số kiểu Việt, "0.5" sẽ thành 5.
        qty: soO(l.defaultQty),
        price: soO(l.defaultUnitPrice),
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

  const coOLoi = template?.lines.some((l) => loiO(values[l.id]?.qty) || loiO(values[l.id]?.price)) ?? false;

  function submit() {
    if (!template) return;
    if (coOLoi) return setError("Còn ô số / công thức không đọc được (viền đỏ).");
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
            lắp dựng…). Đơn giá sửa được. Dòng để trống sẽ không tạo. Gõ công thức bắt đầu bằng{" "}
            <code className="rounded bg-slate-100 px-1">=</code>, ví dụ{" "}
            <code className="rounded bg-slate-100 px-1">=12*3,5+2</code>.
          </p>

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left">Mã CV</th>
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
                        <td colSpan={5} className="px-2 py-1 font-semibold text-slate-700">
                          {grp.label}
                        </td>
                        <td className="px-2 py-1 text-right font-medium text-slate-600">{sub ? formatVND(sub) : ""}</td>
                      </tr>
                      {grp.lines.map((l) => {
                        const c = computedById.get(l.id);
                        const derived = l.role === "DERIVED";
                        return (
                          <tr key={l.id} className={derived ? "bg-slate-50/40" : ""}>
                            <td className="px-1 py-0.5">
                              <OChonMa
                                congTacId={l.id in maGan ? maGan[l.id] : (l.congTacId ?? null)}
                                donVi={l.unit}
                                catalog={catalog}
                                khoa={!suaThuVien || dangGan}
                                chon={(id) => ganMa(l.id, id)}
                              />
                            </td>
                            <td className="px-2 py-0.5 pl-4 text-slate-800">
                              {l.name}
                              {l.note ? <span className="text-slate-400"> · {l.note}</span> : null}
                            </td>
                            <td className="px-2 py-0.5 text-slate-500">{l.unit}</td>
                            <td className="px-1 py-0.5 text-right">
                              {derived ? (
                                <span className="text-slate-500">{formatNumber(c?.qty ?? null)}</span>
                              ) : (
                                <OCongThuc
                                  value={values[l.id]?.qty ?? ""}
                                  onChange={(v) => set(l.id, "qty", v)}
                                  rong="w-28"
                                />
                              )}
                            </td>
                            <td className="px-1 py-0.5 text-right">
                              <OCongThuc
                                value={values[l.id]?.price ?? ""}
                                onChange={(v) => set(l.id, "price", v)}
                                rong="w-28"
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
                  <td colSpan={5} className="px-2 py-2 text-right font-semibold text-slate-700">
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

/**
 * Ô chọn mã công tác thư viện cho một dòng mẫu. Công tác cùng đơn vị lên đầu; chọn là
 * lưu vào bộ hạng mục (mọi lần áp sau dùng mã này), bỏ chọn là gỡ mã.
 */
function OChonMa({
  congTacId,
  donVi,
  catalog,
  khoa,
  chon,
}: {
  congTacId: string | null;
  donVi: string | null;
  catalog: CongTacChon[];
  khoa: boolean;
  chon: (congTacId: string | null) => void;
}) {
  const dv = norm(donVi);
  const cungDv = catalog.filter((c) => norm(c.unit) === dv);
  const khac = catalog.filter((c) => norm(c.unit) !== dv);
  const nhan = (c: CongTacChon) =>
    `${c.code} · ${c.tenNgan || c.name}${c.baseCost != null ? ` — ${c.baseCost.toLocaleString("vi-VN")}` : ""}`;
  return (
    <select
      value={congTacId ?? ""}
      disabled={khoa}
      onChange={(e) => chon(e.target.value || null)}
      title={congTacId ? catalog.find((c) => c.congTacId === congTacId)?.name : "Chưa gắn mã — giá lấy theo bộ"}
      className={`w-24 rounded border px-1 py-1 font-mono text-[11px] disabled:opacity-70 ${
        congTacId ? "border-slate-200 text-slate-700" : "border-amber-300 bg-amber-50 text-amber-700"
      }`}
    >
      <option value="">gắn mã…</option>
      {cungDv.length > 0 && (
        <optgroup label={`Cùng đơn vị (${donVi ?? "—"})`}>
          {cungDv.map((c) => (
            <option key={c.congTacId} value={c.congTacId}>
              {nhan(c)}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Đơn vị khác">
        {khac.map((c) => (
          <option key={c.congTacId} value={c.congTacId}>
            {nhan(c)} ({c.unit ?? "—"})
          </option>
        ))}
      </optgroup>
    </select>
  );
}