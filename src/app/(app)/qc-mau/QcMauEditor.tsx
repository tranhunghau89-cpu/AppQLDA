"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { QC_GIAI_DOAN, QC_LOAI, QC_LOAI_MAP } from "@/lib/constants";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { dongTieuChi } from "@/lib/qc";
import { TieuChiEditor } from "./TieuChiEditor";
import { batTatQcMau, doiThuTuQcMau, luuQcMau } from "./actions";

interface MauRow {
  id: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
  loai: string;
  tieuChi: string | null;
  active: boolean;
}
type Draft = {
  id?: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
  loai: string;
  tieuChi: string | null;
};

export function QcMauEditor({ mau }: { mau: MauRow[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  function run(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      after?.();
    });
  }
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  const form = draft && (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
      <Input
        className="sm:col-span-2"
        placeholder="Nội dung kiểm tra *"
        value={draft.noiDung}
        onChange={set("noiDung")}
      />
      <Select value={draft.boPhan} onChange={set("boPhan")}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
      <Select value={draft.loai} onChange={set("loai")}>
        {QC_LOAI.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <TieuChiEditor
        className="sm:col-span-4"
        value={draft.tieuChi ?? ""}
        onChange={(v) => setDraft((d) => (d ? { ...d, tieuChi: v } : d))}
      />
      <div className="flex gap-2 sm:col-span-4">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => luuQcMau(draft),
              () => setDraft(null),
            )
          }
        >
          Lưu
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
          Huỷ
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {QC_GIAI_DOAN.map((gd) => {
        const ds = mau.filter((m) => m.giaiDoan === gd.value);
        return (
          <div
            key={gd.value}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <span className="font-semibold text-slate-800">
                {gd.label}{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({ds.filter((m) => m.active).length} mục)
                </span>
              </span>
              {!draft && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      giaiDoan: gd.value,
                      noiDung: "",
                      boPhan: "ENGINEERING",
                      loai: "THUONG",
                      tieuChi: "",
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Thêm mục
                </Button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {ds.map((m, i) =>
                draft?.id === m.id ? (
                  <div key={m.id} className="p-3">
                    {form}
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm ${m.active ? "" : "opacity-50"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-900">{m.noiDung}</span>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{ROLE_LABEL[m.boPhan as Role] ?? m.boPhan}</span>
                        {m.loai !== "THUONG" && (
                          <Badge tone="purple">
                            {QC_LOAI_MAP[m.loai]?.label}
                          </Badge>
                        )}
                        {!m.active && <Badge>Đã tắt</Badge>}
                      </div>
                      {m.tieuChi && (
                        <ol className="mt-1 list-decimal pl-5 text-xs text-slate-600">
                          {dongTieuChi(m.tieuChi).map((t, k) => (
                            <li key={k}>{t}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Lên"
                        disabled={pending || i === 0}
                        onClick={() => run(() => doiThuTuQcMau(m.id, -1))}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Xuống"
                        disabled={pending || i === ds.length - 1}
                        onClick={() => run(() => doiThuTuQcMau(m.id, 1))}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Sửa"
                        onClick={() =>
                          setDraft({
                            id: m.id,
                            giaiDoan: m.giaiDoan,
                            noiDung: m.noiDung,
                            boPhan: m.boPhan,
                            loai: m.loai,
                            tieuChi: m.tieuChi,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={m.active ? "Tắt" : "Bật"}
                        disabled={pending}
                        onClick={() => run(() => batTatQcMau(m.id, !m.active))}
                      >
                        {m.active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ),
              )}
              {draft && !draft.id && draft.giaiDoan === gd.value && (
                <div className="p-3">{form}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
