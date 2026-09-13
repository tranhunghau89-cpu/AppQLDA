"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";

/**
 * Một ô số sửa được ngay trong ô bảng — dùng chung cho bảng giá vốn của báo giá gửi khách
 * và bảng dự toán thi công, để hai nơi gõ, lưu, huỷ, báo lỗi giống hệt nhau.
 *
 * Hiện số đã định dạng kiểu Việt; bấm vào là gõ. Enter hoặc rời ô thì lưu, Esc thì thôi.
 * Chỉ gửi lên khi chuỗi THỰC SỰ khác số đang hiện — bấm vào rồi bấm ra không được sinh
 * một lượt ghi, vì mỗi lượt ghi dòng nguồn còn kéo theo tính lại các dòng dẫn xuất.
 *
 * Giữ chuỗi người đang gõ ở state riêng (`nhap`), còn lại luôn đọc số từ máy chủ — đúng
 * nếp của bảng suất khối lượng. Sau khi lưu, `router.refresh()` kéo số mới về, kể cả
 * thành tiền, tổng hạng mục và các dòng vận chuyển vừa được tính lại.
 */
export function OSoSua({
  giaTri,
  dinhDang,
  khoa,
  lyDoKhoa,
  dauKhoa = "∑",
  nhan,
  luu,
}: {
  giaTri: number | null;
  dinhDang: (v: number | null) => string;
  khoa: boolean;
  lyDoKhoa?: string;
  /** Dấu hiện cạnh số bị khoá: ∑ = tự tính từ dòng khác, ▤ = từ bảng bóc chi tiết. */
  dauKhoa?: string;
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
        <span className="ml-1 text-slate-400">{dauKhoa}</span>
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
        // Rộng VỪA số đang hiện chứ không cố định. Ô cố định 112px ở hai cột số làm bảng
        // dự toán thi công ép cột tên và cột thành tiền xuống hai hàng — dòng cao 49px
        // ngay sau khi vừa thu về 37px.
        //
        // `field-sizing: content` co ô đúng theo chữ. `size` KHÔNG làm được việc đó: đo
        // thật, size=9 cho ô 114px trong khi "10.218,2" chỉ cần 39px. Giữ `size` làm dự
        // phòng cho trình duyệt chưa hỗ trợ field-sizing — rộng hơn nhưng không vỡ.
        size={Math.max(4, (nhap ?? hienThi).length + 1)}
        className="field-sizing-content min-w-[4ch] rounded border border-transparent bg-transparent px-1.5 py-0.5 text-right tabular-nums text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-50"
      />
      {xemTruoc != null && (
        <span className="absolute right-1 top-full z-10 mt-0.5 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-white">
          = {dinhDang(xemTruoc)}
        </span>
      )}
    </span>
  );
}
