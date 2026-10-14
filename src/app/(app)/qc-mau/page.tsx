import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { QcMauEditor } from "./QcMauEditor";
import { TabTrang, TAB_QUAN_TRI } from "@/components/layout/TabTrang";

export default async function QcMauPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") notFound();
  const mau = await db.qcMau.findMany({
    orderBy: [{ giaiDoan: "asc" }, { thuTu: "asc" }],
    select: {
      id: true,
      giaiDoan: true,
      noiDung: true,
      boPhan: true,
      nhom: true,
      loai: true,
      tieuChi: true,
      active: true,
    },
  });

  return (
    <div className="space-y-6">
      <TabTrang tabs={TAB_QUAN_TRI} hienTai="/qc-mau" role={session.role} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Mẫu QC</h1>
        <p className="text-sm text-slate-500">
          Việc cần làm, hồ sơ cần có và mục kiểm tra mặc định theo giai đoạn. Dự án chép mẫu lúc tạo danh
          mục QC — sửa mẫu ở đây không đổi dự án đã tạo.
        </p>
      </div>
      <QcMauEditor mau={mau} />
    </div>
  );
}
