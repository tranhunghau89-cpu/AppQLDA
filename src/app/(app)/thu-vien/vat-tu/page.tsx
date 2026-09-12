import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { chonGiaMua } from "@/lib/thuVien/nhaCungCap";
import { VatTuGrid, type ChonLua, type VatTuView } from "./VatTuGrid";

export default async function VatTuPage() {
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");
  const ngay = new Date();

  const [vatTus, suppliers, khuVucs] = await Promise.all([
    db.vatTu.findMany({
      orderBy: [{ nhomTSKT: "asc" }, { sortOrder: "asc" }, { ma: "asc" }],
      include: {
        giaMua: {
          orderBy: { hieuLucTu: "desc" },
          include: { supplier: { select: { name: true } }, khuVuc: { select: { ma: true } } },
        },
        _count: { select: { congTacLinks: true } },
      },
    }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.khuVuc.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
      select: { id: true, ma: true, ten: true },
    }),
  ]);

  const items: VatTuView[] = vatTus.map((v) => {
    const tot = chonGiaMua(v.giaMua, { vatTuId: v.id, ngay });
    return {
      id: v.id,
      ma: v.ma,
      ten: v.ten,
      quyCach: v.quyCach,
      hang: v.hang,
      xuatXu: v.xuatXu,
      donVi: v.donVi,
      nhomTSKT: v.nhomTSKT,
      tag: v.tag,
      inTrongMoTa: v.inTrongMoTa,
      nhomChiPhi: v.nhomChiPhi,
      ghiChu: v.ghiChu,
      soBienThe: v._count.congTacLinks,
      giaTotNhat: tot
        ? { donGia: tot.donGia, nhaCungCap: tot.supplierId }
        : null,
      giaMua: v.giaMua.map((g) => ({
        id: g.id,
        supplierId: g.supplierId,
        nhaCungCap: g.supplier.name,
        khuVuc: g.khuVuc?.ma ?? null,
        donGia: g.donGia,
        donVi: g.donVi,
        hieuLucTu: g.hieuLucTu.toISOString(),
        ghiChu: g.ghiChu,
        laGiaTotNhat: tot?.id === g.id,
      })),
    };
  });

  const chonLua: ChonLua = {
    nhaCungCaps: suppliers.map((s) => ({ id: s.id, ten: s.name })),
    khuVucs: khuVucs.map((k) => ({ id: k.id, ma: k.ma, ten: k.ten })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/thu-vien"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Thư viện đơn giá
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Vật tư</h1>
        <p className="text-sm text-slate-500">
          {items.length} vật tư. Một bản ghi phục vụ ba việc: in ra bảng &quot;Vật liệu
          áp dụng &amp; TSKT&quot; kèm báo giá, phân biệt các biến thể của một công tác,
          và mang giá mua theo nhà cung cấp.
        </p>
      </div>

      <VatTuGrid items={items} chonLua={chonLua} canEdit={canEdit} />
    </div>
  );
}
