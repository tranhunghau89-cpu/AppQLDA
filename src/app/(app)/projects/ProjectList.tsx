"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PROJECT_STATUS } from "@/lib/constants";
import { formatVND, formatDate, formatNumber } from "@/lib/utils";
import { saveProject } from "./actions";

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  buildingType: string | null;
  status: string;
  location: string | null;
  customerId: string | null;
  customerName: string | null;
  startDate: string | null;
  endDate: string | null;
  kK: number | null;
  kL: number | null;
  kH: number | null;
  area: number | null;
  salePrice: number | null;
  note: string | null;
}

export interface CustomerOption {
  id: string;
  name: string;
}

function toInputDate(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

export function ProjectList({
  projects,
  customers,
  canEdit,
}: {
  projects: ProjectRow[];
  customers: CustomerOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("ALL");
  const [customer, setCustomer] = useState("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (customer !== "ALL" && p.customerId !== customer) return false;
      if (
        term &&
        !`${p.code} ${p.name} ${p.location ?? ""}`.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [projects, status, customer, q]);

  function openNew() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }
  function openEdit(p: ProjectRow) {
    setEditing(p);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveProject(editing?.id ?? null, form);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="w-64 pl-9"
            placeholder="Tìm mã / tên / vị trí…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">Tất cả trạng thái</option>
          {PROJECT_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select className="w-52" value={customer} onChange={(e) => setCustomer(e.target.value)}>
          <option value="ALL">Tất cả CĐT</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-500">{list.length} dự án</span>
          {canEdit && (
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4" /> Thêm dự án
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Mã</Th>
              <Th>Tên dự án</Th>
              <Th>Trạng thái</Th>
              <Th>CĐT</Th>
              <Th>Vị trí</Th>
              <Th className="text-right">DT (m²)</Th>
              <Th className="text-right">Giá bán</Th>
              <Th>Bắt đầu</Th>
            </tr>
          </THead>
          <tbody>
            {list.map((p) => (
              <Tr key={p.id}>
                <Td className="font-mono font-medium text-slate-900">
                  <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                    {p.code}
                  </Link>
                </Td>
                <Td className="font-medium text-slate-900">{p.name}</Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td>{p.customerName || "—"}</Td>
                <Td>{p.location || "—"}</Td>
                <Td className="text-right">{formatNumber(p.area)}</Td>
                <Td className="text-right">{p.salePrice ? formatVND(p.salePrice) : "—"}</Td>
                <Td>{formatDate(p.startDate)}</Td>
              </Tr>
            ))}
            {list.length === 0 && (
              <Tr>
                <Td colSpan={8} className="py-8 text-center text-slate-400">
                  Không có dự án phù hợp
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Sửa dự án ${editing.code}` : "Thêm dự án"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mã dự án *">
              <Input name="code" defaultValue={editing?.code ?? ""} required />
            </Field>
            <Field label="Tên dự án *">
              <Input name="name" defaultValue={editing?.name ?? ""} required />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Loại công trình">
              <Input name="buildingType" defaultValue={editing?.buildingType ?? ""} />
            </Field>
            <Field label="Trạng thái">
              <Select name="status" defaultValue={editing?.status ?? "CHO"}>
                {PROJECT_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vị trí">
              <Input name="location" defaultValue={editing?.location ?? ""} />
            </Field>
          </div>
          <Field label="Chủ đầu tư">
            <Select name="customerId" defaultValue={editing?.customerId ?? ""}>
              <option value="">— Chưa gán —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bước khung K">
              <Input name="kK" type="number" step="any" defaultValue={editing?.kK ?? ""} />
            </Field>
            <Field label="Chiều dài L">
              <Input name="kL" type="number" step="any" defaultValue={editing?.kL ?? ""} />
            </Field>
            <Field label="Chiều cao H">
              <Input name="kH" type="number" step="any" defaultValue={editing?.kH ?? ""} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Diện tích (m²)">
              <Input name="area" type="number" step="any" defaultValue={editing?.area ?? ""} />
            </Field>
            <Field label="Giá bán (₫)">
              <Input name="salePrice" type="number" step="any" defaultValue={editing?.salePrice ?? ""} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày bắt đầu">
              <Input name="startDate" type="date" defaultValue={toInputDate(editing?.startDate ?? null)} />
            </Field>
            <Field label="Ngày hoàn thành">
              <Input name="endDate" type="date" defaultValue={toInputDate(editing?.endDate ?? null)} />
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
