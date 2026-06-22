"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PROJECT_STATUS, PROJECT_COMPONENT } from "@/lib/constants";
import { updateStatus, setProjectSupplier } from "../actions";

export interface SupplierOption {
  id: string;
  name: string;
  category: string;
}

export function StatusChanger({
  projectId,
  status,
  canEdit,
}: {
  projectId: string;
  status: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!canEdit) return <StatusBadge status={status} />;

  return (
    <Select
      className="w-44"
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          const res = await updateStatus(projectId, next);
          if (!res.ok) alert(res.error);
          else router.refresh();
        });
      }}
    >
      {PROJECT_STATUS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </Select>
  );
}

export function SupplierAssigner({
  projectId,
  assigned,
  suppliers,
  canEdit,
}: {
  projectId: string;
  assigned: Record<string, { id: string; name: string }>;
  suppliers: SupplierOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function assign(component: string, supplierId: string) {
    setBusy(component);
    start(async () => {
      const res = await setProjectSupplier(projectId, component, supplierId || null);
      setBusy(null);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="divide-y divide-slate-100">
      {PROJECT_COMPONENT.map((comp) => {
        const current = assigned[comp.value];
        const options = suppliers.filter(
          (s) => s.category === comp.value || s.id === current?.id
        );
        return (
          <div key={comp.value} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-medium text-slate-600">{comp.label}</span>
            {canEdit ? (
              <Select
                className="w-56"
                value={current?.id ?? ""}
                disabled={pending && busy === comp.value}
                onChange={(e) => assign(comp.value, e.target.value)}
              >
                <option value="">— Chưa gán —</option>
                {options.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-sm text-slate-900">{current?.name ?? "—"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
