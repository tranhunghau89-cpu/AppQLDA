"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { demOTrong } from "@/lib/clientQuoteInfo";
import { formatDate } from "@/lib/utils";
import { luuThongTinIn } from "./actions";
import type { ClientQuoteView } from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

/** Chín ô in ra, đúng thứ tự chúng xuất hiện trên giấy. */
const O = [
  { ten: "recipient", nhan: "Kính gửi", goiY: "Công ty CP ABC" },
  { ten: "customerPhone", nhan: "SĐT khách", goiY: "0901234567" },
  { ten: "location", nhan: "Địa điểm", goiY: "Hà Nội" },
  { ten: "scope", nhan: "Hạng mục", goiY: "Kết cấu thép và bao che" },
  { ten: "quoteDate", nhan: "Ngày báo giá", goiY: "", kieu: "date" },
  { ten: "salesName", nhan: "Người phụ trách", goiY: "Họ và tên" },
  { ten: "salesPhone", nhan: "SĐT phụ trách", goiY: "0901234567" },
  { ten: "salesEmail", nhan: "Email phụ trách", goiY: "ten@congty.com", kieu: "email" },
  { ten: "validDays", nhan: "Hiệu lực (ngày)", goiY: "7", kieu: "number" },
] as const;

type Ten = (typeof O)[number]["ten"];
type Gia = Record<Ten, string>;

function giaBanDau(q: ClientQuoteView): Gia {
  return {
    recipient: q.recipient ?? "",
    customerPhone: q.customerPhone ?? "",
    location: q.location ?? "",
    scope: q.scope ?? "",
    // <input type="date"> chỉ nhận YYYY-MM-DD, không nhận chuỗi ISO đầy đủ.
    quoteDate: q.quoteDate ? q.quoteDate.slice(0, 10) : "",
    salesName: q.salesName ?? "",
    salesPhone: q.salesPhone ?? "",
    salesEmail: q.salesEmail ?? "",
    validDays: q.validDays != null ? String(q.validDays) : "",
  };
}

/**
 * Dải thông tin in ra, đặt ngay đầu mỗi bản báo giá và **gõ thẳng tại chỗ**.
 *
 * Trước đây chín ô này chỉ mở được trong hộp thoại, nên bản in thiếu SĐT người phụ
 * trách thì không có gì trên màn hình nói ra. Giờ chúng nằm sẵn thành bảng: nhìn là
 * thấy chỗ trống, bấm vào là gõ được, rời ô là lưu.
 *
 * Lưu tại chỗ cố ý KHÔNG gọi `router.refresh()`: làm vậy sẽ dựng lại dải ngay giữa
 * lúc người dùng đang tab sang ô kế tiếp và con trỏ bị văng ra. Chín ô này không hiển
 * thị ở chỗ nào khác trong thẻ, nên không có gì phải nạp lại.
 */
export function ThongTinIn({
  q,
  chu,
  canEdit,
  onEdit,
}: {
  q: ClientQuoteView;
  chu: ChuBaoGia;
  canEdit: boolean;
  /** Mở hộp thoại đầy đủ cho những mục không nằm trên dải: VAT, tải trọng, đoạn chữ. */
  onEdit: () => void;
}) {
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  // Chỉ giữ những ô người dùng ĐÃ GÕ, còn lại luôn đọc từ máy chủ.
  //
  // Không sao chép cả chín ô vào state, cũng không dựng lại dải bằng `key`: mỗi lần
  // lưu tại chỗ, server action tự làm mới cây trang, nên dải sẽ bị dựng lại ngay giữa
  // lúc người dùng vừa tab sang ô kế tiếp — và con trỏ văng ra ngoài.
  const [nhap, setNhap] = useState<Partial<Gia>>({});
  const goc = giaBanDau(q);
  const gia: Gia = { ...goc, ...nhap };
  const daLuu = useRef<Gia | null>(null);
  const [xong, setXong] = useState(false);

  const thieu = demOTrong(O.map((o) => gia[o.ten]));

  function roiO() {
    if (!canEdit) return;
    const truoc = daLuu.current ?? goc;
    if (O.every((o) => gia[o.ten] === truoc[o.ten])) return;

    const gui = { ...gia };
    daLuu.current = gui;
    setXong(false);
    start(async () => {
      const form = new FormData();
      for (const o of O) form.set(o.ten, gui[o.ten]);
      const res = await luuThongTinIn(chu, q.id, form);
      if (!res.ok) {
        // Trả mốc về giá trị cũ để lần rời ô sau còn thử lưu lại.
        daLuu.current = truoc;
        toast.error(res.error);
        return;
      }
      setXong(true);
    });
  }

  const hetHan = q.expiryDate ? formatDate(q.expiryDate) : null;

  return (
    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Thông tin in trên bản báo giá
        </span>
        {thieu > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            còn {thieu} ô chưa điền
          </span>
        ) : (
          <span className="text-xs text-slate-400">đã điền đủ</span>
        )}

        {dangLuu && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Đang lưu…
          </span>
        )}
        {!dangLuu && xong && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" aria-hidden="true" /> Đã lưu
          </span>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Mục khác…
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        {O.map((o) => {
          const trong = !gia[o.ten].trim();
          return (
            <label key={o.ten} className="min-w-0">
              <span
                className={
                  "block truncate text-[11px] uppercase tracking-wide " +
                  (trong ? "text-amber-600" : "text-slate-400")
                }
              >
                {o.nhan}
              </span>
              {canEdit ? (
                <input
                  name={o.ten}
                  type={"kieu" in o ? o.kieu : "text"}
                  value={gia[o.ten]}
                  placeholder={o.goiY || "chưa điền"}
                  onChange={(e) => setNhap((p) => ({ ...p, [o.ten]: e.target.value }))}
                  onBlur={roiO}
                  className={
                    "w-full rounded-md border bg-white/60 px-1.5 py-1 text-sm text-slate-900 " +
                    "placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none " +
                    (trong ? "border-amber-200" : "border-slate-200")
                  }
                />
              ) : (
                <span className="block truncate py-1 text-sm text-slate-800">
                  {gia[o.ten].trim() || <span className="text-amber-600">chưa điền</span>}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {hetHan && (
        <p className="mt-1.5 text-xs text-slate-400">Hết hiệu lực ngày {hetHan}.</p>
      )}
    </div>
  );
}
