"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/form";
import { ESTIMATE_GROUP } from "@/lib/constants";
import { parseViNumber } from "@/lib/utils";
import { saveTemplate } from "../actions";

export interface EditorLine {
  groupLabel: string;
  name: string;
  unit: string | null;
  defaultUnitPrice: number | null;
  role: string;
  param: string | null;
  factor: number | null;
  groupCode: string;
  note: string | null;
}
export interface EditorTemplate {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  lines: EditorLine[];
}

interface LineState {
  uid: string;
  groupLabel: string;
  name: string;
  unit: string;
  price: string;
  role: string; // INPUT | DERIVED
  param: string;
  factor: string;
  groupCode: string;
  note: string;
}

const s = (v: string | number | null): string => (v == null ? "" : String(v));

export function TemplateEditor({ initial }: { initial: EditorTemplate }) {
  const router = useRouter();
  const idRef = useRef(0);
  const mkUid = () => String(idRef.current++);

  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [active, setActive] = useState(initial.active);
  const [lines, setLines] = useState<LineState[]>(
    initial.lines.map((l) => ({
      uid: mkUid(),
      groupLabel: l.groupLabel,
      name: l.name,
      unit: s(l.unit),
      price: s(l.defaultUnitPrice),
      role: l.role === "DERIVED" ? "DERIVED" : "INPUT",
      param: s(l.param),
      factor: s(l.factor),
      groupCode: l.groupCode,
      note: s(l.note),
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const params = useMemo(() => {
    const set = new Set<string>();
    for (const l of lines) if (l.param.trim()) set.add(l.param.trim());
    return [...set];
  }, [lines]);

  function upd(uid: string, key: keyof LineState, v: string) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, [key]: v } : l)));
    setSaved(false);
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      { uid: mkUid(), groupLabel: prev[prev.length - 1]?.groupLabel ?? "", name: "", unit: "", price: "", role: "INPUT", param: "", factor: "", groupCode: "KHAC", note: "" },
    ]);
  }
  function removeLine(uid: string) {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }
  function move(uid: string, dir: -1 | 1) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function save() {
    if (!name.trim()) {
      setError("Tên mẫu không được để trống.");
      return;
    }
    setError(null);
    const payload = {
      name,
      code: code.trim() || null,
      description: description.trim() || null,
      active,
      lines: lines.map((l) => ({
        groupLabel: l.groupLabel,
        name: l.name,
        unit: l.unit || null,
        defaultUnitPrice: parseViNumber(l.price),
        role: l.role,
        feedsParam: l.role === "INPUT" ? l.param || null : null,
        takesFromParam: l.role === "DERIVED" ? l.param || null : null,
        factor: l.role === "DERIVED" ? parseViNumber(l.factor) ?? 1 : null,
        groupCode: l.groupCode,
        note: l.note || null,
      })),
    };
    start(async () => {
      const res = await saveTemplate(initial.id, payload);
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="Tên mẫu *">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Field label="Mã (A, B…)">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="Trạng thái">
          <Select value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
            <option value="1">Đang dùng</option>
            <option value="0">Ẩn</option>
          </Select>
        </Field>
        <div className="sm:col-span-4">
          <Field label="Mô tả">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </div>

      <datalist id="param-list">
        {params.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <span className="font-semibold text-slate-800">Các dòng ({lines.length})</span>
          <Button size="sm" variant="secondary" onClick={addLine}>
            <Plus className="h-4 w-4" /> Thêm dòng
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left">Nhóm</th>
                <th className="px-2 py-1.5 text-left">Tên dòng</th>
                <th className="px-2 py-1.5 text-left">ĐV</th>
                <th className="px-2 py-1.5 text-right">Đơn giá</th>
                <th className="px-2 py-1.5 text-left">Vai trò</th>
                <th className="px-2 py-1.5 text-left">Tham số</th>
                <th className="px-2 py-1.5 text-right">Hệ số</th>
                <th className="px-2 py-1.5 text-left">Nhóm CP</th>
                <th className="px-2 py-1.5 text-left">Ghi chú</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.uid} className="border-t border-slate-100">
                  <td className="px-1 py-0.5">
                    <input list="group-list" value={l.groupLabel} onChange={(e) => upd(l.uid, "groupLabel", e.target.value)} className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                  </td>
                  <td className="px-1 py-0.5">
                    <input value={l.name} onChange={(e) => upd(l.uid, "name", e.target.value)} className="w-32 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                  </td>
                  <td className="px-1 py-0.5">
                    <input value={l.unit} onChange={(e) => upd(l.uid, "unit", e.target.value)} className="w-12 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                  </td>
                  <td className="px-1 py-0.5">
                    <input value={l.price} onChange={(e) => upd(l.uid, "price", e.target.value)} className="w-24 rounded border border-slate-200 px-1.5 py-1 text-right text-xs" inputMode="decimal" />
                  </td>
                  <td className="px-1 py-0.5">
                    <select value={l.role} onChange={(e) => upd(l.uid, "role", e.target.value)} className="rounded border border-slate-200 px-1 py-1 text-xs">
                      <option value="INPUT">Nhập</option>
                      <option value="DERIVED">Tự tính</option>
                    </select>
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      list="param-list"
                      value={l.param}
                      onChange={(e) => upd(l.uid, "param", e.target.value)}
                      placeholder={l.role === "INPUT" ? "nạp vào…" : "lấy từ…"}
                      className="w-24 rounded border border-slate-200 px-1.5 py-1 text-xs"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      value={l.factor}
                      onChange={(e) => upd(l.uid, "factor", e.target.value)}
                      disabled={l.role !== "DERIVED"}
                      placeholder="1"
                      className="w-14 rounded border border-slate-200 px-1.5 py-1 text-right text-xs disabled:bg-slate-50"
                      inputMode="decimal"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <select value={l.groupCode} onChange={(e) => upd(l.uid, "groupCode", e.target.value)} className="w-24 rounded border border-slate-200 px-1 py-1 text-xs">
                      {ESTIMATE_GROUP.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-0.5">
                    <input value={l.note} onChange={(e) => upd(l.uid, "note", e.target.value)} className="w-24 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                  </td>
                  <td className="whitespace-nowrap px-1 py-0.5 text-right">
                    <button onClick={() => move(l.uid, -1)} className="p-0.5 text-slate-400 hover:text-slate-700" title="Lên">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => move(l.uid, 1)} className="p-0.5 text-slate-400 hover:text-slate-700" title="Xuống">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeLine(l.uid)} className="p-0.5 text-red-500 hover:text-red-700" title="Xóa dòng">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <datalist id="group-list">
        {[...new Set(lines.map((l) => l.groupLabel).filter(Boolean))].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <p className="text-xs text-slate-500">
        <b>Nhập</b>: user tự điền số lượng; điền “Tham số” để cộng dồn (vd nhiều dòng thép → <code>KCT_KG</code>).
        <b> Tự tính</b>: số lượng = tham số × hệ số (vd Vận chuyển KCT lấy <code>KCT_KG</code>).
      </p>

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
