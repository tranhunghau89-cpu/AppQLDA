import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { chonDonGia, type DongGiaUngVien, ngayTraGia } from "@/lib/thuVien/gia";
import { goiYKgMotBo, laDonViDem } from "@/lib/thuVien/trongLuongBulong";
import { BangQuyDoiKg, type DongQuyDoi } from "./BangQuyDoiKg";

/**
 * Bảng quy đổi bộ → kg cho bulong, ty xà gồ, ecu, long đen.
 *
 * Số ở đây là `CongTac.khoiLuongDonVi` — cùng cột mà bảng cấu thành của bộ hạng mục đã
 * dùng, nên khai một lần là chào giá, dự toán thi công và món đơn hàng cùng thấy.
 */
export default async function QuyDoiKgPage() {
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");
  const ngay = ngayTraGia();

  const tuKhoa = ["bulong", "bu lông", "bulông", "bu long", "ty ", "ty xà gồ", "thanh ren", "ecu", "êcu", "long đen", "đai ốc"];
  const congTacs = await db.congTac.findMany({
    where: {
      active: true,
      OR: [
        { nhomChiPhi: { in: ["BL_NEO", "BLLK"] } },
        ...tuKhoa.map((k) => ({ ten: { contains: k, mode: "insensitive" as const } })),
      ],
    },
    orderBy: [{ nhomMa: "asc" }, { sortOrder: "asc" }, { ma: "asc" }],
    select: { id: true, ma: true, ten: true, quyCach: true, donVi: true, khoiLuongDonVi: true },
  });
  // Chỉ những mã tính theo bộ/cái mới cần quy đổi; mã đã tính kg thì bỏ.
  const canQuyDoi = congTacs.filter((c) => laDonViDem(c.donVi));

  const banGias = await db.donGiaCongTac.findMany({
    where: { congTacId: { in: canQuyDoi.map((c) => c.id) }, hieuLucTu: { lte: ngay } },
    select: {
      id: true,
      congTacId: true,
      congTacVatTuId: true,
      khuVucId: true,
      donGia: true,
      hieuLucTu: true,
      createdAt: true,
    },
  });
  const theoCongTac = new Map<string, DongGiaUngVien[]>();
  for (const g of banGias) theoCongTac.set(g.congTacId, [...(theoCongTac.get(g.congTacId) ?? []), g]);

  const dong: DongQuyDoi[] = canQuyDoi.map((c) => {
    const goiY = goiYKgMotBo(c.ten, c.quyCach);
    return {
      id: c.id,
      ma: c.ma,
      ten: c.ten,
      quyCach: c.quyCach,
      donVi: c.donVi,
      donGia: chonDonGia(theoCongTac.get(c.id) ?? [], { congTacId: c.id, ngay }).donGia,
      kg: c.khoiLuongDonVi,
      goiY: goiY ? { kg: goiY.kg, cauTao: goiY.cauTao } : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/thu-vien" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quy đổi bộ → kg</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Trọng lượng một bộ/cái của bulong, ty xà gồ, ecu, long đen. Dự toán thi công dùng
            bảng này để quy mục con và món đơn hàng tính theo bộ ra kg của đầu việc. Ô trống
            đang hiện số <b>ước tính</b> theo quy cách (thép 7,85 t/m³, đầu và ecu lục giác
            ISO 4014/4032, long đen ISO 7089) — có số của nhà cung cấp thì gõ đè.
          </p>
        </div>
      </div>
      <BangQuyDoiKg dong={dong} canEdit={canEdit} />
    </div>
  );
}
