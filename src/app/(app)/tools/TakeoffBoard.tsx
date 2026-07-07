"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, Download } from "lucide-react";
import { BT_GROUPS, BT_GROUP_MAP } from "@/lib/takeoff-shared";
import { STEEL_SECTIONS } from "@/lib/steel-data";
import type { TakeoffRow } from "@/lib/takeoff-shared";
import { addTakeoffItem, deleteTakeoffItem } from "./actions";

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null) return "—";
  return v.toLocaleString("vi-VN", { maximumFractionDigits: d });
}

const KINDS = [
  { value: "BT", label: "Bê tông (móng/cột/dầm/sàn...)" },
  { value: "THEP_HINH", label: "Thép hình (tra bảng)" },
  { value: "TO_HOP", label: "Thép tổ hợp (I hàn)" },
  { value: "BAN_MA", label: "Bản mã / tấm" },
];

export function TakeoffBoard({
  projects,
  projectId,
  items,
  canEdit,
}: {
  projects: { id: string; code: string; name: string }[];
  projectId: string | null;
  items: TakeoffRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [kind, setKind] = useState("BT");
  const [group, setGroup] = useState("FD");
  const [steelQ, setSteelQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const steelOpts = useMemo(() => {
    const norm = steelQ.toLowerCase().replace(/[\s*×]/g, "x");
    if (!norm) return [];
    return STEEL_SECTIONS.filter((s) => s.name.toLowerCase().replace(/[\s*×]/g, "x").includes(norm)).slice(0, 8);
  }, [steelQ]);

  const changeProject = (id: string) => {
    const p = new URLSearchParams(sp.toString());
    if (id) p.set("project", id); else p.delete("project");
    p.set("tab", "takeoff");
    router.push(`/tools?${p.toString()}`);
  };

  const submit = (form: FormData) => {
    if (!projectId) { setError("Chọn dự án trước."); return; }
    setError(null);
    form.set("kind", kind);
    startTransition(async () => {
      const res = await addTakeoffItem(projectId, form);
      if (!res.ok) setError(res.error);
      else { formRef.current?.reset(); setSteelQ(""); }
    });
  };

  const remove = (id: string) => {
    if (!confirm("Xóa dòng này?")) return;
    startTransition(async () => {
      const res = await deleteTakeoffItem(id);
      if (!res.ok) setError(res.error);
    });
  };

  const bt = items.filter((i) => i.kind === "BT");
  const st = items.filter((i) => i.kind !== "BT");
  const totC = bt.reduce((s, i) => s + (i.concrete ?? 0), 0);
  const totF = bt.reduce((s, i) => s + (i.formwork ?? 0), 0);
  const totR = bt.reduce((s, i) => s + (i.rebar ?? 0), 0);
  const totS = st.reduce((s, i) => s + (i.steel ?? 0), 0);

  const g = BT_GROUP_MAP[group];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={projectId ?? ""}
          onChange={(e) => changeProject(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">— Chọn dự án —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
          ))}
        </select>
        {projectId && (
          <a
            href={`/api/takeoff/${projectId}/export`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Xuất Excel
          </a>
        )}
      </div>

      {projectId && (
        <>
          {/* Tổng hợp */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Bê tông", `${fmt(totC)} m³`],
              ["Ván khuôn", `${fmt(totF)} m²`],
              ["Thép (hàm lượng)", `${fmt(totR)} kg`],
              ["Thép hình / tổ hợp", `${fmt(totS)} kg`],
            ].map(([t, v]) => (
              <div key={t} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">{t}</div>
                <div className="mt-0.5 text-lg font-bold text-blue-600">{v}</div>
              </div>
            ))}
          </div>

          {/* Form thêm */}
          {canEdit && (
            <form ref={formRef} action={submit} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.value} type="button" onClick={() => setKind(k.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${kind === k.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-8">
                <input name="code" placeholder="Mã CK (FD1, C1...)" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />

                {kind === "BT" && (
                  <>
                    <select name="group" value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
                      {BT_GROUPS.map((x) => (
                        <option key={x.value} value={x.value}>{x.label} ({x.value})</option>
                      ))}
                    </select>
                    {g.dims.map((d, i) => (
                      <input key={i} name={`d${i + 1}`} placeholder={d} inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    ))}
                    <input name="rebarRatio" placeholder="Thép kg/m³ (vd 120)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                  </>
                )}

                {kind === "THEP_HINH" && (
                  <>
                    <div className="relative col-span-2">
                      <input
                        value={steelQ} onChange={(e) => setSteelQ(e.target.value)}
                        placeholder="Gõ mã: I300, V50x5..." className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      <input type="hidden" name="spec" value={steelOpts.length === 1 ? steelOpts[0].name : steelQ} />
                      {steelOpts.length > 0 && steelQ && !STEEL_SECTIONS.some((x) => x.name === steelQ) && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow">
                          {steelOpts.map((o) => (
                            <div key={o.name} onClick={() => setSteelQ(o.name)} className="cursor-pointer px-2 py-1 text-sm hover:bg-blue-50">
                              <span className="font-mono">{o.name}</span> <span className="text-xs text-slate-400">{o.wPerM} kg/m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input name="len" placeholder="Dài mỗi thanh (m)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                  </>
                )}

                {kind === "TO_HOP" && (
                  <>
                    <input name="wf" placeholder="Cánh wf (mm)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input name="tf" placeholder="Dày cánh tf (mm)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input name="hw" placeholder="Bụng hw (mm)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input name="tw" placeholder="Dày bụng tw (mm)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input name="len" placeholder="Dài L (m)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                  </>
                )}

                {kind === "BAN_MA" && (
                  <>
                    <input name="w" placeholder="Rộng (mm)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input name="l" placeholder="Dài (mm)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input name="t" placeholder="Dày (mm)" inputMode="decimal" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                  </>
                )}

                <input name="qty" placeholder="SL" defaultValue="1" inputMode="numeric" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                <input name="note" placeholder="Ghi chú" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {pending ? "..." : "+ Thêm"}
                </button>
              </div>
              {kind === "BT" && <p className="text-xs text-slate-400">{g.hint} — kết quả × số lượng. Thép ước tính = BT × hàm lượng kg/m³ (bỏ trống nếu không cần).</p>}
              {kind === "TO_HOP" && <p className="text-xs text-slate-400">kg = (2·wf·tf + hw·tw) × L × 7850/10⁶ — tiết diện I hàn từ 3 bản thép.</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          )}

          {/* Bảng bê tông */}
          {bt.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Cấu kiện</th>
                    <th className="px-3 py-2">Kích thước (m)</th>
                    <th className="px-3 py-2 text-right">SL</th>
                    <th className="px-3 py-2 text-right">BT (m³)</th>
                    <th className="px-3 py-2 text-right">VK (m²)</th>
                    <th className="px-3 py-2 text-right">Thép (kg)</th>
                    <th className="px-3 py-2">Ghi chú</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bt.map((i) => {
                    const d = i.dims ? JSON.parse(i.dims) : {};
                    return (
                      <tr key={i.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-1.5 font-medium text-slate-800">{i.name}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-600">{d.d1} × {d.d2} × {d.d3}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(i.qty, 0)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-blue-600">{fmt(i.concrete)}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(i.formwork)}</td>
                        <td className="px-3 py-1.5 text-right">{i.rebar != null ? `${fmt(i.rebar, 0)}` : "—"}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-400">{i.note ?? ""}</td>
                        <td className="px-2 py-1.5">
                          {canEdit && (
                            <button onClick={() => remove(i.id)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bảng thép */}
          {st.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Cấu kiện thép</th>
                    <th className="px-3 py-2">Quy cách</th>
                    <th className="px-3 py-2 text-right">SL</th>
                    <th className="px-3 py-2 text-right">KL (kg)</th>
                    <th className="px-3 py-2">Ghi chú</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {st.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 font-medium text-slate-800">{i.code ? `${i.code} · ` : ""}{i.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{i.spec}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(i.qty, 0)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-blue-600">{fmt(i.steel)}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-400">{i.note ?? ""}</td>
                      <td className="px-2 py-1.5">
                        {canEdit && (
                          <button onClick={() => remove(i.id)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-400">
              Chưa có cấu kiện nào — thêm bằng form phía trên.
            </p>
          )}
        </>
      )}
    </div>
  );
}
