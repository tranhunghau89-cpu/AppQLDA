import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireCoHoiView } from "@/lib/coHoiAccess";
import { can, type Role } from "@/lib/rbac";
import { templateChoices } from "@/lib/quoteTemplatePick";
import { CO_HOI_TRANG_THAI_MAP } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { formatQty } from "@/lib/utils";
import { ClientQuoteEditor } from "../../../projects/[id]/client-quote/ClientQuoteEditor";
import { napDuLieuBaoGiaKhach } from "../../../projects/[id]/client-quote/napDuLieu";

/**
 * Báo giá gửi khách của một công trình đang chào — chưa có dự án, chưa có chủ đầu tư.
 *
 * "Kính gửi" lấy từ khách trong CRM thay vì từ chủ đầu tư. Hai nguồn khác nhau nhưng
 * cùng đổ vào những cột chụp lại (`recipient`, `customerPhone`), nên bản in giống hệt.
 */
export default async function CoHoiClientQuotePage({
  params,
}: {
  params: Promise<{ coHoiId: string }>;
}) {
  const { coHoiId } = await params;
  const session = await requireCoHoiView("quote", coHoiId);
  const canEdit = can(session.role as Role, "quote", "edit");
  const canViewCrm = can(session.role as Role, "customer", "view");
  const canEditCrm = can(session.role as Role, "customer", "edit");

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
        khachHang: {
          select: { id: true, tenCty: true, phone: true, customerId: true },
        },
      },
    }),
    napDuLieuBaoGiaKhach({ loai: "CO_HOI", id: coHoiId }, canViewCrm),
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
              Báo giá gửi khách — {coHoi.tenCongTrinh}
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
          href={`/co-hoi/${coHoi.id}/quote`}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          <Receipt className="h-4 w-4" /> Dự toán chi tiết
        </Link>
      </div>

      <ClientQuoteEditor
        chu={{ loai: "CO_HOI", id: coHoi.id }}
        quotes={duLieu.quotes}
        customers={duLieu.customers}
        canEdit={canEdit}
        canViewCrm={canViewCrm}
        canEditCrm={canEditCrm}
        templates={mau.options}
        templateGoiY={mau.goiY}
        goiY={{
          // Khách chào giá thường chưa nối với chủ đầu tư nào — để trống là đúng, ô
          // này chỉ có giá trị khi người dùng đã tự nối hai bên với nhau.
          customerId: coHoi.khachHang.customerId,
          recipient: coHoi.khachHang.tenCty,
          customerPhone: coHoi.khachHang.phone,
          location: coHoi.diaDiem,
          salesName: session.name,
          salesEmail: session.email,
        }}
      />
    </div>
  );
}
