import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { scopedProjectWhere } from "@/lib/scope";
import { TabTrang, TAB_HOP_DONG } from "@/components/layout/TabTrang";
import type { DuAnNhap } from "@/lib/soSanhDuAn";
import { BangSoSanh } from "./BangSoSanh";

/**
 * So sánh dự toán giữa các dự án: KL/m², đ/m², tỷ trọng của từng hạng mục, đầu việc và
 * nhóm chi phí; trung vị các dự án đã chọn là chỉ số chuẩn cho dự án mới.
 *
 * Lọc và chọn dự án làm ở client, vì đổi bộ lọc là việc làm liên tục khi dò số và dữ
 * liệu (vài nghìn dòng dự toán) đủ nhỏ để gửi một lần.
 */
export default async function SoSanhDuAnPage() {
  const session = await requireView("estimate");
  const canEdit = can(session.role as Role, "estimate", "edit");
  const scope = await scopedProjectWhere(session);

  const projects = await db.project.findMany({
    where: { ...scope, estimateItems: { some: {} } },
    orderBy: { code: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      area: true,
      buildingType: true,
      status: true,
      estimateItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          groupCode: true,
          name: true,
          unit: true,
          congTacId: true,
          designQty: true,
          actualQty: true,
          unitPrice: true,
          amount: true,
          actualUnitPrice: true,
          actualAmount: true,
          section: { select: { name: true, templateId: true } },
        },
      },
    },
  });

  const [gop, duAnDich] = await Promise.all([
    db.gopDauViec.findMany({ orderBy: { createdAt: "desc" } }),
    canEdit
      ? db.project.findMany({
          where: scope,
          orderBy: { code: "desc" },
          select: { id: true, code: true, name: true, area: true, _count: { select: { estimateItems: true } } },
        })
      : Promise.resolve([]),
  ]);

  const duAn: (DuAnNhap & { buildingType: string | null; status: string })[] = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    area: p.area,
    buildingType: p.buildingType,
    status: p.status,
    items: p.estimateItems.map(({ section, ...d }) => ({
      ...d,
      sectionName: section?.name ?? null,
      sectionTemplateId: section?.templateId ?? null,
    })),
  }));

  return (
    <div className="space-y-6">
      <TabTrang tabs={TAB_HOP_DONG} hienTai="/estimates/so-sanh" role={session.role} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">So sánh dự án & chỉ số chuẩn</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Khối lượng và chi phí trên mỗi m² sàn, tỷ trọng % của từng hạng mục, đầu việc giữa các
          dự án. Cột <b>Trung vị</b> là chỉ số chuẩn để so hoặc tạm tính dự án mới; ô tô màu lệch
          quá ngưỡng so với trung vị. Đầu việc ghép theo công tác thư viện, không có thì theo
          tên + đơn vị.
        </p>
      </div>
      <BangSoSanh
        duAn={duAn}
        canEdit={canEdit}
        gop={gop.map((g) => ({ khoaNguon: g.khoaNguon, khoaDich: g.khoaDich, tenNguon: g.tenNguon, tenDich: g.tenDich }))}
        duAnDich={duAnDich.map((p) => ({ id: p.id, code: p.code, name: p.name, area: p.area, soDong: p._count.estimateItems }))}
      />
    </div>
  );
}
