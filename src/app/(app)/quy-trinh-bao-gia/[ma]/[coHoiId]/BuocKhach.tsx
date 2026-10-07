import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { duocDungKhachHang } from "@/lib/crmScope";
import { KHACH_NGUON } from "@/lib/constants";
import {
  buocDaXong,
  buocToiDa,
  chonBuoc,
  dauNgayVN,
  type QuyTrinh,
  type TienDoCoHoi,
} from "@/lib/quyTrinhBaoGia";
import { InteractionLog } from "@/components/crm/InteractionLog";
import { ThanhBuoc } from "../../ThanhBuoc";
import { DieuHuong } from "../../DieuHuong";

/** Các bước của quy trình chạy trên một KHÁCH (không có công trình). */
export async function BuocKhach({
  qt,
  khachHangId,
  buoc,
}: {
  qt: QuyTrinh;
  khachHangId: string;
  buoc: string | undefined;
}) {
  const session = await requireView("customer");
  const canEdit = can(session.role as Role, "customer", "edit");

  const kh = await db.khachHang.findUnique({
    where: { id: khachHangId },
    include: { traoDoi: { orderBy: { contactDate: "desc" }, take: 30 } },
  });
  // Ngoài phạm vi -> 404 như requireCoHoiView: không tiết lộ khách có tồn tại không.
  if (!kh || !duocDungKhachHang(session, kh.ownerId)) notFound();

  const homNay = dauNgayVN();
  const tienDo: TienDoCoHoi = {
    soTraoDoiHomNay: kh.traoDoi.filter((n) => n.createdAt >= homNay).length,
  };
  const toiDa = buocToiDa(qt, tienDo);
  const hienTai = chonBuoc(qt, tienDo, buoc);
  const base = `/quy-trinh-bao-gia/${qt.ma}/${kh.id}`;
  if (buoc && String(hienTai) !== buoc) redirect(`${base}?buoc=${hienTai}`);

  const b = qt.buoc[hienTai - 1];
  const xong = buocDaXong(b.loai, tienDo);
  const laCuoi = hienTai === qt.buoc.length;
  const nguon = KHACH_NGUON.find((n) => n.value === kh.nguon)?.label ?? null;

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
          <h1 className="text-2xl font-semibold text-slate-900">{kh.tenCty}</h1>
          <p className="text-sm text-slate-500">{qt.ten}</p>
        </div>
      </div>

      <ThanhBuoc
        qt={qt}
        hienTai={hienTai}
        toiDa={toiDa}
        hrefBuoc={(n) => `${base}?buoc=${n}`}
      />

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <span className="font-semibold">
          Bước {hienTai}/{qt.buoc.length}: {b.ten}.
        </span>{" "}
        {b.huongDan}
      </div>

      {b.loai === "KHACH_HANG" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <ThongTin nhan="Khách hàng" giaTri={kh.tenCty} />
            <ThongTin nhan="Người liên hệ" giaTri={kh.nguoiLienHe} />
            <ThongTin nhan="Điện thoại" giaTri={kh.phone} />
            <ThongTin nhan="Email" giaTri={kh.email} />
            <ThongTin nhan="Địa chỉ" giaTri={kh.diaChi} />
            <ThongTin nhan="Nguồn" giaTri={nguon} />
            <ThongTin nhan="Phụ trách" giaTri={kh.ownerName} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Cần sửa thông tin? Vào{" "}
            <Link href="/khach-hang" className="text-blue-600 hover:underline">
              Khách hàng (CRM)
            </Link>
            .
          </p>
        </div>
      ) : (
        <InteractionLog
          chu={{ loai: "KHACH", id: kh.id }}
          canEdit={canEdit}
          notes={kh.traoDoi.map((n) => ({
            id: n.id,
            kind: n.kind,
            contactDate: n.contactDate.toISOString(),
            content: n.content,
            authorName: n.authorName,
            nextFollowUpDate: n.nextFollowUpDate?.toISOString() ?? null,
          }))}
        />
      )}

      <DieuHuong
        truoc={
          hienTai > 1
            ? `${base}?buoc=${hienTai - 1}`
            : `/quy-trinh-bao-gia/${qt.ma}`
        }
        tiep={xong && !laCuoi ? `${base}?buoc=${hienTai + 1}` : null}
        laCuoi={laCuoi}
        xong={xong}
        lyDo={
          b.loai === "TRAO_DOI"
            ? "Cần ít nhất một ghi chép trao đổi trong hôm nay."
            : undefined
        }
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
