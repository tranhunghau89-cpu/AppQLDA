import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { KhuVucManager, type KhuVucView, type NhaCungCapView } from "./KhuVucManager";

export default async function KhuVucPage() {
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");

  const [khuVucs, suppliers] = await Promise.all([
    db.khuVuc.findMany({
      orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
      include: {
        _count: { select: { nhaCungCap: true, donGia: true, duAn: true } },
      },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        khuVucLinks: { select: { khuVucId: true } },
      },
    }),
  ]);

  const dsKhuVuc: KhuVucView[] = khuVucs.map((k) => ({
    id: k.id,
    ma: k.ma,
    ten: k.ten,
    ghiChu: k.ghiChu,
    soNhaCungCap: k._count.nhaCungCap,
    soBanGia: k._count.donGia,
    soDuAn: k._count.duAn,
  }));

  const dsNCC: NhaCungCapView[] = suppliers.map((s) => ({
    id: s.id,
    ten: s.name,
    nhom: s.category,
    khuVucIds: s.khuVucLinks.map((l) => l.khuVucId),
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
          Khu vực &amp; nhà cung cấp
        </h1>
        <p className="text-sm text-slate-500">
          Vị trí công trình tác động tới giá qua nhà cung cấp: làm ở Hà Nội mua của
          nhóm này, ở Tây Ninh mua của nhóm kia. Khai khu vực ở đây rồi đánh dấu mỗi
          nhà cung cấp phục vụ những vùng nào.
        </p>
      </div>

      <KhuVucManager khuVucs={dsKhuVuc} nhaCungCaps={dsNCC} canEdit={canEdit} />
    </div>
  );
}
