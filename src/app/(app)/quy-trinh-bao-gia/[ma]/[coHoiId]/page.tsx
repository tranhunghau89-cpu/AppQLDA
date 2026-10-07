import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireCoHoiView } from "@/lib/coHoiAccess";
import { can, type Role } from "@/lib/rbac";
import { templateChoices } from "@/lib/quoteTemplatePick";
import { CO_HOI_TRANG_THAI_MAP } from "@/lib/constants";
import { formatQty } from "@/lib/utils";
import { thongTinNguoiLap } from "@/lib/nguoiLapBaoGia";
import {
  BAO_GIA_DA_GUI,
  buocDaXong,
  buocToiDa,
  chonBuoc,
  timQuyTrinh,
  type TienDoCoHoi,
} from "@/lib/quyTrinhBaoGia";
import { Badge } from "@/components/ui/badge";
import { QuoteEditor } from "../../../projects/[id]/quote/QuoteEditor";
import { napDuLieuBaoGia } from "../../../projects/[id]/quote/napDuLieu";
import { ClientQuoteEditor } from "../../../projects/[id]/client-quote/ClientQuoteEditor";
import { napDuLieuBaoGiaKhach } from "../../../projects/[id]/client-quote/napDuLieu";
import { ThanhBuoc } from "../../ThanhBuoc";
import { GuiKhach } from "./GuiKhach";

/**
 * Một bước của quy trình cho một công trình đã có. Bước hiện tại đọc từ `?buoc=`;
 * thiếu thì mở bước còn dở. Nội dung từng bước là CHÍNH màn hình dự toán / báo giá
 * của cơ hội — quy trình chỉ thêm thanh bước và nút "Tiếp".
 */
