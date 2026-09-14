"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";
import { locCongTac } from "@/lib/thuVien/locCongTac";
import type { CongTacTimDuoc } from "@/lib/thuVien/locCongTac";

/**
 * Ô "Nội dung công việc" sửa ngay trên bảng: gõ để đổi tên, hoặc chọn một công tác khác
 * trong danh sách thư viện hiện ngay bên dưới.
 *
 * Bàn phím: ↑/↓ chọn trong danh sách, Enter lưu (công tác đang chọn, hoặc tên vừa gõ
 * nếu chưa chọn gì), Esc thôi. Rời ô mà tên đã khác thì lưu tên — cùng nếp với ô số.
 *
 * Danh sách vẽ bằng portal với vị trí `fixed`: bảng nằm trong khung `overflow-x-auto`,
 * mà khung đó cắt mọi thứ tràn ra ngoài, kể cả theo chiều dọc.
 *
 * Dùng chung cho dự toán chào giá và dự toán thi công: ô chỉ lo gõ, tìm, chọn; việc
 * đổi công tác kéo theo những gì (tên dài hay tên gọn, giá theo khu vực nào) là của
 * action mà mỗi bảng truyền vào qua `luu`.
 */
export interface CongTacChon extends CongTacTimDuoc {
  congTacId: string;
  unit: string | null;
  /** Đơn giá chung hiện hành, chỉ để hiện tham khảo trong danh sách. */
  baseCost: number | null;
}

