"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ROLES, ROLE_LABEL } from "@/lib/rbac";
import { saveUser, deleteUser } from "./actions";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

export function UserManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openNew() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }
  function openEdit(u: UserRow) {
    setEditing(u);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveUser(editing?.id ?? null, form);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function onDelete(u: UserRow) {
    if (!window.confirm(`Xóa người dùng "${u.name}"?`)) return;
    start(async () => {
      const res = await deleteUser(u.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} người dùng</p>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Thêm người dùng
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Tên</Th>
              <Th>Email</Th>
              <Th>Vai trò</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Thao tác</Th>
            </tr>
          </THead>
          <tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td className="font-medium text-slate-900">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-blue-600">(bạn)</span>
                  )}
                </Td>
                <Td>{u.email}</Td>
                <Td>
                  <Badge tone="purple">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}</Badge>
                </Td>
                <Td>
                  {u.active ? (
                    <Badge tone="green">Hoạt động</Badge>
                  ) : (
                    <Badge tone="slate">Khóa</Badge>
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => onDelete(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa người dùng" : "Thêm người dùng"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tên *">
              <Input name="name" defaultValue={editing?.name ?? ""} required />
            </Field>
            <Field label="Email *">
              <Input name="email" type="email" defaultValue={editing?.email ?? ""} required />
            </Field>
          </div>
          <Field label="Vai trò *">
            <Select name="role" defaultValue={editing?.role ?? "SALES"}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={editing ? "Mật khẩu mới (để trống = giữ nguyên)" : "Mật khẩu *"}>
            <Input
              name="password"
              type="password"
              placeholder="Tối thiểu 6 ký tự"
              required={!editing}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing ? editing.active : true}
              className="h-4 w-4"
            />
            Tài khoản hoạt động
          </label>
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
