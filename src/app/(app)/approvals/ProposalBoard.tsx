"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PROPOSAL_KIND, PROPOSAL_KIND_MAP, PROPOSAL_STATUS_MAP } from "@/lib/constants";
import { createProposal, decideProposal, deleteProposal } from "./actions";

export interface ProposalItem {
  id: string;
  title: string;
  kind: string;
  amount: number | null;
  content: string | null;
  projectId: string | null;
  projectCode: string | null;
  status: string;
  createdBy: string;
  decidedBy: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${String(
    d.getDate()
  ).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtVND(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("vi-VN") + " ₫";
}

export function ProposalBoard({
  proposals,
  projects,
  isAdmin,
  userName,
}: {
  proposals: ProposalItem[];
  projects: { id: string; code: string; name: string }[];
  isAdmin: boolean;
  userName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createProposal(form);
      if (!res.ok) setError(res.error);
      else formRef.current?.reset();
    });
  };

  const decide = (id: string, decision: "APPROVED" | "REJECTED") => {
    const note =
      window.prompt(
        decision === "APPROVED" ? "Ghi chú khi duyệt (có thể bỏ trống):" : "Lý do từ chối:"
      ) ?? "";
    if (decision === "REJECTED" && !note.trim()) {
      setError("Cần nhập lý do khi từ chối.");
      return;
    }
    startTransition(async () => {
      const res = await decideProposal(id, decision, note);
      if (!res.ok) setError(res.error);
    });
  };

  const remove = (id: string) => {
    if (!confirm("Xóa đề xuất này?")) return;
    startTransition(async () => {
      const res = await deleteProposal(id);
      if (!res.ok) setError(res.error);
    });
  };

  const counts = {
    PENDING: proposals.filter((p) => p.status === "PENDING").length,
    APPROVED: proposals.filter((p) => p.status === "APPROVED").length,
    REJECTED: proposals.filter((p) => p.status === "REJECTED").length,
  };
  const shown = filter === "ALL" ? proposals : proposals.filter((p) => p.status === filter);

  return (
    <div className="space-y-6">
      {/* Thẻ đếm + lọc */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            ["ALL", "Tất cả", proposals.length, "text-slate-900"],
            ["PENDING", "Chờ duyệt", counts.PENDING, "text-amber-600"],
            ["APPROVED", "Đã duyệt", counts.APPROVED, "text-green-600"],
            ["REJECTED", "Từ chối", counts.REJECTED, "text-red-600"],
          ] as const
        ).map(([key, label, count, cls]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-xl border bg-white p-4 text-left transition ${
              filter === key ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"
            }`}
          >
            <div className="text-sm text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${cls}`}>{count}</div>
          </button>
        ))}
      </div>

      {/* Form tạo đề xuất */}
      <form
        ref={formRef}
        action={submit}
        className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-6"
      >
        <input
          name="title"
          placeholder="Tiêu đề đề xuất *"
          required
          className="col-span-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
        <select name="kind" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
          {PROPOSAL_KIND.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          name="amount"
          placeholder="Số tiền (₫)"
          inputMode="numeric"
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
        <select name="projectId" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
          <option value="">— Không gắn dự án —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Đang gửi..." : "Gửi đề xuất"}
        </button>
        <textarea
          name="content"
          rows={2}
          placeholder="Nội dung chi tiết: hạng mục, lý do, nhà cung cấp..."
          className="col-span-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
        {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      </form>

      {/* Danh sách */}
      <div className="space-y-3">
        {shown.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-400">
            Không có đề xuất nào.
          </p>
        )}
        {shown.map((p) => {
          const kind = PROPOSAL_KIND_MAP[p.kind];
          const st = PROPOSAL_STATUS_MAP[p.status];
          const canDelete = isAdmin || (p.createdBy === userName && p.status === "PENDING");
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={kind?.tone ?? "slate"}>{kind?.label ?? p.kind}</Badge>
                    <span className="font-semibold text-slate-900">{p.title}</span>
                    <Badge tone={st?.tone ?? "slate"}>{st?.label ?? p.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {p.amount != null && (
                      <span className="font-semibold text-blue-600">{fmtVND(p.amount)}</span>
                    )}
                    {p.projectCode && (
                      <>
                        {p.amount != null && <span className="mx-1.5 text-slate-300">·</span>}
                        <Link href={`/projects/${p.projectId}`} className="font-mono text-blue-600 hover:underline">
                          {p.projectCode}
                        </Link>
                      </>
                    )}
                    <span className="mx-1.5 text-slate-300">·</span>
                    {p.createdBy} gửi lúc {fmtDateTime(p.createdAt)}
                  </div>
                  {p.content && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{p.content}</p>
                  )}
                  {p.status !== "PENDING" && (
                    <p className="mt-1.5 text-sm text-slate-500">
                      {st?.label} bởi <span className="font-medium">{p.decidedBy}</span> lúc{" "}
                      {fmtDateTime(p.decidedAt)}
                      {p.decisionNote ? ` — "${p.decisionNote}"` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isAdmin && p.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => decide(p.id, "APPROVED")}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Duyệt
                      </button>
                      <button
                        onClick={() => decide(p.id, "REJECTED")}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Từ chối
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      title="Xóa đề xuất"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
