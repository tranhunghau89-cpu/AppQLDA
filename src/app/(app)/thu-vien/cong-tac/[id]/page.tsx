import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { ESTIMATE_GROUP_MAP, WORK_GROUP_MAP, labelOf } from "@/lib/constants";
import { chonDonGia } from "@/lib/thuVien/gia";
import { DonGiaTimeline, type BanGiaView } from "./DonGiaTimeline";
import { BienTheEditor, type BienTheView } from "./BienTheEditor";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");

  const [congTac, moiVatTu, khuVucs] = await Promise.all([
    db.congTac.findUnique({
      where: { id },
      include: {
        donGia: {
          orderBy: { hieuLucTu: "desc" },
          include: {
            khuVuc: { select: { ma: true } },
            bienThe: { select: { id: true, tenBienThe: true, vatTu: { select: { ten: true } } } },
          },
        },
        bienThe: {
          orderBy: { sortOrder: "asc" },
          include: {
            vatTu: { select: { ma: true, ten: true, hang: true, quyCach: true } },
            _count: { select: { donGia: true } },
          },
        },
      },
    }),
    db.vatTu.findMany({
      where: { active: true },
      orderBy: [{ nhomTSKT: "asc" }, { ma: "asc" }],
      select: { id: true, ma: true, ten: true },
    }),
    db.khuVuc.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
      select: { id: true, ma: true, ten: true },
    }),
  ]);
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
    khuVuc: g.khuVuc?.ma ?? null,
    bienThe: g.bienThe
      ? (g.bienThe.tenBienThe ?? g.bienThe.vatTu.ten)
      : null,
    dangApDung: g.id === hienHanh.donGiaId,
    chuaHieuLuc: g.hieuLucTu.getTime() > ngay.getTime(),
  }));

  const bienThes: BienTheView[] = congTac.bienThe.map((bt) => {
    const kq = chonDonGia(congTac.donGia, {
      congTacId: congTac.id,
      congTacVatTuId: bt.id,
      ngay,
    });
    return {
      id: bt.id,
      vatTuMa: bt.vatTu.ma,
      vatTuTen: bt.vatTu.ten,
      hang: bt.vatTu.hang,
      quyCach: bt.vatTu.quyCach,
      tenBienThe: bt.tenBienThe,
      laMacDinh: bt.laMacDinh,
      soBanGia: bt._count.donGia,
      // Chỉ hiện số khi đó thật sự là giá RIÊNG của biến thể. Rơi về giá chung mà
      // vẫn in con số ra cột "đơn giá riêng" là nói dối người dùng rằng họ đã khai.
      donGiaRieng: kq.doKhop.startsWith("BIEN_THE") ? kq.donGia : null,
    };
  });

  const daGan = new Set(congTac.bienThe.map((bt) => bt.vatTuId));
  const vatTuChuaGan = moiVatTu.filter((v) => !daGan.has(v.id));

  return (
    <div className="space-y-8">
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
        bienTheChon={congTac.bienThe.map((bt) => ({
          id: bt.id,
          ten: bt.tenBienThe ?? bt.vatTu.ten,
        }))}
        khuVucChon={khuVucs}
        canEdit={canEdit}
      />

      <BienTheEditor
        congTacId={congTac.id}
        bienThes={bienThes}
        vatTuChuaGan={vatTuChuaGan}
        canEdit={canEdit}
      />
    </div>
  );
}
