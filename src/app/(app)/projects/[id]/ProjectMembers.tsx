"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { addProjectMember, removeProjectMember } from "./memberActions";

export interface MemberUser {
  id: string;
  name: string;
  role: Role;
}

export function ProjectMembers({
  projectId,
  members,
  allUsers,
}: {
  projectId: string;
  members: MemberUser[];
  allUsers: MemberUser[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [pending, start] = useTransition();
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = allUsers.filter((u) => u.role !== "ADMIN" && !memberIds.has(u.id));

  function add() {
    if (!pick) return;
    start(async () => {
      await addProjectMember(projectId, pick);
      setPick("");
      router.refresh();
    });
  }
  function remove(userId: string) {
    start(async () => {
      await removeProjectMember(projectId, userId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Thành viên dự án</h3>
      <p className="mb-3 text-xs text-slate-400">
        Người được gán sẽ nhập nhanh được dữ liệu cho dự án này (theo vai trò). Ban giám đốc luôn thấy mọi dự án.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {members.length === 0 && <span className="text-sm text-slate-400">Chưa gán ai.</span>}
        {members.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
            <span className="font-medium text-slate-800">{m.name}</span>
            <span className="text-xs text-slate-400">{ROLE_LABEL[m.role]}</span>
            <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => remove(m.id)} disabled={pending}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Select className="max-w-xs" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">— Chọn người để gán —</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {ROLE_LABEL[u.role]}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={add} disabled={pending || !pick}>
          <UserPlus className="h-4 w-4" /> Gán
        </Button>
      </div>
    </div>
  );
}
