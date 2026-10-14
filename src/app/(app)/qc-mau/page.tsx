import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { QcMauEditor } from "./QcMauEditor";

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
      loai: true,
      tieuChi: true,
      active: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Mẫu QC</h1>
        <p className="text-sm text-slate-500">
          Danh mục kiểm tra mặc định theo giai đoạn. Dự án chép mẫu lúc tạo danh
          mục QC — sửa mẫu ở đây không đổi dự án đã tạo.
        </p>
      </div>
      <QcMauEditor mau={mau} />
    </div>
  );
}
