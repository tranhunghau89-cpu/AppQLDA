import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { scopedProjectWhere } from "@/lib/scope";
import { serverNow } from "@/lib/now";
import { soSanhCo, tinhChiSo, tinhCo } from "@/lib/projectHealth";
import { BangTongQuan, type TongQuanRow } from "./BangTongQuan";

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
      contracts: {
        select: { valueWithVat: true, status: true, signDate: true },
      },
    },
  });

  const rows: TongQuanRow[] = projects
    .map((p) => {
      const co = tinhCo(p, nowMs, { anTien: !hienTien });
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
        daThu: cs.daThu,
        giaTriHD: hienTien ? cs.giaTriHD : null,
        conPhaiThu: hienTien ? cs.conPhaiThu : 0,
      };
    })
    .sort((a, b) => soSanhCo(a.muc, b.muc) || a.code.localeCompare(b.code));

  return (
    <div className="space-y-6">
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