export default async function BuocQuyTrinhPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string; coHoiId: string }>;
  searchParams: Promise<{ buoc?: string }>;
}) {
  const [{ ma, coHoiId }, { buoc }] = await Promise.all([params, searchParams]);
  const qt = timQuyTrinh(ma);
  if (!qt) notFound();

  const session = await requireCoHoiView("quote", coHoiId);
  const canEdit = can(session.role as Role, "quote", "edit");

  const [coHoi, soDuToanCoDong, soBaoGiaCoDong, soBaoGiaDaGui] = await Promise.all([
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
          select: { id: true, tenCty: true, phone: true, nguoiLienHe: true, customerId: true },
        },
      },
    }),
    db.quote.count({ where: { coHoiId, items: { some: {} } } }),
    db.clientQuote.count({ where: { coHoiId, lines: { some: {} } } }),
    db.clientQuote.count({ where: { coHoiId, status: { in: BAO_GIA_DA_GUI } } }),
  ]);
  if (!coHoi) notFound();

  const tienDo: TienDoCoHoi = { soDuToanCoDong, soBaoGiaCoDong, soBaoGiaDaGui };
  const toiDa = buocToiDa(qt, tienDo);
  const hienTai = chonBuoc(qt, tienDo, buoc);
  const base = `/quy-trinh-bao-gia/${qt.ma}/${coHoi.id}`;
  // Gõ tay ?buoc= vượt quá chỗ được phép -> đưa về bước còn dở, URL nói đúng sự thật.
  if (buoc && String(hienTai) !== buoc) redirect(`${base}?buoc=${hienTai}`);

  const b = qt.buoc[hienTai - 1];
  const xong = buocDaXong(b.loai, tienDo);
  const laCuoi = hienTai === qt.buoc.length;
  const tt = CO_HOI_TRANG_THAI_MAP[coHoi.trangThai];
  const chu = { loai: "CO_HOI" as const, id: coHoi.id };

  let noiDung: React.ReactNode = null;
  if (b.loai === "KHACH_HANG") {
    noiDung = (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <ThongTin nhan="Khách hàng" giaTri={coHoi.khachHang.tenCty} />
          <ThongTin nhan="Người liên hệ" giaTri={coHoi.khachHang.nguoiLienHe} />
          <ThongTin nhan="Điện thoại" giaTri={coHoi.khachHang.phone} />
          <ThongTin nhan="Công trình" giaTri={coHoi.tenCongTrinh} />
          <ThongTin nhan="Địa điểm" giaTri={coHoi.diaDiem} />
          <ThongTin nhan="Loại công trình" giaTri={coHoi.buildingType} />
          <ThongTin
            nhan="Diện tích"
            giaTri={coHoi.area != null ? `${formatQty(coHoi.area)} m²` : null}
          />
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Cần sửa thông tin? Vào{" "}
          <Link href="/khach-hang" className="text-blue-600 hover:underline">
            Khách hàng (CRM)
          </Link>
          .
        </p>
      </div>
    );
  } else if (b.loai === "DU_TOAN") {
    const [duLieu, mau] = await Promise.all([
      napDuLieuBaoGia(session, chu),
      templateChoices(coHoi.buildingType),
    ]);
    noiDung = (
      <QuoteEditor
        chu={chu}
        quotes={duLieu.quotes}
        catalog={duLieu.catalog}
        cloneSources={duLieu.cloneSources}
        canEdit={canEdit}
        projectArea={coHoi.area}
        templates={mau.options}
        templateGoiY={mau.goiY}
        khuVucs={duLieu.khuVucs}
        boHangMucs={duLieu.boHangMucs}
        khuVucMacDinh={null}
      />
    );
  } else if (b.loai === "BAO_GIA") {
    const canViewCrm = can(session.role as Role, "customer", "view");
    const canEditCrm = can(session.role as Role, "customer", "edit");
    const [duLieu, mau, nguoiLap] = await Promise.all([
      napDuLieuBaoGiaKhach(chu, canViewCrm),
      templateChoices(coHoi.buildingType),
      thongTinNguoiLap(session),
    ]);
    noiDung = (
      <ClientQuoteEditor
        chu={chu}
        quotes={duLieu.quotes}
        customers={duLieu.customers}
        canEdit={canEdit}
        canViewCrm={canViewCrm}
        canEditCrm={canEditCrm}
        templates={mau.options}
        templateGoiY={mau.goiY}
        goiY={{
          customerId: coHoi.khachHang.customerId,
          recipient: coHoi.khachHang.tenCty,
          customerPhone: coHoi.khachHang.phone,
          location: coHoi.diaDiem,
          ...nguoiLap,
        }}
      />
    );
  } else {
    const baoGia = await db.clientQuote.findMany({
      where: { coHoiId, lines: { some: {} } },
      orderBy: { createdAt: "desc" },
      select: { id: true, quoteNo: true, title: true, status: true, sentDate: true },
    });
    noiDung = (
      <GuiKhach
        coHoiId={coHoi.id}
        canEdit={canEdit}
        baoGia={baoGia.map((q) => ({ ...q, sentDate: q.sentDate?.toISOString() ?? null }))}
      />
    );
  }

  const lyDoChuaXong: Record<string, string> = {
    DU_TOAN: "Cần ít nhất một bản dự toán có dòng công tác.",
    BAO_GIA: "Cần ít nhất một báo giá có hạng mục.",
    GUI_KHACH: "Cần đánh dấu ít nhất một báo giá đã gửi.",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/quy-trinh-bao-gia"
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{coHoi.tenCongTrinh}</h1>
            <Badge tone={tt?.tone ?? "slate"}>{tt?.label ?? coHoi.trangThai}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {qt.ten} · {coHoi.khachHang.tenCty}
          </p>
        </div>
      </div>

      <ThanhBuoc qt={qt} hienTai={hienTai} toiDa={toiDa} hrefBuoc={(n) => `${base}?buoc=${n}`} />

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <span className="font-semibold">
          Bước {hienTai}/{qt.buoc.length}: {b.ten}.
        </span>{" "}
        {b.huongDan}
      </div>

      {noiDung}

      <DieuHuong
        truoc={hienTai > 1 ? `${base}?buoc=${hienTai - 1}` : "/quy-trinh-bao-gia"}
        tiep={xong && !laCuoi ? `${base}?buoc=${hienTai + 1}` : null}
        laCuoi={laCuoi}
        xong={xong}
        lyDo={lyDoChuaXong[b.loai]}
      />
    </div>
  );
}

function ThongTin({ nhan, giaTri }: { nhan: string; giaTri: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-slate-500">{nhan}</dt>
      <dd className="text-slate-900">{giaTri || "—"}</dd>
    </div>
  );
}

function DieuHuong({
  truoc,
  tiep,
  laCuoi,
  xong,
  lyDo,
}: {
  truoc: string;
  tiep: string | null;
  laCuoi: boolean;
  xong: boolean;
  lyDo?: string;
}) {
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
      <Link
        href={truoc}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>
      <div className="flex items-center gap-3">
        {!xong && lyDo && <span className="text-sm text-amber-700">{lyDo}</span>}
        {laCuoi && xong ? (
          <Link
            href="/quy-trinh-bao-gia"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
          >
            Hoàn tất
          </Link>
        ) : tiep ? (
          <Link
            href={tiep}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Tiếp <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white opacity-50">
            Tiếp <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
