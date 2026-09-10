import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarRange,
  FileSignature,
  Flag,
  Info,
  Minus,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { scopedProjectWhere, scopedByProjectWhere } from "@/lib/scope";
import { computeContractTotals } from "@/lib/contract";
import { serverNow } from "@/lib/now";
import { formatVND, formatNumber, formatDate } from "@/lib/utils";
import {
  buildBaoCaoKy,
  cacKyGanDay,
  docMaKy,
  khoangKy,
  kyChua,
  kyTruoc,
  maKy,
  nhanKy,
  phanTramDoi,
  type Gop,
  type Ky,
  type LoaiKy,
  type NguonBaoCao,
} from "@/lib/period";

const LOAI_NHAN: Record<LoaiKy, string> = {
  thang: "Tháng",
  quy: "Quý",
  nam: "Năm",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ ky?: string; loai?: string }>;
}) {
  const session = await requireView("cost");
  const sp = await searchParams;

  // serverNow() trả về mốc ms; đổi sang Date một lần rồi dùng lại, để mọi con số
  // trên trang cùng nói về một thời điểm.
  const bayGio = new Date(serverNow());
  const loai: LoaiKy =
    sp.loai === "quy" || sp.loai === "nam" || sp.loai === "thang" ? sp.loai : "thang";
  // Mã kỳ hỏng trên thanh địa chỉ thì lùi về kỳ hiện tại thay vì báo lỗi.
  const ky: Ky = docMaKy(sp.ky) ?? kyChua(loai, bayGio);
  const truoc = kyTruoc(ky);

  // Lấy đúng một lượt cho CẢ HAI kỳ rồi cộng dồn trong bộ nhớ. Tách thành hai lượt
  // truy vấn theo khoảng thời gian sẽ gấp đôi số round-trip mà chẳng được gì —
  // toàn bộ dữ liệu ở đây chỉ vài trăm dòng (kết luận của Phase 24).
  const [thanhToan, hopDongRaw, donHang, duAn, moc] = await Promise.all([
    db.payment.findMany({
      where: await scopedByProjectWhere(session),
      select: { direction: true, paidDate: true, paidAmount: true, amount: true },
    }),
    db.contract.findMany({
      where: await scopedByProjectWhere(session),
      select: {
        signDate: true,
        vatPercent: true,
        items: { select: { qty: true, unitPrice: true, amount: true } },
      },
    }),
    db.purchaseOrder.findMany({
      where: await scopedByProjectWhere(session),
      select: { orderDate: true, value: true },
    }),
    db.project.findMany({
      where: await scopedProjectWhere(session),
      select: { startDate: true, endDate: true, salePrice: true },
    }),
    db.milestone.findMany({
      where: await scopedByProjectWhere(session),
      select: { actualDate: true, done: true },
    }),
  ]);

  /**
   * Chỗ trống trong dữ liệu, nói thẳng ra thay vì để người đọc thấy toàn số 0 rồi
   * tưởng báo cáo hỏng.
   *
   * Phát hiện khi đối chiếu trên dữ liệu thật: KHÔNG đợt thanh toán nào từng được
   * ghi ngày thực thu/thực trả, và không mốc nào có ngày hoàn thành thực tế — mốc
   * chỉ được đánh dấu `done`. Báo cáo cố ý vẫn tính theo ngày THỰC TẾ (đó mới là
   * dòng tiền thật), nên phần còn thiếu phải hiện ra như một việc cần nhập, không
   * phải giấu đi bằng cách lùi về ngày kế hoạch.
   */
  const thieu: string[] = [];
  if (thanhToan.length > 0 && thanhToan.every((t) => !t.paidDate)) {
    thieu.push(
      `${thanhToan.length} đợt thanh toán chưa đợt nào được ghi ngày thực thu / thực trả — mọi con số dòng tiền sẽ bằng 0 cho tới khi nhập ngày.`
    );
  }
  const mocXong = moc.filter((m) => m.done).length;
  if (mocXong > 0 && moc.every((m) => !m.actualDate)) {
    thieu.push(
      `${mocXong} mốc đã đánh dấu hoàn thành nhưng chưa mốc nào có ngày hoàn thành thực tế, nên không xếp được vào kỳ nào.`
    );
  }

  const nguon: NguonBaoCao = {
    thanhToan,
    // Giá trị hợp đồng tính lại từ hạng mục — cột valueWithVat trong DB nhiều dòng
    // còn trống, dùng thẳng thì báo cáo thiếu tiền mà không ai biết.
    hopDong: hopDongRaw.map((h) => ({
      signDate: h.signDate,
      giaTri: computeContractTotals(h.items, h.vatPercent).withVat,
    })),
    donHang,
    duAn,
    moc,
  };

  const nay = buildBaoCaoKy(nguon, ky);
  const cu = buildBaoCaoKy(nguon, truoc);
  const dsKy = cacKyGanDay(kyChua(loai, bayGio), loai === "thang" ? 12 : loai === "quy" ? 8 : 5);
  const khoang = khoangKy(ky);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Báo cáo theo kỳ</h1>
        <p className="text-sm text-slate-500">
          {nay.nhan} · {formatDate(khoang.tu)} – {formatDate(new Date(khoang.den.getTime() - 1))}{" "}
          · so với {nhanKy(truoc)}
        </p>
      </div>

      {/* Chọn kỳ bằng link, không cần JavaScript phía client — cùng cách đã dùng ở
          trang Nhật ký thay đổi của Phase 25. */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {(["thang", "quy", "nam"] as LoaiKy[]).map((l) => (
            <Link
              key={l}
              href={`/reports?loai=${l}&ky=${maKy(kyChua(l, bayGio))}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                loai === l
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {LOAI_NHAN[l]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dsKy.map((k) => {
            const dangChon = maKy(k) === maKy(ky);
            return (
              <Link
                key={maKy(k)}
                href={`/reports?loai=${loai}&ky=${maKy(k)}`}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  dangChon
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {nhanKy(k)}
              </Link>
            );
          })}
        </div>
      </div>

      {thieu.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <Info className="h-4 w-4" aria-hidden="true" />
            Vì sao vài ô bên dưới bằng 0
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-900">
            {thieu.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <The
          nhan="Tiền đã thu"
          icon={Banknote}
          gop={nay.tienVao}
          gopCu={cu.tienVao}
          donVi="khoản"
          tot="tang"
        />
        <The
          nhan="Tiền đã chi"
          icon={Wallet}
          gop={nay.tienRa}
          gopCu={cu.tienRa}
          donVi="khoản"
          tot="giam"
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Dòng tiền ròng</div>
          <div
            className={`mt-1 text-2xl font-semibold ${
              nay.dongTienRong >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {formatVND(nay.dongTienRong)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Thu {formatNumber(nay.tienVao.tien)} − chi {formatNumber(nay.tienRa.tien)}
          </div>
          <ChenhLech nay={nay.dongTienRong} cu={cu.dongTienRong} tot="tang" />
        </div>

        <The
          nhan="Hợp đồng ký mới"
          icon={FileSignature}
          gop={nay.hopDongKy}
          gopCu={cu.hopDongKy}
          donVi="hợp đồng"
          tot="tang"
        />
        <The
          nhan="Đơn hàng đặt"
          icon={ShoppingCart}
          gop={nay.donHang}
          gopCu={cu.donHang}
          donVi="đơn"
          tot="tang"
        />
        <The
          nhan="Mốc hoàn thành"
          icon={Flag}
          gop={nay.mocHoanThanh}
          gopCu={cu.mocHoanThanh}
          donVi="mốc"
          tot="tang"
          anTien
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Dự án trong kỳ</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <DongDuAn nhan="Khởi công" gop={nay.duAnKhoiCong} gopCu={cu.duAnKhoiCong} />
          <DongDuAn nhan="Hoàn thành" gop={nay.duAnHoanThanh} gopCu={cu.duAnHoanThanh} />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Tính theo ngày bắt đầu / ngày kết thúc ghi trên dự án. Dự án chưa điền ngày
          không xuất hiện ở đây.
        </p>
      </div>

      <p className="text-xs text-slate-400">
        Mọi con số chỉ tính trên các dự án anh/chị được phân công. Dòng tiền lấy theo
        ngày thực thu / thực trả, không phải theo kế hoạch.
      </p>
    </div>
  );
}

function The({
  nhan,
  icon: Icon,
  gop,
  gopCu,
  donVi,
  tot,
  anTien = false,
}: {
  nhan: string;
  icon: typeof Banknote;
  gop: Gop;
  gopCu: Gop;
  donVi: string;
  /** Chiều nào là tốt, để tô màu mũi tên. */
  tot: "tang" | "giam";
  anTien?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
        {nhan}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">
        {anTien ? formatNumber(gop.so) : formatVND(gop.tien)}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {anTien ? donVi : `${formatNumber(gop.so)} ${donVi}`}
      </div>
      <ChenhLech nay={anTien ? gop.so : gop.tien} cu={anTien ? gopCu.so : gopCu.tien} tot={tot} />
    </div>
  );
}

function DongDuAn({ nhan, gop, gopCu }: { nhan: string; gop: Gop; gopCu: Gop }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{nhan}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-900">
        {formatNumber(gop.so)} dự án
      </div>
      <div className="text-xs text-slate-500">Giá trị {formatVND(gop.tien)}</div>
      <ChenhLech nay={gop.so} cu={gopCu.so} tot="tang" />
    </div>
  );
}

/** Dòng so sánh với kỳ trước. Kỳ trước bằng 0 thì hiện dấu gạch, không hiện ∞%. */
function ChenhLech({ nay, cu, tot }: { nay: number; cu: number; tot: "tang" | "giam" }) {
  const pt = phanTramDoi(nay, cu);
  if (pt === null) {
    return (
      <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
        <Minus className="h-3 w-3" aria-hidden="true" />
        kỳ trước không có số liệu
      </div>
    );
  }

  const tang = pt > 0;
  const khong = Math.abs(pt) < 0.05;
  const tichCuc = tot === "tang" ? tang : !tang;
  const mau = khong ? "text-slate-400" : tichCuc ? "text-green-600" : "text-red-600";
  const Icon = khong ? Minus : tang ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={`mt-2 flex items-center gap-1 text-xs ${mau}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {khong ? "không đổi" : `${tang ? "+" : ""}${pt.toFixed(1)}% so với kỳ trước`}
    </div>
  );
}
