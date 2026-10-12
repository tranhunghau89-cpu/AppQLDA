"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { MILESTONE_TYPE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { trangThaiMoc, type TrangThaiMoc } from "@/lib/projectHealth";
import { upsertMilestone } from "../actions";
import { useToast } from "@/components/ui/toast";

export interface MilestoneValue {
  planDate: string | null;
  actualDate: string | null;
  done: boolean;
  note: string | null;
}

// Tô màu theo giá trị ĐÃ LƯU, không theo ô đang gõ.
const MAU_MOC: Record<TrangThaiMoc, string> = {
  XONG: "border-l-green-500",
  TRE: "border-l-red-500 bg-red-50",
  SAP_DEN: "border-l-amber-500 bg-amber-50",
  DUNG_HAN: "border-l-slate-300",
  CHUA_CO: "border-l-slate-200",
};

function toInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

function Row({
  projectId,
  type,
  label,
  value,
  canEdit,
  nowMs,
}: {
  projectId: string;
  type: string;
  label: string;
  value: MilestoneValue;
  canEdit: boolean;
  nowMs: number;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(toInput(value.planDate));
  const [actual, setActual] = useState(toInput(value.actualDate));
  const [done, setDone] = useState(value.done);
  // Chưa có ô nhập ghi chú mốc trên UI; vẫn gửi giá trị hiện có lên server để không mất dữ liệu.
  const [note] = useState(value.note ?? "");
  const [pending, start] = useTransition();
  const toast = useToast();

  function save() {
    start(async () => {
      const res = await upsertMilestone(projectId, type, {
        planDate: plan,
        actualDate: actual,
        done,
        note,
      });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  const mau =
    MAU_MOC[
      trangThaiMoc(
        { planDate: value.planDate ? new Date(value.planDate) : null, done: value.done },
        nowMs
      )
    ];

  if (!canEdit) {
    return (
      <div className={`grid grid-cols-12 items-center gap-2 border-l-4 py-2 pl-2 text-sm ${mau}`}>
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
    <div className={`grid grid-cols-12 items-center gap-2 border-l-4 py-2 pl-2 ${mau}`}>
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
  nowMs,
}: {
  projectId: string;
  milestones: Record<string, MilestoneValue>;
  canEdit: boolean;
  nowMs: number;
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
          nowMs={nowMs}
        />
      ))}
    </div>
  );
}
