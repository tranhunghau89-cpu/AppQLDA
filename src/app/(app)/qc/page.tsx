import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { scopedProjectWhere } from "@/lib/scope";
import { sapXepViecQc } from "@/lib/qc";
import { BangViecQc, type ViecQcRow } from "./BangViecQc";
import { TabTrang, TAB_THUC_HIEN } from "@/components/layout/TabTrang";
import { serverNow } from "@/lib/now";

export default async function ViecQcPage() {
  const session = await requireView("project");
  const scope = await scopedProjectWhere(session);
  const laAdmin = session.role === "ADMIN";

  const rows = await db.qcMuc.findMany({
    where: {
      ketQua: { in: ["CHUA", "KHONG_DAT"] },
      ...(laAdmin ? {} : { boPhan: session.role }),
      project: { AND: [scope, { status: { not: "HOAN_THANH" } }] },
    },
    select: {
      id: true,
      giaiDoan: true,
      noiDung: true,
      boPhan: true,
      ketQua: true,
      ghiChu: true,
      project: {
        select: {
          id: true,
          code: true,
          name: true,
          milestones: { select: { type: true, planDate: true, done: true } },
        },
      },
    },
  });

  const viec = rows
    .map((r) => {
      const moc = r.project.milestones.find((m) => m.type === r.giaiDoan);
      return { ...r, han: moc?.planDate ?? null, mocXong: moc?.done ?? false };
    })
    .sort(sapXepViecQc);

  const data: ViecQcRow[] = viec.map((r) => ({
    id: r.id,
    projectId: r.project.id,
    projectCode: r.project.code,
    projectName: r.project.name,
    giaiDoan: r.giaiDoan,
    noiDung: r.noiDung,
    boPhan: r.boPhan,
    ketQua: r.ketQua,
    ghiChu: r.ghiChu,
    han: r.han?.toISOString() ?? null,
    mocXong: r.mocXong,
  }));

  return (
    <div className="space-y-6">
      <TabTrang tabs={TAB_THUC_HIEN} hienTai="/qc" role={session.role} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Việc QC</h1>
        <p className="text-sm text-slate-500">
          {laAdmin
            ? "Mục QC chưa kiểm hoặc không đạt của mọi bộ phận, ở các dự án đang chạy"
            : "Mục QC của bộ phận bạn chưa kiểm hoặc không đạt, ở các dự án bạn được giao"}
        </p>
      </div>
      <BangViecQc rows={data} laAdmin={laAdmin} nowMs={serverNow()} />
    </div>
  );
}
