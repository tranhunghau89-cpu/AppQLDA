"use client";

import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatNumber, formatVND, formatQty } from "@/lib/utils";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";
import type { ChuBaoGia } from "@/lib/quoteOwner";
import { suaOGiaVon } from "../quote/actions";
import type { GiaVonPhan, LineView } from "./types";

/**
 * Giá vốn theo từng hạng mục — cái nhân viên kinh doanh cần để quyết định giá bán.
 *
 * Bày đủ ba tầng: một dòng cho mỗi hạng mục để nhìn lướt biết chỗ nào mỏng lãi, bấm
 * vào thì bung ra từng công tác, và một dòng tổng cho cả bản dự toán.
 *
 * KHÔNG in cho khách. Đây là số nội bộ; bản in nằm ở XemTruoc.tsx và không đọc gì ở đây.
 */
export function GiaVonPanel({
  chu,
  canEdit,
  giaVon,
  lines,
}: {
  chu: ChuBaoGia;
  /** Cùng quyền với sửa dự toán chào giá — số ở đây CHÍNH LÀ các dòng của bản đó. */
  canEdit: boolean;
  giaVon: GiaVonPhan[];
  lines: LineView[];
}) {
  const [mo, setMo] = useState<string | null>(null);

  // Đơn giá bán của hạng mục lấy từ dòng gửi khách trỏ về đúng phần đó. Nhiều dòng
  // cùng trỏ một phần thì lấy dòng đầu — đó là trường hợp bất thường, và cộng chúng
  // lại sẽ cho một "đơn giá" không có nghĩa.
  const giaBanCua = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const l of lines) {
      if (l.sourceSectionId && !m.has(l.sourceSectionId)) m.set(l.sourceSectionId, l.unitPrice);
    }
    return m;
  }, [lines]);

  const tong = useMemo(
    () => giaVon.reduce((t, p) => t + p.tongGiaVon, 0),
    [giaVon]
  );
  const tongBan = useMemo(
    () =>
      giaVon.reduce((t, p) => {
        const dg = giaBanCua.get(p.sectionId);
        return t + (dg != null && p.dienTich != null ? dg * p.dienTich : 0);
      }, 0),
    [giaVon, giaBanCua]
  );

  if (giaVon.length === 0) return null;

  return (
    <details className="border-t border-slate-100" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Wallet className="h-4 w-4 text-slate-400" />
        Giá vốn theo hạng mục
        <span className="font-normal text-slate-400">
          — {giaVon.length} hạng mục · tổng vốn {formatVND(tong)}
        </span>
      </summary>

      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-2 text-left font-medium">Hạng mục</th>
              <th className="px-2 py-2 text-right font-medium">Diện tích</th>
              <th className="px-2 py-2 text-right font-medium">Tổng giá vốn</th>
              <th className="px-2 py-2 text-right font-medium">Vốn / m²</th>
              <th className="px-2 py-2 text-right font-medium">Bán / m²</th>
              <th className="px-2 py-2 text-right font-medium">Lãi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {giaVon.map((p) => {
              const ban = giaBanCua.get(p.sectionId) ?? null;
              const bung = mo === p.sectionId;
              return (
                <Fragment key={p.sectionId}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setMo(bung ? null : p.sectionId)}
                  >
                    <td className="py-1.5 pr-2 text-slate-800">
                      {bung ? (
                        <ChevronDown className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className="mr-1.5 font-mono text-slate-400">{p.ma}</span>
                      {p.ten}
                      <span className="ml-1.5 text-xs text-slate-400">
                        {p.dong.length} công tác
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                      {p.dienTich != null ? formatQty(p.dienTich) + " m²" : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                      {formatVND(p.tongGiaVon)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium text-slate-900">
                      {p.giaVonM2 != null ? formatVND(p.giaVonM2) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                      {ban != null ? formatVND(ban) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <NhanLai von={p.giaVonM2} ban={ban} />
                    </td>
                  </tr>
                  {bung && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-3 py-2">
                        {p.dong.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            Hạng mục này chưa có dòng công tác nào — giá vốn bằng 0.
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-slate-500">
                              <tr>
                                <th className="py-1 text-left font-medium">Công tác</th>
                                <th className="px-2 py-1 text-left font-medium">ĐVT</th>
                                <th className="px-2 py-1 text-right font-medium">Khối lượng</th>
                                <th className="px-2 py-1 text-right font-medium">Đơn giá vốn</th>
                                <th className="px-2 py-1 text-right font-medium">Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.dong.map((d) => (
                                <tr key={d.id} className="border-t border-slate-200/70">
                                  <td className="py-1 text-slate-700">{d.ten}</td>
                                  <td className="px-2 py-1 text-slate-500">{d.donVi ?? "—"}</td>
                                  <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                                    {canEdit ? (
                                      <OSoGiaVon
                                        nhan={`Khối lượng công tác — ${d.ten}`}
                                        giaTri={d.qty}
                                        dinhDang={formatQty}
                                        khoa={d.laDanXuat}
                                        lyDoKhoa="Tự tính từ các dòng nguồn trong cùng phần — sửa ở dòng nguồn"
                                        luu={(tho) => suaOGiaVon(chu, d.id, "qty", tho)}
                                      />
                                    ) : d.qty != null ? (
                                      formatQty(d.qty)
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                                    {canEdit ? (
                                      <OSoGiaVon
                                        nhan={`Đơn giá vốn — ${d.ten}`}
                                        giaTri={d.donGia}
                                        dinhDang={formatNumber}
                                        khoa={false}
                                        luu={(tho) => suaOGiaVon(chu, d.id, "baseCost", tho)}
                                      />
                                    ) : d.donGia != null ? (
                                      formatVND(d.donGia)
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-right tabular-nums text-slate-800">
                                    {formatVND(d.thanhTien)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200">
            <tr>
              <td className="py-2 pr-2 font-semibold text-slate-800">Cả bản dự toán</td>
              <td />
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                {formatVND(tong)}
              </td>
              <td />
              <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                {tongBan > 0 ? formatVND(tongBan) : "—"}
              </td>
              <td className="px-2 py-2 text-right">
                <NhanLai von={tong} ban={tongBan > 0 ? tongBan : null} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}

/**
 * Nhãn lãi.
 *
 * Lãi tính trên GIÁ BÁN (biên lợi nhuận), cùng cách với bảng "Chi phí & Lợi nhuận"
 * bên dự toán thi công — hai chỗ nói cùng một con số thì mới so được với nhau.
 * Giá bán bằng 0 thì không có biên để nói, trả gạch chứ không trả 0%.
 */
export function NhanLai({ von, ban }: { von: number | null; ban: number | null }) {
  if (von == null || ban == null || ban <= 0) return <span className="text-slate-400">—</span>;
  const bien = (ban - von) / ban;
  const am = bien < 0;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
        am ? "bg-red-50 text-red-700" : bien < 0.1 ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-700"
      }`}
    >
      {(bien * 100).toFixed(1)}%
    </span>
  );
}

/**
 * Một ô số sửa được ngay trong bảng giá vốn.
 *
 * Hiện số đã định dạng kiểu Việt; bấm vào là gõ. Enter hoặc rời ô thì lưu, Esc thì thôi.
 * Chỉ gửi lên khi chuỗi THỰC SỰ khác số đang hiện — bấm vào rồi bấm ra không được sinh
 * một lượt ghi, vì mỗi lượt ghi dòng nguồn còn kéo theo tính lại các dòng dẫn xuất.
 *
 * Giữ chuỗi người đang gõ ở state riêng (`nhap`), còn lại luôn đọc số từ máy chủ — đúng
 * nếp của bảng suất khối lượng. Sau khi lưu, `router.refresh()` kéo số mới về, kể cả
 * thành tiền, tổng hạng mục và các dòng vận chuyển vừa được tính lại.
 */
function OSoGiaVon({
  giaTri,
  dinhDang,
  khoa,
  lyDoKhoa,
  nhan,
  luu,
}: {
  giaTri: number | null;
  dinhDang: (v: number | null) => string;
  khoa: boolean;
  lyDoKhoa?: string;
  nhan: string;
  luu: (tho: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  const [nhap, setNhap] = useState<string | null>(null);
  const huy = useRef(false);

  const hienThi = giaTri == null ? "" : dinhDang(giaTri);

  if (khoa) {
    return (
      <span className="tabular-nums text-slate-500" title={lyDoKhoa}>
        {giaTri == null ? "—" : dinhDang(giaTri)}
        <span className="ml-1 text-slate-400">∑</span>
      </span>
    );
  }

  function roiO(tho: string) {
    if (huy.current) {
      huy.current = false;
      setNhap(null);
      return;
    }
    if (tho.trim() === hienThi) {
      setNhap(null);
      return;
    }
    start(async () => {
      const res = await luu(tho);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
      setNhap(null);
    });
  }

  const xemTruoc = nhap != null && laCongThuc(nhap) ? tinhBieuThuc(nhap) : null;

  return (
    <span className="relative inline-block">
      <input
        aria-label={nhan}
        inputMode="decimal"
        value={nhap ?? hienThi}
        placeholder="—"
        disabled={dangLuu}
        onFocus={(e) => {
          setNhap(hienThi);
          e.currentTarget.select();
        }}
        onChange={(e) => setNhap(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            huy.current = true;
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => roiO(e.currentTarget.value)}
        className="w-28 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-right tabular-nums text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-50"
      />
      {xemTruoc != null && (
        <span className="absolute right-1 top-full z-10 mt-0.5 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-white">
          = {dinhDang(xemTruoc)}
        </span>
      )}
    </span>
  );
}
