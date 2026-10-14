import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { scopedProjectWhere } from "@/lib/scope";
import { serverNow } from "@/lib/now";
import { soSanhCo, tinhChiSo, tinhCo } from "@/lib/projectHealth";
import { BangTongQuan, type TongQuanRow } from "./BangTongQuan";
import { napQuyTrinhNhieu, quyTrinhChoCo } from "@/lib/quyTrinhDb";
import { buocHienTai } from "@/lib/quyTrinh";
import { TabTrang, TAB_DU_AN } from "@/components/layout/TabTrang";

export default async function TongQuanDuAnPage() {
  const session = await requireView("project");
  // Cùng điều kiện với khối "Thanh toán theo đợt" ở trang chi tiết dự án.
  const hienTien =
    can(session.role, "debt", "view") || can(session.role, "cost", "edit");
  const scope = await scopedProjectWhere(session);
  const nowMs = serverNow();

  const projects = await db.project.findMany({
    where: { AND: [scope, { status: { not: "HOAN_THANH" } }] },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      salePrice: true,
      customer: { select: { name: true } },
      milestones: { select: { type: true, planDate: true, done: true } },
      payments: {
        where: { direction: "THU" },
        select: {
          direction: true,
          name: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
        },
      },
      purchaseOrders: {
        select: { category: true, status: true, expectedDate: true },
      },
      qcMuc: { select: { giaiDoan: true, ketQua: true } },
      contracts: {
        select: { valueWithVat: true, status: true, signDate: true },
      },
    },
  });

  const quyTrinh = await napQuyTrinhNhieu(projects.map((p) => p.id));
  const rows: TongQuanRow[] = projects
    .map((p) => {
      const qt = quyTrinh.get(p.id) ?? [];
      const dangO = qt.find((b) => b.buoc === buocHienTai(qt));
      const co = tinhCo(
        { ...p, qc: p.qcMuc, quyTrinh: quyTrinhChoCo(qt) },
        nowMs,
        { anTien: !hienTien },
      );
      const cs = tinhChiSo(p);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        customerName: p.customer?.name ?? null,
        status: p.status,
        muc: co.muc,
        lyDo: co.lyDo.map((l) => l.text),
        tienDo: cs.tienDo,
        daThu: hienTien ? cs.daThu : null,
        giaTriHD: hienTien ? cs.giaTriHD : null,
        conPhaiThu: hienTien ? cs.conPhaiThu : null,
        buoc: dangO ? { ten: dangO.ten, trangThai: dangO.trangThai } : null,
      };
    })
    .sort((a, b) => soSanhCo(a.muc, b.muc) || a.code.localeCompare(b.code));

  return (
    <div className="space-y-6">
      <TabTrang tabs={TAB_DU_AN} hienTai="/projects/tong-quan" role={session.role} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Tổng quan dự án
        </h1>
        <p className="text-sm text-slate-500">
          Dự án đang chạy — cờ đỏ: quá hạn, cờ vàng: đến hạn trong 7 ngày
        </p>
      </div>
      <BangTongQuan rows={rows} hienTien={hienTien} />
    </div>
  );
}
