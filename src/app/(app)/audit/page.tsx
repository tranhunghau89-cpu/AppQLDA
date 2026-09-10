import Link from "next/link";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY } from "@/lib/audit";
import { AuditEntries, type AuditRow } from "@/components/audit/AuditEntries";

const MOI_TRANG = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; actor?: string; trang?: string }>;
}) {
  await requireView("audit");
  const sp = await searchParams;

  const entity = sp.entity && sp.entity in AUDIT_ENTITY ? sp.entity : undefined;
  const action =
    sp.action && sp.action in AUDIT_ACTION_LABEL ? sp.action : undefined;
  const actorId = sp.actor || undefined;
  const trang = Math.max(1, Number(sp.trang) || 1);

  const where = {
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
  };

  // Nhật ký là bảng CHỈ TĂNG, không như danh sách dự án — ở đây phân trang là cần thiết.
  const [rows, tong, actors] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MOI_TRANG,
      skip: (trang - 1) * MOI_TRANG,
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      distinct: ["actorId"],
      select: { actorId: true, actorName: true },
      orderBy: { actorName: "asc" },
    }),
  ]);

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));
  const items: AuditRow[] = rows.map((r) => ({
    id: r.id,
    actorName: r.actorName,
    actorRole: r.actorRole,
    entity: r.entity,
    entityId: r.entityId,
    entityLabel: r.entityLabel,
    projectId: r.projectId,
    action: r.action,
    changes: r.changes,
    createdAt: r.createdAt.toISOString(),
  }));

  function href(patch: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    const merged = { entity, action, actor: actorId, trang: String(trang), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/audit${q.toString() ? `?${q}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nhật ký thay đổi</h1>
        <p className="text-sm text-slate-500">
          Ai đổi gì, lúc nào — trên các dữ liệu liên quan tới tiền (dự án, hợp đồng, thanh
          toán, báo giá, bảng đơn giá). Chỉ đọc, không sửa được.
        </p>
      </div>

      {/* Bộ lọc — dùng link thay vì form để không cần JavaScript phía client */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <Loc nhan="Thực thể" tatCa={href({ entity: undefined, trang: "1" })} dangChon={!entity}>
          {Object.entries(AUDIT_ENTITY).map(([k, v]) => (
            <Chip key={k} href={href({ entity: k, trang: "1" })} active={entity === k}>
              {v}
            </Chip>
          ))}
        </Loc>
        <Loc nhan="Thao tác" tatCa={href({ action: undefined, trang: "1" })} dangChon={!action}>
          {Object.entries(AUDIT_ACTION_LABEL).map(([k, v]) => (
            <Chip key={k} href={href({ action: k, trang: "1" })} active={action === k}>
              {v}
            </Chip>
          ))}
        </Loc>
        {actors.length > 0 && (
          <Loc nhan="Người thực hiện" tatCa={href({ actor: undefined, trang: "1" })} dangChon={!actorId}>
            {actors.map((a) => (
              <Chip key={a.actorId} href={href({ actor: a.actorId, trang: "1" })} active={actorId === a.actorId}>
                {a.actorName}
              </Chip>
            ))}
          </Loc>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4">
        <AuditEntries rows={items} showProject />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {tong.toLocaleString("vi-VN")} thay đổi · trang {trang}/{soTrang}
        </span>
        <div className="flex gap-2">
          {trang > 1 && (
            <Link
              href={href({ trang: String(trang - 1) })}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
            >
              ← Trước
            </Link>
          )}
          {trang < soTrang && (
            <Link
              href={href({ trang: String(trang + 1) })}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
            >
              Sau →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Loc({
  nhan,
  tatCa,
  dangChon,
  children,
}: {
  nhan: string;
  tatCa: string;
  dangChon: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{nhan}</div>
      <div className="flex flex-wrap gap-1.5">
        <Chip href={tatCa} active={dangChon}>
          Tất cả
        </Chip>
        {children}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}
