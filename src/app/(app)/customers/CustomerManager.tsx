"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatVND } from "@/lib/utils";
import { saveCustomer, deleteCustomer } from "./actions";
import { useConfirm } from "@/components/ui/confirm";
import { InteractionLog, type NoteView } from "@/components/crm/InteractionLog";
import { useToast } from "@/components/ui/toast";

export interface CustomerRow {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  projectCount: number;
  receivable: number | null;
  debtProjects: { projectId: string; label: string; receivable: number }[];
  notes: NoteView[];
}

export function CustomerManager({
  customers,
  canEdit,
  canViewDebt,
}: {
  customers: CustomerRow[];
  canEdit: boolean;
  canViewDebt: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const colCount = 5 + (canViewDebt ? 1 : 0) + (canEdit ? 1 : 0);

  function openNew() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }
  function openEdit(c: CustomerRow) {
    setEditing(c);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveCustomer(editing?.id ?? null, form);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  async function onDelete(c: CustomerRow) {
    if (!(await confirm(`Xóa CĐT "${c.name}"?`))) return;
    start(async () => {
      const res = await deleteCustomer(c.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{customers.length} chủ đầu tư</p>
        {canEdit && (
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4" /> Thêm CĐT
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Tên CĐT</Th>
              <Th>Người phụ trách</Th>
              <Th>Điện thoại</Th>
              <Th>Địa chỉ</Th>
              <Th>Số DA</Th>
              {canViewDebt && <Th className="text-right">Còn phải thu</Th>}
              {canEdit && <Th className="text-right">Thao tác</Th>}
            </tr>
          </THead>
          <tbody>
            {customers.map((c) => {
              const isOpen = expanded.has(c.id);
              return (
                <FragmentRow key={c.id}>
                  <Tr>
                    <Td className="font-medium text-slate-900">
                      {/* Hàng nào cũng mở rộng được: nhật ký trao đổi luôn có chỗ,
                          kể cả CĐT chưa phát sinh công nợ. Vào được trang này nghĩa
                          là đã qua requireView("customer"), nên không cần gác thêm. */}
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className="inline-flex items-center gap-1 hover:text-blue-600"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        {c.name}
                        {c.notes.length > 0 && (
                          <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-xs font-normal text-slate-500">
                            {c.notes.length}
                          </span>
                        )}
                      </button>
                    </Td>
                    <Td>{c.contactPerson || "—"}</Td>
                    <Td>{c.phone || "—"}</Td>
                    <Td>{c.address || "—"}</Td>
                    <Td>{c.projectCount}</Td>
                    {canViewDebt && (
                      <Td className="text-right font-semibold text-blue-700">
                        {c.receivable == null ? "—" : formatVND(c.receivable)}
                      </Td>
                    )}
                    {canEdit && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => onDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                  {isOpen &&
                    canViewDebt &&
                    c.debtProjects.map((p) => (
                      <tr
                        key={p.projectId}
                        className="border-b border-slate-100 bg-slate-50/60"
                      >
                        <Td className="pl-9" colSpan={5}>
                          <Link
                            href={`/projects/${p.projectId}`}
                            className="text-slate-700 hover:text-blue-600 hover:underline"
                          >
                            {p.label}
                          </Link>
                        </Td>
                        <Td className="text-right text-blue-700">
                          {formatVND(p.receivable)}
                        </Td>
                        {canEdit && <Td />}
                      </tr>
                    ))}
                  {isOpen && (
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <td colSpan={colCount} className="px-4 py-3">
                        <InteractionLog
                          chu={{ loai: "CDT", id: c.id }}
                          notes={c.notes}
                          canEdit={canEdit}
                          trong
                        />
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
            {customers.length === 0 && (
              <Tr>
                <Td colSpan={colCount} className="py-8 text-center text-slate-400">
                  Chưa có chủ đầu tư nào
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa chủ đầu tư" : "Thêm chủ đầu tư"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Tên CĐT *">
            <Input name="name" defaultValue={editing?.name ?? ""} required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Người phụ trách">
              <Input name="contactPerson" defaultValue={editing?.contactPerson ?? ""} />
            </Field>
            <Field label="Điện thoại">
              <Input name="phone" defaultValue={editing?.phone ?? ""} />
            </Field>
          </div>
          <Field label="Địa chỉ">
            <Input name="address" defaultValue={editing?.address ?? ""} />
          </Field>
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

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
