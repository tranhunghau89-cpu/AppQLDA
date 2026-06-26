"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { WORK_GROUP, WORK_GROUP_MAP } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { computeBaseCost } from "@/lib/quote";
import { saveWorkPrice, deleteWorkPrice } from "./actions";

export interface WorkPriceView {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  spec: string | null;
  unit: string | null;
  groupCode: string;
  material: number | null;
  laborMachine: number | null;
  coefficient: number | null;
  baseCost: number | null;
  note: string | null;
}

export function CatalogEditor({
  items,
  canEdit,
}: {
  items: WorkPriceView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkPriceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // preview giá thành trong modal
  const [m, setM] = useState(0);
  const [n, setN] = useState(0);
  const [h, setH] = useState(1);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        it.code.toLowerCase().includes(s) ||
        it.name.toLowerCase().includes(s) ||
        (it.shortName ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, WorkPriceView[]>();
    for (const it of filtered) {
      const g = it.groupCode in WORK_GROUP_MAP ? it.groupCode : "AL";
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(it);
    }
    return WORK_GROUP.map((g) => ({ ...g, rows: byGroup.get(g.value) ?? [] })).filter(
      (g) => g.rows.length > 0
    );
  }, [filtered]);

  function openAdd() {
    setEditing(null);
    setM(0);
    setN(0);
    setH(1);
    setError(null);
    setOpen(true);
  }
  function openEdit(it: WorkPriceView) {
    setEditing(it);
    setM(it.material ?? 0);
    setN(it.laborMachine ?? 0);
    setH(it.coefficient ?? 1);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await saveWorkPrice(editing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }
  function onDelete(it: WorkPriceView) {
    if (!window.confirm(`Xóa mã "${it.code} — ${it.name}"?`)) return;
    start(async () => {
      const res = await deleteWorkPrice(it.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  const preview = computeBaseCost(m, n, h);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm mã CV / tên công việc…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Thêm mã
          </Button>
        )}
      </div>

      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Không có mã đơn giá nào khớp
        </div>
      )}

      {groups.map((g) => (
        <div key={g.value} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
            <span>
              <span className="font-mono text-slate-400">{g.value}</span> · {g.label}
            </span>
            <span className="text-xs text-slate-400">{g.rows.length} mã</span>
          </div>
          <Table>
            <THead>
              <tr>
                <Th>Mã CV</Th>
                <Th>Nội dung</Th>
                <Th>ĐVT</Th>
                <Th className="text-right">Vật tư</Th>
                <Th className="text-right">NC + Máy</Th>
                <Th className="text-right">Hệ số</Th>
                <Th className="text-right">Giá thành</Th>
                {canEdit && <Th></Th>}
              </tr>
            </THead>
            <tbody>
              {g.rows.map((it) => (
                <Tr key={it.id}>
                  <Td className="font-mono text-slate-700">{it.code}</Td>
                  <Td className="font-medium text-slate-900">
                    {it.name}
                    {it.spec ? <span className="text-slate-400"> · {it.spec}</span> : null}
                  </Td>
                  <Td className="text-slate-600">{it.unit ?? "—"}</Td>
                  <Td className="text-right">{formatNumber(it.material)}</Td>
                  <Td className="text-right">{formatNumber(it.laborMachine)}</Td>
                  <Td className="text-right">{it.coefficient ?? "—"}</Td>
                  <Td className="text-right font-medium text-blue-700">
                    {formatNumber(it.baseCost)}
                  </Td>
                  {canEdit && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(it)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(it)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Sửa mã đơn giá" : "Thêm mã đơn giá"}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mã CV *">
              <Input name="code" defaultValue={editing?.code ?? ""} placeholder="AA.110" required />
            </Field>
            <Field label="Đơn vị">
              <Input name="unit" defaultValue={editing?.unit ?? ""} placeholder="kg, bộ, m²…" />
            </Field>
          </div>
          <Field label="Nội dung công việc *">
            <Input name="name" defaultValue={editing?.name ?? ""} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loại (rút gọn)">
              <Input name="shortName" defaultValue={editing?.shortName ?? ""} />
            </Field>
            <Field label="Thông số kỹ thuật">
              <Input name="spec" defaultValue={editing?.spec ?? ""} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Vật tư (VT)">
              <Input
                name="material"
                type="number"
                step="any"
                defaultValue={editing?.material ?? ""}
                onChange={(e) => setM(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="NC + Máy">
              <Input
                name="laborMachine"
                type="number"
                step="any"
                defaultValue={editing?.laborMachine ?? ""}
                onChange={(e) => setN(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Hệ số (HS)">
              <Input
                name="coefficient"
                type="number"
                step="any"
                defaultValue={editing?.coefficient ?? 1}
                onChange={(e) => setH(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Giá thành = (VT + NC) × HS ={" "}
            <span className="font-semibold text-blue-700">{formatNumber(preview)}</span>
          </div>
          <Field label="Ghi chú">
            <Input name="note" defaultValue={editing?.note ?? ""} />
          </Field>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
