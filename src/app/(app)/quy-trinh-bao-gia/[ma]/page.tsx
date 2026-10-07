import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { db } from "@/lib/db";
import { whereKhachHangTrongPhamVi } from "@/lib/crmScope";
import { CO_HOI_DANG_MO } from "@/lib/constants";
import { timQuyTrinh } from "@/lib/quyTrinhBaoGia";
import { ThanhBuoc } from "../ThanhBuoc";
import { BuocKhachHang } from "./BuocKhachHang";

/** Bước 1 khi chưa có công trình: chọn/thêm khách và khai công trình. */
export default async function BatDauQuyTrinhPage({
  params,
}: {
  params: Promise<{ ma: string }>;
}) {
  const { ma } = await params;
  const qt = timQuyTrinh(ma);
  if (!qt) notFound();

  const session = await requireView("customer");
  const canEdit = can(session.role as Role, "customer", "edit");

  const khach = await db.khachHang.findMany({
    where: whereKhachHangTrongPhamVi(session),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      tenCty: true,
      coHoi: {
        where: { trangThai: { in: CO_HOI_DANG_MO } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, tenCongTrinh: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/quy-trinh-bao-gia"
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{qt.ten}</h1>
      </div>
      <ThanhBuoc qt={qt} hienTai={1} toiDa={1} hrefBuoc={null} />
      <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {qt.buoc[0].huongDan}
      </p>
      {canEdit ? (
        <BuocKhachHang ma={qt.ma} khach={khach} />
      ) : (
        <p className="text-sm text-red-600">Bạn không có quyền thêm khách hàng / công trình.</p>
      )}
    </div>
  );
}
