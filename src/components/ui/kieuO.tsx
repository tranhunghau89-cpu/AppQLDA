// Các kiểu ô dùng chung để người lập báo giá / dự toán / hợp đồng nhìn là biết:
//
//   · PHẢI ĐIỀN   — đỏ đậm: ô bắt buộc còn trống.
//   · ĐIỀN TAY    — đỏ nhạt: ô phải điền tay, ĐÃ điền. Giữ tông đỏ để vẫn nhận ra đây là
//                   số người lập tự gõ (khối lượng…), không phải số mặc định.
//   · CÓ SẴN      — xanh dương: giá trị mặc định (đơn giá mẫu, lời chào…), sửa được.
//   · CỐ ĐỊNH     — xám: tự tính hoặc không sửa ở đây.
//
// Ô gõ SAI (số không đọc được) đỏ đậm nhất và có vòng viền — khác "còn trống".
//
// Chỉ chứa MÀU (nền, viền, chữ). Kích thước, bo góc, focus do chỗ dùng tự đặt — trộn
// hai bộ màu cho cùng một thuộc tính thì Tailwind không bảo đảm bên nào thắng.

export const O_PHAI_DIEN =
  "border-red-500 bg-red-100 text-red-900 placeholder:text-red-400";
export const O_DIEN_TAY =
  "border-red-300 bg-red-50 text-slate-900 hover:border-red-400 placeholder:text-slate-400";
export const O_CO_SAN =
  "border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-400 placeholder:text-slate-400";
export const O_CO_DINH = "border-slate-200 bg-slate-100 text-slate-500";
export const O_LOI =
  "border-red-600 bg-red-100 text-red-800 ring-1 ring-red-500";

/**
 * Màu cho một ô nhập có giá trị biết trước (ô điều khiển bằng state).
 *
 * @param batBuoc  trống thì tô "phải điền"
 * @param thuCong  ô người lập tự gõ (mặc định = batBuoc): đã điền vẫn giữ tông đỏ nhạt;
 *                 `false` cho ô bắt buộc nhưng thường có sẵn giá trị mặc định (đơn giá
 *                 mẫu) — đã có số thì xanh.
 */
export function mauO(
  giaTri: string,
  batBuoc: boolean,
  loi = false,
  thuCong = batBuoc,
): string {
  if (loi) return O_LOI;
  if (batBuoc && !giaTri.trim()) return O_PHAI_DIEN;
  return thuCong ? O_DIEN_TAY : O_CO_SAN;
}

/**
 * Màu cho ô KHÔNG điều khiển (defaultValue trong form): dùng `placeholder-shown` để tự
 * đổi khi người dùng gõ. Ô phải mang `placeholder` khác rỗng (vd " ") thì mới chạy.
 */
export function mauOTuDo(batBuoc: boolean): string {
  return batBuoc
    ? `${O_DIEN_TAY} placeholder-shown:border-red-500 placeholder-shown:bg-red-100`
    : O_CO_SAN;
}

function Mau({ cls, nhan }: { cls: string; nhan: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-5 rounded border ${cls}`} />
      {nhan}
    </span>
  );
}

/** Dải chú thích màu — đặt ở đầu những màn hình nhiều ô. */
export function ChuThichO({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 ${className}`}
    >
      <Mau cls="border-red-500 bg-red-100" nhan="Phải điền" />
      <Mau cls="border-red-300 bg-red-50" nhan="Đã điền tay" />
      <Mau cls="border-blue-300 bg-blue-50" nhan="Có sẵn — sửa được" />
      <Mau cls="border-slate-300 bg-slate-100" nhan="Cố định / tự tính" />
    </div>
  );
}
