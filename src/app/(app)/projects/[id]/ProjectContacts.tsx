"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { CONTACT_ROLE, CONTACT_ROLE_MAP } from "@/lib/constants";
import { deleteContact, saveContact } from "./overviewActions";

export interface ContactRow {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
}
type Draft = { id?: string; name: string; role: string; phone: string; email: string; note: string };
const EMPTY: Draft = { name: "", role: "", phone: "", email: "", note: "" };

export function ProjectContacts({
  projectId,
  contacts,
  canEdit,
}: {
  projectId: string;
  contacts: ContactRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!draft) return;
    start(async () => {
      const r = await saveContact(projectId, draft);
      if (!r.ok) return toast.error(r.error);
      setDraft(null);
      router.refresh();
    });
  }

  function remove(c: ContactRow) {
    if (!confirm(`Xoá người liên hệ "${c.name}"?`)) return;
    start(async () => {
      const r = await deleteContact(projectId, c.id);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  return (
    <div className="space-y-2">
      {contacts.length === 0 && !draft && (
        <p className="text-sm text-slate-400">Chưa có người liên hệ</p>
      )}
      {contacts.map((c) =>
        draft?.id === c.id ? null : (
          <div
            key={c.id}
            className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{c.name}</span>
                {c.role && <Badge tone="blue">{CONTACT_ROLE_MAP[c.role]?.label ?? c.role}</Badge>}
              </div>
              <div className="text-slate-600">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="hover:underline">
                    {c.phone}
                  </a>
                )}
                {c.phone && c.email && <span className="mx-1.5 text-slate-300">·</span>}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="hover:underline">
                    {c.email}
                  </a>
                )}
              </div>
              {c.note && <div className="text-xs text-slate-500">{c.note}</div>}
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sửa"
                  onClick={() =>
                    setDraft({
                      id: c.id,
                      name: c.name,
                      role: c.role ?? "",
                      phone: c.phone ?? "",
                      email: c.email ?? "",
                      note: c.note ?? "",
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Xoá"
                  disabled={pending}
                  onClick={() => remove(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )
      )}
      {draft && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          <Input placeholder="Tên *" value={draft.name} onChange={set("name")} />
          <Select value={draft.role} onChange={set("role")}>
            <option value="">— Vai trò —</option>
            {CONTACT_ROLE.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input placeholder="Điện thoại" value={draft.phone} onChange={set("phone")} />
          <Input placeholder="Email" type="email" value={draft.email} onChange={set("email")} />
          <Input
            className="sm:col-span-2"
            placeholder="Ghi chú"
            value={draft.note}
            onChange={set("note")}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" disabled={pending} onClick={save}>
              Lưu
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
              Huỷ
            </Button>
          </div>
        </div>
      )}
      {canEdit && !draft && (
        <Button size="sm" variant="outline" onClick={() => setDraft(EMPTY)}>
          <Plus className="h-4 w-4" /> Thêm người liên hệ
        </Button>
      )}
    </div>
  );
}
