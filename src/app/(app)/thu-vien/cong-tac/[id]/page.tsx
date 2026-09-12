import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { ESTIMATE_GROUP_MAP, WORK_GROUP_MAP, labelOf } from "@/lib/constants";
import { chonDonGia } from "@/lib/thuVien/gia";
import { DonGiaTimeline, type BanGiaView } from "./DonGiaTimeline";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");

  const congTac = await db.congTac.findUnique({
    where: { id },
    include: { donGia: { orderBy: { hieuLucTu: "desc" } } },
  });
  if (!congTac) notFound();

  const ngay = new Date();
  const hienHanh = chonDonGia(congTac.donGia, { congTacId: congTac.id, ngay });

  const banGias: BanGiaView[] = congTac.donGia.map((g) => ({
    id: g.id,
    vatTu: g.vatTu,
    nhanCongMay: g.nhanCongMay,
    heSo: g.heSo,
    donGia: g.donGia,
    hieuLucTu: g.hieuLucTu.toISOString(),
    nguon: g.nguon,
    ghiChu: g.ghiChu,
    createdByName: g.createdByName,
    dangApDung: g.id === hienHanh.donGiaId,
    chuaHieuLuc: g.hieuLucTu.getTime() > ngay.getTime(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/thu-vien"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Thư viện đơn giá
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          <span className="font-mono text-slate-400">{congTac.ma}</span> — {congTac.ten}
        </h1>
        <p className="text-sm text-slate-500">
          {labelOf(WORK_GROUP_MAP, congTac.nhomMa)} · Nhóm chi phí:{" "}
          {labelOf(ESTIMATE_GROUP_MAP, congTac.nhomChiPhi)}
          {congTac.donVi ? ` · Đơn vị: ${congTac.donVi}` : ""}
          {congTac.quyCach ? ` · ${congTac.quyCach}` : ""}
        </p>
      </div>

      <DonGiaTimeline
        congTacId={congTac.id}
        heSoMacDinh={congTac.heSo}
        banGias={banGias}
        canEdit={canEdit}
      />
    </div>
  );
}
