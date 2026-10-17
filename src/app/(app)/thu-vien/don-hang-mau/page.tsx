import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { TabTrang, TAB_DANH_MUC } from "@/components/layout/TabTrang";
import { BangMauDonHang, type MauChiTiet } from "./BangMauDonHang";

/**
 * Thư viện đơn hàng mẫu — dùng chung toàn công ty. Lưu mẫu từ trang Đơn hàng của một dự
 * án ("Lưu làm mẫu"), dùng mẫu ở đó ("Tạo từ mẫu"). Trang này để xem, đổi tên, xoá.
 */
export default async function DonHangMauPage() {
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");
  const ds = await db.purchaseOrderTemplate.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  const mau: MauChiTiet[] = ds.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    createdAt: m.createdAt.toISOString(),
    items: m.items.map((i) => ({
      id: i.id,
      category: i.category,
      groupName: i.groupName,
      name: i.name,
      unit: i.unit,
      qty: i.qty,
      length: i.length,
      weight: i.weight,
    })),
  }));

  return (
    <div className="space-y-6">
      <TabTrang tabs={TAB_DANH_MUC} hienTai="/thu-vien/don-hang-mau" role={session.role} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Đơn hàng mẫu</h1>
        <p className="text-sm text-slate-500">
          Khung đơn đặt hàng dùng lại cho dự án mới — {mau.length} mẫu. Lưu mẫu bằng nút{" "}
          <b>Lưu làm mẫu</b> trên một đơn hàng của dự án; dùng mẫu bằng nút <b>Tạo từ mẫu</b> ở
          trang Đơn hàng. Mẫu không mang đơn giá.
        </p>
      </div>
      <BangMauDonHang mau={mau} canEdit={canEdit} />
    </div>
  );
}
