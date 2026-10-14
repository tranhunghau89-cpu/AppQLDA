import { requireView } from "@/lib/auth";
import { db } from "@/lib/db";
import { scopedProjectWhere } from "@/lib/scope";
import { serverNow } from "@/lib/now";
import { napQuyTrinhNhieu } from "@/lib/quyTrinhDb";
import { TabTrang, TAB_THUC_HIEN } from "@/components/layout/TabTrang";
import { BangViecQuyTrinh, type DuAnQuyTrinh } from "./BangViecQuyTrinh";

// Việc quy trình: bước tôi phụ trách, bước chờ tôi duyệt, bước quá hạn — trên các dự án đang chạy.
export default async function ViecQuyTrinhPage() {
  const session = await requireView("project");
  const scope = await scopedProjectWhere(session);

  const projects = await db.project.findMany({
    where: { AND: [scope, { status: { not: "HOAN_THANH" } }] },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  const quyTrinh = await napQuyTrinhNhieu(projects.map((p) => p.id));

  const duAn: DuAnQuyTrinh[] = projects.map((p) => ({
    projectId: p.id,
    code: p.code,
    name: p.name,
    buoc: quyTrinh.get(p.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <TabTrang tabs={TAB_THUC_HIEN} hienTai="/quy-trinh" role={session.role} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Việc quy trình</h1>
        <p className="text-sm text-slate-500">
          Các bước Thông tin dự án / QC giai đoạn đang mở trên những dự án đang chạy, gom theo bước.
        </p>
      </div>
      <BangViecQuyTrinh
        duAn={duAn}
        userId={session.userId}
        role={session.role}
        laAdmin={session.role === "ADMIN"}
        nowMs={serverNow()}
      />
    </div>
  );
}
