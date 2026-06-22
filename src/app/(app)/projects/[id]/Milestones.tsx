"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { MILESTONE_TYPE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { upsertMilestone } from "../actions";

export interface MilestoneValue {
  planDate: string | null;
  actualDate: string | null;
  done: boolean;
  note: string | null;
}

function toInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

function Row({
  projectId,
  type,
  label,
  value,
  canEdit,
}: {
  projectId: string;
  type: string;
  label: string;
  value: MilestoneValue;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(toInput(value.planDate));
  const [actual, setActual] = useState(toInput(value.actualDate));
  const [done, setDone] = useState(value.done);
  const [note, setNote] = useState(value.note ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await upsertMilestone(projectId, type, {
        planDate: plan,
        actualDate: actual,
        done,
        note,
      });
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  if (!canEdit) {
    return (
      <div className="grid grid-cols-12 items-center gap-2 py-2 text-sm">
        <span className="col-span-3 font-medium text-slate-600">{label}</span>
        <span className="col-span-3">{formatDate(value.planDate)}</span>
        <span className="col-span-3">{formatDate(value.actualDate)}</span>
        <span className="col-span-3">
          {value.done ? (
            <span className="inline-flex items-center gap-1 text-green-600">
              <Check className="h-4 w-4" /> Xong
            </span>
          ) : (
            <span className="text-slate-400">Chưa</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 items-center gap-2 py-2">
      <span className="col-span-2 text-sm font-medium text-slate-600">{label}</span>
      <Input
        className="col-span-3 h-9"
        type="date"
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
      />
      <Input
        className="col-span-3 h-9"
        type="date"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
      />
      <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
          className="h-4 w-4"
        />
        Xong
      </label>
      <div className="col-span-2 text-right">
        <Button size="sm" variant="outline" onClick={save} disabled={pending}>
          Lưu
        </Button>
      </div>
    </div>
  );
}

export function Milestones({
  projectId,
  milestones,
  canEdit,
}: {
  projectId: string;
  milestones: Record<string, MilestoneValue>;
  canEdit: boolean;
}) {
  const empty: MilestoneValue = { planDate: null, actualDate: null, done: false, note: null };
  return (
    <div className="divide-y divide-slate-100">
      <div className="grid grid-cols-12 gap-2 pb-1 text-xs font-medium uppercase text-slate-400">
        <span className={canEdit ? "col-span-2" : "col-span-3"}>Mốc</span>
        <span className="col-span-3">Kế hoạch</span>
        <span className="col-span-3">Thực tế</span>
        <span className={canEdit ? "col-span-4" : "col-span-3"}>Trạng thái</span>
      </div>
      {MILESTONE_TYPE.map((m) => (
        <Row
          key={m.value}
          projectId={projectId}
          type={m.value}
          label={m.label}
          value={milestones[m.value] ?? empty}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