export function OChonCongTac({
  ten,
  congTacId,
  catalog,
  luu,
}: {
  /** Tên đang hiện của dòng. */
  ten: string;
  /** Công tác đang gắn, để đánh dấu trong danh sách; null = dòng gõ tay. */
  congTacId: string | null;
  catalog: CongTacChon[];
  luu: (
    chon: { ten: string } | { congTacId: string }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  const [nhap, setNhap] = useState<string | null>(null);
  // Người dùng đã gõ gì chưa kể từ lúc bấm vào. Chưa gõ thì danh sách hiện cả thư viện,
  // không lọc theo tên đang có — tên đầy đủ kèm TSKT gần như không khớp công tác nào khác.
  const [daGo, setDaGo] = useState(false);
  const [chiSo, setChiSo] = useState(-1);
  const [khung, setKhung] = useState<DOMRect | null>(null);
  const oRef = useRef<HTMLTextAreaElement>(null);
  const dsRef = useRef<HTMLUListElement>(null);
  const huy = useRef(false);
  const idDs = useId();

  const dangSua = nhap != null;
  // Chưa gõ thì hiện ĐỦ thư viện để lướt chọn; đã gõ thì 50 kết quả là quá đủ.
  const ketQua = !dangSua ? [] : daGo ? locCongTac(catalog, nhap) : catalog;

  // Bám theo ô khi trang cuộn hoặc đổi cỡ, để danh sách không trôi khỏi dòng của nó.
  useLayoutEffect(() => {
    if (!dangSua) return;
    const doLai = () => setKhung(oRef.current?.getBoundingClientRect() ?? null);
    doLai();
    window.addEventListener("scroll", doLai, true);
    window.addEventListener("resize", doLai);
    return () => {
      window.removeEventListener("scroll", doLai, true);
      window.removeEventListener("resize", doLai);
    };
  }, [dangSua, nhap]);

  // Giữ mục đang chọn trong tầm nhìn khi lướt bằng phím mũi tên.
  useEffect(() => {
    if (chiSo < 0) return;
    dsRef.current?.querySelectorAll('[role="option"]')[chiSo]?.scrollIntoView({ block: "nearest" });
  }, [chiSo]);

  function dong() {
    setNhap(null);
    setDaGo(false);
    setChiSo(-1);
  }

  function gui(chon: { ten: string } | { congTacId: string }) {
    start(async () => {
      const res = await luu(chon);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function chonCongTac(c: CongTacChon) {
    // Rời ô ngay sau đây sẽ gọi `roiO` với tên đang gõ dở — đánh dấu huỷ để nó không
    // lưu đè một cái tên lên công tác vừa chọn.
    huy.current = true;
    oRef.current?.blur();
    if (c.congTacId === congTacId) return;
    gui({ congTacId: c.congTacId });
  }

  function roiO() {
    if (huy.current) {
      huy.current = false;
      dong();
      return;
    }
    const moi = (nhap ?? "").trim();
    dong();
    if (!moi || moi === ten) return;
    gui({ ten: moi });
  }

  function phim(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (ketQua.length === 0) return;
      const buoc = e.key === "ArrowDown" ? 1 : -1;
      setChiSo((i) => (i + buoc + ketQua.length) % ketQua.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const c = chiSo >= 0 ? ketQua[chiSo] : undefined;
      if (c) chonCongTac(c);
      else e.currentTarget.blur();
      return;
    }
    if (e.key === "Escape") {
      huy.current = true;
      e.currentTarget.blur();
    }
  }

  return (
    <>
      <textarea
        ref={oRef}
        rows={1}
        aria-label={`Nội dung công việc — ${ten}`}
        role="combobox"
        aria-expanded={dangSua && ketQua.length > 0}
        aria-controls={idDs}
        aria-autocomplete="list"
        title="Gõ để đổi tên, hoặc chọn công tác khác trong thư viện"
        value={nhap ?? ten}
        disabled={dangLuu}
        // KHÔNG bôi đen cả tên khi bấm vào: người bấm để sửa vài chữ mà gõ đè mất cả tên
        // đầy đủ kèm TSKT là mất công gõ lại. Danh sách thư viện đã hiện đủ để chọn bằng
        // chuột; muốn tìm thì xoá tên rồi gõ.
        onFocus={() => setNhap(ten)}
        onChange={(e) => {
          setNhap(e.target.value.replace(/\n/g, " "));
          setDaGo(true);
          setChiSo(-1);
        }}
        onKeyDown={phim}
        onBlur={roiO}
        className="field-sizing-content block w-full resize-none rounded border border-transparent bg-transparent px-1.5 py-0.5 text-slate-900 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-50"
      />
      {dangSua &&
        khung &&
        createPortal(
          <ul
            ref={dsRef}
            id={idDs}
            role="listbox"
            style={{
              position: "fixed",
              top: khung.bottom + 2,
              left: khung.left,
              width: Math.max(khung.width, 480),
            }}
            className="z-50 max-h-80 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
          >
            {!daGo && (
              <li role="presentation" className="px-3 pb-1 text-xs text-slate-400">
                Chọn công tác khác trong thư viện — hoặc xoá tên rồi gõ để tìm.
              </li>
            )}
            {ketQua.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">
                Không có công tác nào khớp — Enter để lưu tên vừa gõ.
              </li>
            ) : (
              ketQua.map((c, i) => (
                <li
                  key={c.congTacId}
                  role="option"
                  aria-selected={i === chiSo}
                  // mousedown chứ không phải click: click đến SAU blur, mà blur đã đóng
                  // danh sách và lưu tên đang gõ mất rồi.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    chonCongTac(c);
                  }}
                  onMouseEnter={() => setChiSo(i)}
                  className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${
                    i === chiSo ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="w-14 shrink-0 font-mono text-xs text-slate-500">{c.code}</span>
                  <span className="min-w-0 flex-1 text-slate-800">
                    {c.name}
                    {c.congTacId === congTacId && (
                      <Check className="ml-1 inline h-3.5 w-3.5 text-blue-600" aria-label="đang dùng" />
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{c.unit ?? ""}</span>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">
                    {c.baseCost != null ? formatNumber(c.baseCost) : "—"}
                  </span>
                </li>
              ))
            )}
          </ul>,
          document.body
        )}
    </>
  );
}
