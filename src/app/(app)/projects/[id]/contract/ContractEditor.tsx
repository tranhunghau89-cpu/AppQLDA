"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, FileText, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATUS, CONTRACT_STATUS_MAP } from "@/lib/constants";
import { formatVND, formatNumber, formatDate } from "@/lib/utils";
import { computeContractTotals, lineAmount } from "@/lib/contract";
import {
  saveContract,
  deleteContract,
  saveContractItem,
  deleteContractItem,
} from "./actions";

export interface ContractItemView {
  id: string;
  name: string;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
}
export interface ContractView {
  id: string;
  contractNo: string | null;
  signDate: string | null;
  subject: string | null;
  partyAName: string | null;
  partyAInfo: string | null;
  status: string;
  vatPercent: number | null;
  paymentTerms: string | null;
  filePath: string | null;
  note: string | null;
  items: ContractItemView[];
}

export function ContractEditor({
  projectId,
  contracts,
  canEdit,
}: {
  projectId: string;
  contracts: ContractView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  // modal hợp đồng
  const [cOpen, setCOpen] = useState(false);
  const [cEditing, setCEditing] = useState<ContractView | null>(null);
  // modal hạng mục
  const [iOpen, setIOpen] = useState(false);
  const [iContractId, setIContractId] = useState<string | null>(null);
  const [iEditing, setIEditing] = useState<ContractItemView | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function refresh() {
    start(() => router.refresh());
  }

  function onContractSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await saveContract(projectId, cEditing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setCOpen(false);
        router.refresh();
      }
    });
  }
  function onItemSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!iContractId) return;
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await saveContractItem(projectId, iContractId, iEditing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setIOpen(false);
        router.refresh();
      }
    });
  }
  function onDeleteContract(c: ContractView) {
    if (!window.confirm(`Xóa hợp đồng "${c.contractNo ?? c.subject ?? ""}"?`)) return;
    start(async () => {
      const res = await deleteContract(projectId, c.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }
  function onDeleteItem(contractId: string, item: ContractItemView) {
    if (!window.confirm(`Xóa hạng mục "${item.name}"?`)) return;
    start(async () => {
      const res = await deleteContractItem(projectId, contractId, item.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setCEditing(null);
              setError(null);
              setCOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm hợp đồng
          </Button>
        </div>
      )}

      {contracts.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Chưa có hợp đồng / báo giá nào
        </div>
      )}

      {contracts.map((c) => {
        const totals = computeContractTotals(c.items, c.vatPercent);
        const st = CONTRACT_STATUS_MAP[c.status];
        return (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-slate-900">
                    {c.contractNo ?? "(Chưa có số HĐ)"}
                  </span>
                  <Badge tone={st?.tone ?? "slate"}>{st?.label ?? c.status}</Badge>
                </div>
                {c.subject && <p className="text-sm text-slate-600">{c.subject}</p>}
                <div className="text-sm text-slate-500">
                  {c.partyAName && <span>CĐT: {c.partyAName} · </span>}
                  Ngày ký: {c.signDate ? formatDate(c.signDate) : "—"}
                </div>
                {c.partyAInfo && <p className="text-xs text-slate-400">{c.partyAInfo}</p>}
              </div>
              <div className="flex items-center gap-2">
                {c.filePath && (
                  <a
                    href={`/api/contracts/${c.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <FileText className="h-4 w-4" /> Mở file HĐ
                  </a>
                )}
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCEditing(c);
                        setError(null);
                        setCOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => onDeleteContract(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <Table>
              <THead>
                <tr>
                  <Th>Hạng mục</Th>
                  <Th className="text-right">Khối lượng</Th>
                  <Th className="text-right">Đơn giá</Th>
                  <Th className="text-right">Thành tiền</Th>
                  {canEdit && <Th></Th>}
                </tr>
              </THead>
              <tbody>
                {c.items.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium text-slate-900">
                      {r.name}
                      {r.unit ? <span className="text-slate-400"> ({r.unit})</span> : null}
                    </Td>
                    <Td className="text-right">{formatNumber(r.qty)}</Td>
                    <Td className="text-right">{formatNumber(r.unitPrice)}</Td>
                    <Td className="text-right font-medium">{formatVND(lineAmount(r))}</Td>
                    {canEdit && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setIContractId(c.id);
                              setIEditing(r);
                              setError(null);
                              setIOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => onDeleteItem(c.id, r)}
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

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 p-4">
              <div className="space-y-1">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIContractId(c.id);
                      setIEditing(null);
                      setError(null);
                      setIOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Thêm hạng mục
                  </Button>
                )}
                {c.paymentTerms && (
                  <p className="max-w-xl pt-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Thanh toán: </span>
                    {c.paymentTerms}
                  </p>
                )}
              </div>
              <dl className="min-w-[16rem] space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Giá trị chưa VAT</dt>
                  <dd className="font-medium text-slate-900">{formatVND(totals.beforeVat)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">VAT ({c.vatPercent ?? 0}%)</dt>
                  <dd className="text-slate-700">{formatVND(totals.vat)}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <dt className="font-medium text-slate-700">Tổng (gồm VAT)</dt>
                  <dd className="font-bold text-green-600">{formatVND(totals.withVat)}</dd>
                </div>
              </dl>
            </div>
          </div>
        );
      })}

      {/* Modal hợp đồng */}
      <Modal
        open={cOpen}
        onClose={() => setCOpen(false)}
        title={cEditing ? "Sửa hợp đồng" : "Thêm hợp đồng"}
      >
        <form onSubmit={onContractSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số hợp đồng">
              <Input name="contractNo" defaultValue={cEditing?.contractNo ?? ""} />
            </Field>
            <Field label="Ngày ký">
              <Input
                name="signDate"
                type="date"
                defaultValue={cEditing?.signDate ? cEditing.signDate.slice(0, 10) : ""}
              />
            </Field>
          </div>
          <Field label="Trích yếu (V/v)">
            <Input name="subject" defaultValue={cEditing?.subject ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chủ đầu tư (Bên A)">
              <Input name="partyAName" defaultValue={cEditing?.partyAName ?? ""} />
            </Field>
            <Field label="Trạng thái *">
              <Select name="status" defaultValue={cEditing?.status ?? "QUOTE"}>
                {CONTRACT_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Thông tin Bên A (địa chỉ, MST, người đại diện)">
            <Textarea name="partyAInfo" defaultValue={cEditing?.partyAInfo ?? ""} />
          </Field>
          <Field label="VAT (%)">
            <Input
              name="vatPercent"
              type="number"
              step="any"
              defaultValue={cEditing?.vatPercent ?? 8}
            />
          </Field>
          <Field label="Điều khoản thanh toán">
            <Textarea name="paymentTerms" defaultValue={cEditing?.paymentTerms ?? ""} />
          </Field>
          <Field label="Đường dẫn file HĐ (.pdf/.docx trên ổ đĩa)">
            <Input name="filePath" defaultValue={cEditing?.filePath ?? ""} />
          </Field>
          <Field label="Ghi chú">
            <Textarea name="note" defaultValue={cEditing?.note ?? ""} />
          </Field>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal hạng mục */}
      <Modal
        open={iOpen}
        onClose={() => setIOpen(false)}
        title={iEditing ? "Sửa hạng mục" : "Thêm hạng mục"}
      >
        <form onSubmit={onItemSubmit} className="space-y-3">
          <Field label="Tên hạng mục *">
            <Input name="name" defaultValue={iEditing?.name ?? ""} required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Đơn vị">
              <Input name="unit" defaultValue={iEditing?.unit ?? ""} placeholder="m², bộ…" />
            </Field>
            <Field label="Khối lượng">
              <Input name="qty" type="number" step="any" defaultValue={iEditing?.qty ?? ""} />
            </Field>
            <Field label="Đơn giá">
              <Input
                name="unitPrice"
                type="number"
                step="any"
                defaultValue={iEditing?.unitPrice ?? ""}
              />
            </Field>
          </div>
          <Field label="Thành tiền (để trống = KL × đơn giá)">
            <Input name="amount" type="number" step="any" defaultValue={iEditing?.amount ?? ""} />
          </Field>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIOpen(false)}>
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
