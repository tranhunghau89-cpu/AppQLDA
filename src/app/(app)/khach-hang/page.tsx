import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { db } from "@/lib/db";
import { whereKhachHangTrongPhamVi } from "@/lib/crmScope";
import { KhachHangManager, type KhachHangRow } from "./KhachHangManager";
import type { NoteView } from "@/components/crm/InteractionLog";

export default async function KhachHangPage() {
  const session = await requireView("customer");
  const canEdit = can(session.role as Role, "customer", "edit");
  const laAdmin = session.role === "ADMIN";

  // Phạm vi đi theo NGƯỜI PHỤ TRÁCH, không qua dự án — khách chào giá chưa có dự án nào.
  const pham = whereKhachHangTrongPhamVi(session);

  const [rows, nhanVien] = await Promise.all([
    db.khachHang.findMany({
      where: pham,
      orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        coHoi: {
          orderBy: { createdAt: "desc" },
          include: {
            project: { select: { code: true } },
            _count: { select: { quotes: true, clientQuotes: true } },
          },
        },
        traoDoi: { orderBy: { contactDate: "desc" }, take: 30 },
      },
    }),
    // Chỉ quản trị viên mới gán được cho người khác, nên chỉ họ cần danh sách này.
    laAdmin
      ? db.user.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  const khach: KhachHangRow[] = rows.map((k) => ({
    id: k.id,
    tenCty: k.tenCty,
    nguoiLienHe: k.nguoiLienHe,
    phone: k.phone,
    email: k.email,
    diaChi: k.diaChi,
    nguon: k.nguon,
    ownerId: k.ownerId,
    ownerName: k.ownerName,
    note: k.note,
    customerId: k.customerId,
    customerName: k.customer?.name ?? null,
    coHoi: k.coHoi.map((c) => ({
      id: c.id,
      tenCongTrinh: c.tenCongTrinh,
      diaDiem: c.diaDiem,
      buildingType: c.buildingType,
      area: c.area,
      kK: c.kK,
      kL: c.kL,
      kH: c.kH,
      trangThai: c.trangThai,
      lyDoMat: c.lyDoMat,
      note: c.note,
      projectId: c.projectId,
      projectCode: c.project?.code ?? null,
      soDuToan: c._count.quotes,
      soBaoGia: c._count.clientQuotes,
    })),
    henGanNhat:
      k.traoDoi
        .filter((n) => n.nextFollowUpDate)
        .map((n) => n.nextFollowUpDate!.toISOString())
        .sort()[0] ?? null,
    notes: k.traoDoi.map(
      (n): NoteView => ({
        id: n.id,
        kind: n.kind,
        contactDate: n.contactDate.toISOString(),
        content: n.content,
        authorName: n.authorName,
        nextFollowUpDate: n.nextFollowUpDate?.toISOString() ?? null,
      })
    ),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Khách hàng</h1>
        <p className="text-sm text-slate-500">
          Khách đang trao đổi và chào giá — chưa ký hợp đồng. Ký rồi mới chuyển sang chủ
          đầu tư bên quản lý dự án.
        </p>
      </div>
      <KhachHangManager
        khach={khach}
        nhanVien={nhanVien}
        canEdit={canEdit}
        laAdmin={laAdmin}
      />
    </div>
  );
}
