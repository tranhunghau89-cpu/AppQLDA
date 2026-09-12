import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import { db } from "@/lib/db";
import { requireCoHoiView } from "@/lib/coHoiAccess";
import { can, type Role } from "@/lib/rbac";
import { templateChoices } from "@/lib/quoteTemplatePick";
import { CO_HOI_TRANG_THAI_MAP } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { formatQty } from "@/lib/utils";
import { QuoteEditor } from "../../../projects/[id]/quote/QuoteEditor";
import { napDuLieuBaoGia } from "../../../projects/[id]/quote/napDuLieu";

/**
 * Dự toán chào giá của một công trình đang chào giá — chưa có dự án nào.
 *
 * Cùng màn hình với dự toán ở dự án, chỉ khác chủ sở hữu. Đây là chỗ nhân viên kinh
 * doanh dựng giá thành trước khi suy ra đơn giá m² cho bản gửi khách.
 */
export default async function CoHoiQuotePage({
  params,
}: {
  params: Promise<{ coHoiId: string }>;
}) {
  const { coHoiId } = await params;
  const session = await requireCoHoiView("quote", coHoiId);
  const canEdit = can(session.role as Role, "quote", "edit");

  const [coHoi, duLieu] = await Promise.all([
    db.coHoi.findUnique({
      where: { id: coHoiId },
      select: {
        id: true,
        tenCongTrinh: true,
        diaDiem: true,
        area: true,
        buildingType: true,
        trangThai: true,
        khachHang: { select: { id: true, tenCty: true } },
      },
    }),
    napDuLieuBaoGia(session, { loai: "CO_HOI", id: coHoiId }),
  ]);
  if (!coHoi) notFound();

  const mau = await templateChoices(coHoi.buildingType);
  const tt = CO_HOI_TRANG_THAI_MAP[coHoi.trangThai];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/khach-hang"
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              Dự toán — {coHoi.tenCongTrinh}
            </h1>
            <Badge tone={tt?.tone ?? "slate"}>{tt?.label ?? coHoi.trangThai}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {coHoi.khachHang.tenCty}
            {coHoi.diaDiem ? ` · ${coHoi.diaDiem}` : ""}
            {coHoi.area != null ? ` · ${formatQty(coHoi.area)} m²` : ""}
          </p>
        </div>
        <Link
          href="/thu-vien"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          <Tags className="h-4 w-4" /> Bảng đơn giá
        </Link>
      </div>

      <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Công trình này chưa có hợp đồng nên chưa có dự án. Dựng giá thành ở đây trước;
        ký xong thì cả bản dự toán theo sang dự án.
      </p>

      <QuoteEditor
        chu={{ loai: "CO_HOI", id: coHoi.id }}
        quotes={duLieu.quotes}
        catalog={duLieu.catalog}
        cloneSources={duLieu.cloneSources}
        canEdit={canEdit}
        projectArea={coHoi.area}
        templates={mau.options}
        templateGoiY={mau.goiY}
        khuVucs={duLieu.khuVucs}
        // Cơ hội chưa có dự án nên không có khu vực mặc định — người lập tự chọn.
        khuVucMacDinh={null}
      />
    </div>
  );
}
