// Ba kiểu ô dùng chung để người lập báo giá nhìn là biết ô nào phải điền:
//
//   · PHẢI ĐIỀN  — nền vàng nhạt, viền cam: ô bắt buộc còn trống. Điền xong tự thành
//                  kiểu "có sẵn".
//   · CÓ SẴN     — nền trắng, chữ xanh đậm: đã có giá trị (mặc định hoặc đã gõ), sửa
//                  được — rê chuột hiện viền.
//   · CỐ ĐỊNH    — nền xám nhạt, chữ xám: tự tính hoặc không sửa ở đây.
//
// Chỉ chứa MÀU (nền, viền, chữ). Kích thước, bo góc, focus do chỗ dùng tự đặt — trộn
// hai bộ màu cho cùng một thuộc tính thì Tailwind không bảo đảm bên nào thắng.

export const O_PHAI_DIEN =
  "border-amber-400 bg-amber-50 text-slate-900 placeholder:text-amber-500";
export const O_CO_SAN =
  "border-transparent bg-white text-blue-900 hover:border-slate-300 placeholder:text-slate-300";
export const O_CO_DINH = "border-transparent bg-slate-100 text-slate-500";
export const O_LOI = "border-red-400 bg-red-50 text-slate-900";

/** Màu cho một ô nhập: bắt buộc mà trống -> phải điền; còn lại -> có sẵn. */
export function mauO(giaTri: string, batBuoc: boolean, loi = false): string {
  if (loi) return O_LOI;
  return batBuoc && !giaTri.trim() ? O_PHAI_DIEN : O_CO_SAN;
}

function Mau({ cls, nhan }: { cls: string; nhan: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-5 rounded border ${cls}`} />
      {nhan}
    </span>
  );
}

/** Dải chú thích ba màu — đặt ở đầu những màn hình nhiều ô. */
export function ChuThichO({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 ${className}`}
    >
      <Mau cls="border-amber-400 bg-amber-50" nhan="Phải điền" />
      <Mau cls="border-slate-300 bg-white" nhan="Có sẵn — sửa được" />
      <Mau cls="border-slate-200 bg-slate-100" nhan="Cố định / tự tính" />
    </div>
  );
}
