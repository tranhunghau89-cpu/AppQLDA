import { AUDIT_ACTION_LABEL, AUDIT_ENTITY, FIELD_LABEL } from "@/lib/audit";
import type { AuditAction, AuditEntity, Changes } from "@/lib/audit";
import { formatNumber } from "@/lib/utils";

export interface AuditRow {
  id: string;
  actorName: string;
  actorRole: string;
  entity: string;
  entityId: string;
  entityLabel: string | null;
  projectId: string | null;
  action: string;
  changes: unknown;
  createdAt: string; // ISO
}

const ACTION_STYLE: Record<string, string> = {
  CREATE: "bg-green-50 text-green-700",
  UPDATE: "bg-blue-50 text-blue-700",
  DELETE: "bg-red-50 text-red-700",
};

/** Các trường là tiền — hiển thị có phân cách nghìn. */
const TRUONG_TIEN = new Set([
  "salePrice",
  "amount",
  "paidAmount",
  "unitPrice",
  "valueBeforeVat",
  "valueWithVat",
  "material",
  "laborMachine",
  "baseCost",
]);

function fmtThoiGian(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtGiaTri(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "có" : "không";
  if (typeof v === "number") return TRUONG_TIEN.has(field) ? formatNumber(v) : String(v);
  if (typeof v === "string") {
    // Chuỗi ISO ngày -> dd/MM/yyyy cho dễ đọc
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return v;
  }
  return JSON.stringify(v);
}

function laChanges(v: unknown): v is Changes {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Danh sách nhật ký thay đổi — dùng chung cho trang /audit và tab Lịch sử của dự án.
 * Là Server Component thuần (không state), nên nhúng ở đâu cũng được.
 */
export function AuditEntries({
  rows,
  showProject = false,
}: {
  rows: AuditRow[];
  /** Hiện cột dự án (trang /audit); ở trong 1 dự án thì thừa. */
  showProject?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Chưa có thay đổi nào được ghi.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => {
        const entityLabel = AUDIT_ENTITY[r.entity as AuditEntity] ?? r.entity;
        const changes = laChanges(r.changes) ? r.changes : null;
        return (
          <li key={r.id} className="py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  ACTION_STYLE[r.action] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {AUDIT_ACTION_LABEL[r.action as AuditAction] ?? r.action}
              </span>
              <span className="font-medium text-slate-800">{entityLabel}</span>
              {r.entityLabel && (
                <span className="font-mono text-xs text-slate-500">{r.entityLabel}</span>
              )}
              {showProject && r.projectId && (
                <span className="text-xs text-slate-400">· dự án {r.projectId.slice(0, 8)}</span>
              )}
              <span className="ml-auto text-xs text-slate-400">
                {r.actorName} · {fmtThoiGian(r.createdAt)}
              </span>
            </div>

            {changes && (
              <div className="mt-1.5 space-y-0.5 pl-1">
                {Object.entries(changes).map(([field, ch]) => (
                  <div key={field} className="flex flex-wrap items-baseline gap-1.5 text-xs">
                    <span className="text-slate-500">{FIELD_LABEL[field] ?? field}:</span>
                    <span className="text-slate-400 line-through">
                      {fmtGiaTri(field, ch?.truoc)}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="font-medium text-slate-800">{fmtGiaTri(field, ch?.sau)}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
