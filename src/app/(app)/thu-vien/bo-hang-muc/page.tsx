import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { BoHangMucList, type BoView, type CongTacView } from "./BoHangMucList";

export default async function BoHangMucPage() {
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");

  const bos = await db.boHangMuc.findMany({
    orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
    include: {
      phan: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { dong: true } },
          dong: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              ten: true,
              donVi: true,
              maCongTac: true,
              congTacId: true,
              donGiaMacDinh: true,
              nhomChiPhi: true,
              cauThanh: { orderBy: { sortOrder: "asc" }, select: { congTacId: true, soLuong: true } },
              suatKhoiLuong: true,
              khoiLuongMacDinh: true,
            },
          },
        },
      },
      _count: { select: { dong: true, vatLieu: true, giaiDoan: true, thanhToan: true } },
    },
  });

  const items: BoView[] = bos.map((b) => ({
    id: b.id,
    ma: b.ma,
    ten: b.ten,
    loaiCongTrinh: b.loaiCongTrinh,
    moTa: b.moTa,
    active: b.active,
    soDong: b._count.dong,
    soVatLieu: b._count.vatLieu,
    soGiaiDoan: b._count.giaiDoan,
    soThanhToan: b._count.thanhToan,
    phan: b.phan.map((p) => ({
      id: p.id,
      ma: p.ma,
      ten: p.ten,
      loai: p.loai,
      soDong: p._count.dong,
      inChoKhach: p.inChoKhach,
      maKhach: p.maKhach,
      tenKhachHang: p.tenKhachHang,
      partCode: p.partCode,
      partName: p.partName,
      dong: p.dong.map((d) => ({
        id: d.id,
        ten: d.ten,
        donVi: d.donVi,
        maCongTac: d.maCongTac,
        congTacId: d.congTacId,
        donGiaMacDinh: d.donGiaMacDinh,
        nhomChiPhi: d.nhomChiPhi,
        cauThanh: d.cauThanh,
        suatKhoiLuong: d.suatKhoiLuong,
        khoiLuongMacDinh: d.khoiLuongMacDinh,
      })),
    })),
  }));

  // Thư viện công tác để chọn mã cho từng dòng. Giá lấy bản ĐANG hiệu lực (mới nhất
  // trong số các bản đã tới ngày) — đó là con số dự toán sẽ dùng, nên cũng là con số
  // phải bày ra lúc chọn.
  const congTacs = await db.congTac.findMany({
    where: { active: true },
    orderBy: { ma: "asc" },
    select: {
      id: true,
      ma: true,
      ten: true,
      donVi: true,
      nhomChiPhi: true,
      khoiLuongDonVi: true,
      donGia: {
        where: { hieuLucTu: { lte: new Date() }, khuVucId: null, congTacVatTuId: null },
        orderBy: { hieuLucTu: "desc" },
        take: 1,
        select: { donGia: true },
      },
    },
  });
  const congTac: CongTacView[] = congTacs.map((c) => ({
    id: c.id,
    ma: c.ma,
    ten: c.ten,
    donVi: c.donVi,
    nhomChiPhi: c.nhomChiPhi,
    khoiLuongDonVi: c.khoiLuongDonVi,
    donGia: c.donGia[0]?.donGia ?? null,
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
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Bộ hạng mục chuẩn</h1>
        <p className="text-sm text-slate-500">
          Khung hạng mục theo loại công trình. Mỗi <strong>phần</strong> mang hai mặt:
          các dòng công tác để tính giá vốn, và một dòng hạng mục in cho chủ đầu tư.
          Chọn một bộ khi lập dự toán là có sẵn cả khung, chỉ còn điền khối lượng.
        </p>
      </div>

      <BoHangMucList items={items} congTac={congTac} canEdit={canEdit} />
    </div>
  );
}
