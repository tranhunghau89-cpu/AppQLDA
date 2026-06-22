"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SUPPLIER_CATEGORY, SUPPLIER_CATEGORY_MAP } from "@/lib/constants";
import { saveSupplier, deleteSupplier } from "./actions";

export interface SupplierRow {
  id: string;
  name: string;
  category: string;
  contactPerson: string | null;
  phone: string | null;
  note: string | null;
  usageCount: number;
}

export function SupplierManager({
  suppliers,
  canEdit,
}: {
  suppliers: SupplierRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [pending, start] = useTransition();

  const list = useMemo(
    () => (filter === "ALL" ? suppliers : suppliers.filter((s) => s.category === filter)),
    [suppliers, filter]
  );

  function openNew() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }
  function openEdit(s: SupplierRow) {
    setEditing(s);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveSupplier(editing?.id ?? null, form);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function onDelete(s: SupplierRow) {
    if (!window.confirm(`Xóa NCC "${s.name}"?`)) return;
    start(async () => {
      const res = await deleteSupplier(s.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Select
          className="max-w-56"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">Tất cả loại ({suppliers.length})</option>
          {SUPPLIER_CATEGORY.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {canEdit && (
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4" /> Thêm NCC
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Tên NCC</Th>
              <Th>Loại</Th>
              <Th>Người phụ trách</Th>
              <Th>Điện thoại</Th>
              <Th>Dùng ở DA</Th>
              {canEdit && <Th className="text-right">Thao tác</Th>}
            </tr>
          </THead>
          <tbody>
            {list.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium text-slate-900">{s.name}</Td>
                <Td>
                  <Badge tone="blue">
                    {SUPPLIER_CATEGORY_MAP[s.category]?.label ?? s.category}
                  </Badge>
                </Td>
                <Td>{s.contactPerson || "—"}</Td>
                <Td>{s.phone || "—"}</Td>
                <Td>{s.usageCount}</Td>
                {canEdit && (
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => onDelete(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
            {list.length === 0 && (
              <Tr>
                <Td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-slate-400">
                  Không có NCC nào
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Tên NCC *">
            <Input name="name" defaultValue={editing?.name ?? ""} required />
          </Field>
          <Field label="Loại NCC *">
            <Select name="category" defaultValue={editing?.category ?? "KCT"}>
              {SUPPLIER_CATEGORY.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Người phụ trách">
              <Input name="contactPerson" defaultValue={editing?.contactPerson ?? ""} />
            </Field>
            <Field label="Điện thoại">
              <Input name="phone" defaultValue={editing?.phone ?? ""} />
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
