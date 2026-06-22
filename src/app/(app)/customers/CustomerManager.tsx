"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { saveCustomer, deleteCustomer } from "./actions";

export interface CustomerRow {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  projectCount: number;
}

export function CustomerManager({
  customers,
  canEdit,
}: {
  customers: CustomerRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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

  function onDelete(c: CustomerRow) {
    if (!window.confirm(`Xóa CĐT "${c.name}"?`)) return;
    start(async () => {
      const res = await deleteCustomer(c.id);
      if (!res.ok) alert(res.error);
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
              {canEdit && <Th className="text-right">Thao tác</Th>}
            </tr>
          </THead>
          <tbody>
            {customers.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium text-slate-900">{c.name}</Td>
                <Td>{c.contactPerson || "—"}</Td>
                <Td>{c.phone || "—"}</Td>
                <Td>{c.address || "—"}</Td>
                <Td>{c.projectCount}</Td>
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
            ))}
            {customers.length === 0 && (
              <Tr>
                <Td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-slate-400">
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
          <div className="grid grid-cols-2 gap-3">
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
