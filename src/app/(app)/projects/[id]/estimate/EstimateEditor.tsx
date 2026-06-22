"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { ESTIMATE_GROUP, ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { formatVND, formatNumber } from "@/lib/utils";
import { computeAmount, computeProfit, formatPercent } from "@/lib/profit";
import { saveEstimateItem, deleteEstimateItem } from "./actions";

export interface EstimateRow {
  id: string;
  groupCode: string;
  name: string;
  unit: string | null;
  designQty: number | null;
  actualQty: number | null;
  unitPrice: number | null;
  amount: number | null;
  supplierId: string | null;
  supplierName: string | null;
  orderStatus: string | null;
  dispatchStatus: string | null;
  note: string | null;
}

export interface SupplierOpt {
  id: string;
  name: string;
}

export function EstimateEditor({
  projectId,
  items,
  suppliers,
  salePrice,
  area,
  canEdit,
}: {
  projectId: string;
  items: EstimateRow[];
  suppliers: SupplierOpt[];
  salePrice: number | null;
  area: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const summary = useMemo(
    () => computeProfit(items, salePrice, area),
    [items, salePrice, area]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, EstimateRow[]>();
    for (const it of items) {
      const arr = map.get(it.groupCode) ?? [];
      arr.push(it);
      map.set(it.groupCode, arr);
    }
    return ESTIMATE_GROUP.filter((g) => map.has(g.value)).map((g) => ({
      group: g,
      rows: map.get(g.value)!,
    }));
  }, [items]);

  function openNew() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }
  function openEdit(it: EstimateRow) {
    setEditing(it);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveEstimateItem(projectId, editing?.id ?? null, form);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function onDelete(it: EstimateRow) {
    if (!window.confirm(`Xóa "${it.name}"?`)) return;
    start(async () => {
      const res = await deleteEstimateItem(projectId, it.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Bảng dự toán */}
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Bảng dự toán</h2>
          {canEdit && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" /> Thêm hạng mục
            </Button>
          )}
        </div>

        {grouped.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            Chưa có dòng dự toán nào
          </div>
        )}

        {grouped.map(({ group, rows }) => {
          const subtotal = rows.reduce((s, r) => s + computeAmount(r), 0);
          return (
            <div key={group.value} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <span className="font-semibold text-slate-800">{group.label}</span>
                <span className="text-sm font-medium text-slate-600">
                  {formatVND(subtotal)}
                </span>
              </div>
              <Table>
                <THead>
                  <tr>
                    <Th>Hạng mục</Th>
                    <Th className="text-right">KL TK</Th>
                    <Th className="text-right">KL TT</Th>
                    <Th className="text-right">Đơn giá</Th>
                    <Th className="text-right">Thành tiền</Th>
                    <Th>NCC</Th>
                    {canEdit && <Th></Th>}
                  </tr>
                </THead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-medium text-slate-900">
                        {r.name}
                        {r.unit ? <span className="text-slate-400"> ({r.unit})</span> : null}
                      </Td>
                      <Td className="text-right">{formatNumber(r.designQty)}</Td>
                      <Td className="text-right">{formatNumber(r.actualQty)}</Td>
                      <Td className="text-right">{formatNumber(r.unitPrice)}</Td>
                      <Td className="text-right font-medium">{formatVND(computeAmount(r))}</Td>
                      <Td className="text-slate-500">{r.supplierName ?? "—"}</Td>
                      {canEdit && (
                        <Td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => onDelete(r)}
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
          );
        })}
      </div>

      {/* Tổng hợp chi phí / lợi nhuận */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Chi phí & Lợi nhuận</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Tổng chi phí</dt>
              <dd className="font-semibold text-slate-900">{formatVND(summary.totalCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Giá bán</dt>
              <dd className="font-semibold text-slate-900">{formatVND(summary.salePrice)}</dd>
            </div>
            <div className="my-2 border-t border-slate-100" />
            <div className="flex justify-between">
              <dt className="text-slate-500">Lợi nhuận</dt>
              <dd
                className={`font-bold ${
                  summary.profit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatVND(summary.profit)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Biên lợi nhuận</dt>
              <dd className="font-medium text-slate-700">{formatPercent(summary.margin)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Chi phí / m²</dt>
              <dd className="font-medium text-slate-700">
                {summary.costPerM2 != null ? formatVND(summary.costPerM2) : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {summary.groupSubtotals.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Theo nhóm</h3>
            <dl className="space-y-1.5 text-sm">
              {summary.groupSubtotals.map((g) => (
                <div key={g.code} className="flex justify-between">
                  <dt className="text-slate-500">{g.label}</dt>
                  <dd className="text-slate-700">{formatVND(g.amount)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa hạng mục dự toán" : "Thêm hạng mục dự toán"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nhóm *">
              <Select name="groupCode" defaultValue={editing?.groupCode ?? "KCT"}>
                {ESTIMATE_GROUP.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Đơn vị">
              <Input name="unit" defaultValue={editing?.unit ?? ""} placeholder="kg, bộ, m²…" />
            </Field>
          </div>
          <Field label="Tên hạng mục *">
            <Input name="name" defaultValue={editing?.name ?? ""} required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="KL thiết kế">
              <Input name="designQty" type="number" step="any" defaultValue={editing?.designQty ?? ""} />
            </Field>
            <Field label="KL thực tế">
              <Input name="actualQty" type="number" step="any" defaultValue={editing?.actualQty ?? ""} />
            </Field>
            <Field label="Đơn giá">
              <Input name="unitPrice" type="number" step="any" defaultValue={editing?.unitPrice ?? ""} />
            </Field>
          </div>
          <Field label="Thành tiền (để trống = KL × đơn giá)">
            <Input name="amount" type="number" step="any" defaultValue={editing?.amount ?? ""} />
          </Field>
          <Field label="Nhà cung cấp">
            <Select name="supplierId" defaultValue={editing?.supplierId ?? ""}>
              <option value="">— Không —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Đặt hàng">
              <Input name="orderStatus" defaultValue={editing?.orderStatus ?? ""} />
            </Field>
            <Field label="Xuất hàng">
              <Input name="dispatchStatus" defaultValue={editing?.dispatchStatus ?? ""} />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Textarea name="note" defaultValue={editing?.note ?? ""} />
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
