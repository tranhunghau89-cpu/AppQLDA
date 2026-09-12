import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { nhaCungCapTheoKhuVuc } from "@/lib/thuVien/nhaCungCap";
import { EstimateEditor, type EstimateRow, type SectionInfo } from "./EstimateEditor";
import type { TemplateForClient } from "./ApplyTemplate";
import { DoXuongTuBaoGia, type BaoGiaChonDuoc } from "./DoXuongTuBaoGia";

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireProjectView("estimate", id);
  const canEdit = can(session.role, "estimate", "edit");

  // 5 truy vấn độc lập -> chạy song song (guard phân quyền đã xong ở trên).
  const [project, suppliers, templateRows, quoteRows, lienKetKhuVuc] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        khuVuc: { select: { ten: true } },
        estimateItems: {
          include: {
            supplier: { select: { name: true } },
            // Chỉ ĐẾM dòng bảng bóc, không nạp nội dung: một đầu mục có thể có hàng trăm
            // dòng chi tiết, mà trang này chỉ cần biết "có hay không" để khoá ô.
            _count: { select: { chiTiet: true } },
          },
          orderBy: [{ sortOrder: "asc" }],
        },
        estimateSections: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Mỗi PHẦN của bộ hạng mục là một "mẫu" áp được vào dự toán thi công. Engine
    // INPUT/DERIVED không đổi, chỉ đổi nguồn đọc.
    db.boHangMucPhan.findMany({
      where: { boHangMuc: { active: true } },
      orderBy: [{ boHangMuc: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { dong: { orderBy: { sortOrder: "asc" } } },
    }),
    // Bản dự toán chào giá của dự án — nguồn để đổ xuống.
    db.quote.findMany({
      where: { projectId: id },
      orderBy: [{ quoteDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, quoteDate: true },
    }),
    db.nhaCungCapKhuVuc.findMany({
      select: { supplierId: true, khuVucId: true, uuTien: true },
    }),
  ]);
  if (!project) notFound();

  const templates: TemplateForClient[] = templateRows.map((t) => ({
    id: t.id,
    name: t.ten,
    code: t.ma,
    lines: t.dong.map((l) => ({
      id: l.id,
      groupLabel: l.groupLabel ?? "",
      name: l.ten,
      unit: l.donVi,
      defaultUnitPrice: l.donGiaMacDinh,
      role: l.vaiTro,
      feedsParam: l.napThamSo,
      takesFromParam: l.layTuThamSo,
      factor: l.heSoQuyDoi,
      defaultQty: l.khoiLuongMacDinh,
      groupCode: l.nhomChiPhi,
      note: l.ghiChu,
      sortOrder: l.sortOrder,
    })),
  }));

  const baoGia: BaoGiaChonDuoc[] = quoteRows.map((q) => ({
    id: q.id,
    title: q.title,
    ngay: q.quoteDate ? q.quoteDate.toLocaleDateString("vi-VN") : null,
  }));

  // Nhà cung cấp phục vụ khu vực của dự án được đưa lên nhóm đầu. KHÔNG lọc bỏ những
  // nhà cung cấp còn lại: khu vực mới khai nên hầu hết chưa được gán vùng nào, mà một
  // ô chọn rỗng thì chặn đứng việc nhập liệu.
  const trongKhuVuc = project.khuVucId
    ? nhaCungCapTheoKhuVuc(lienKetKhuVuc, project.khuVucId)
    : [];

  const sections: SectionInfo[] = project.estimateSections.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    sortOrder: s.sortOrder,
  }));

  const rows: EstimateRow[] = project.estimateItems.map((it) => ({
    id: it.id,
    sectionId: it.sectionId,
    groupLabel: it.groupLabel,
    groupCode: it.groupCode,
    name: it.name,
    unit: it.unit,
    designQty: it.designQty,
    actualQty: it.actualQty,
    unitPrice: it.unitPrice,
    amount: it.amount,
    supplierId: it.supplierId,
    supplierName: it.supplier?.name ?? null,
    orderStatus: it.orderStatus,
    dispatchStatus: it.dispatchStatus,
    note: it.note,
    sortOrder: it.sortOrder,
    soChiTiet: it._count.chiTiet,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dự toán — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">Chi phí, đơn giá, nhà cung cấp và lợi nhuận</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canEdit && <DoXuongTuBaoGia projectId={project.id} baoGia={baoGia} />}
          <a
            href={`/api/export/estimate/${project.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Xuất Excel
          </a>
        </div>
      </div>

      <EstimateEditor
        projectId={project.id}
        items={rows}
        sections={sections}
        templates={templates}
        suppliers={suppliers}
        trongKhuVuc={trongKhuVuc}
        khuVucTen={project.khuVuc?.ten ?? null}
        salePrice={project.salePrice}
        area={project.area}
        canEdit={canEdit}
      />
    </div>
  );
}
