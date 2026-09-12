/**
 * Quy đổi một dòng bán theo BỘ/CÁI sang đơn giá theo KG.
 *
 * VÌ SAO CẦN: bộ hạng mục tính bulong, ty xà gồ, ecu theo **kg** — đó là cách bóc khối
 * lượng từ bản vẽ kết cấu. Thư viện lại bán theo **bộ/cái** vì đó là cách mua hàng. Hai
 * đơn vị khác THỨ NGUYÊN, không có hệ số chung: gắn thẳng một mã tính theo bộ vào một
 * dòng tính theo kg là lấy giá mỗi bộ làm giá mỗi kg, sai hàng chục lần.
 *
 * Cầu nối là TRỌNG LƯỢNG MỘT ĐƠN VỊ. Có nó thì một dòng kg diễn giải được thành mấy cỡ
 * bulong, mỗi cỡ mấy bộ — cộng ra tổng kg và tổng tiền, chia ra đơn giá mỗi kg.
 *
 * Cố ý tính TRỘN cả nhóm chứ không chọn một cỡ đại diện: một nhà xưởng dùng M16 ở xà
 * gồ, M20 ở kèo, M24 ở chân cột. Đơn giá mỗi kg của ba cỡ đó lệch nhau tới 10% vì đầu
 * bulong không tỉ lệ với thân. Lấy một cỡ làm đại diện là sai lệch có hệ thống, còn
 * trộn theo số lượng thực tế thì sai số chỉ nằm ở tỉ lệ trộn.
 */

/** Một cỡ trong bảng cấu thành. Giá và trọng lượng lấy từ thư viện, số lượng người khai. */
export interface DongCauThanh {
  congTacId: string;
  ma: string;
  ten: string;
  /** Trọng lượng một bộ/cái, kg. Thuộc về công tác nên dùng chung mọi bộ hạng mục. */
  khoiLuongDonVi: number | null;
  /** Số bộ/cái cho một công trình mẫu. Chỉ tỉ lệ giữa các cỡ mới quan trọng. */
  soLuong: number | null;
  /** Đơn giá mỗi bộ/cái, từ thư viện. */
  donGia: number | null;
}

export interface KetQuaQuyDoi {
  /** Số cỡ thực sự vào được phép tính. */
  soDongTinh: number;
  tongSoLuong: number;
  tongKhoiLuong: number;
  tongTien: number;
  /** Đơn giá mỗi kg. `null` khi chưa đủ dữ liệu — KHÔNG bao giờ NaN hay Infinity. */
  donGiaMotKg: number | null;
  canhBao: string[];
}

/** Số dùng được để nhân chia: hữu hạn và dương. Rỗng, 0 và âm đều không. */
function duong(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Cộng bảng cấu thành lại thành một đơn giá mỗi kg.
 *
 * Dòng thiếu dữ liệu bị BỎ QUA kèm cảnh báo chứ không làm hỏng cả phép tính: người khai
 * thường thêm một cỡ rồi mới đi tra trọng lượng của nó, và trong lúc đó con số của các
 * cỡ đã khai xong vẫn phải đúng.
 */
export function quyDoiRaKg(dong: readonly DongCauThanh[]): KetQuaQuyDoi {
  const canhBao: string[] = [];
  let soDongTinh = 0;
  let tongSoLuong = 0;
  let tongKhoiLuong = 0;
  let tongTien = 0;

  for (const d of dong) {
    const thieu: string[] = [];
    if (!duong(d.khoiLuongDonVi)) thieu.push("trọng lượng một đơn vị");
    if (!duong(d.soLuong)) thieu.push("số lượng");
    // Giá 0 là hợp lệ (công tác chưa khai giá vẫn góp khối lượng), chỉ chặn số rác.
    if (d.donGia != null && !Number.isFinite(d.donGia)) thieu.push("đơn giá");

    if (thieu.length > 0) {
      canhBao.push(`${d.ma} — ${d.ten}: thiếu ${thieu.join(", ")}.`);
      continue;
    }
    if (d.donGia == null) {
      canhBao.push(`${d.ma} — ${d.ten}: thư viện chưa có đơn giá, chỉ tính khối lượng.`);
    }

    soDongTinh++;
    tongSoLuong += d.soLuong!;
    tongKhoiLuong += d.khoiLuongDonVi! * d.soLuong!;
    tongTien += (d.donGia ?? 0) * d.soLuong!;
  }

  const donGiaMotKg = tongKhoiLuong > 0 ? tongTien / tongKhoiLuong : null;
  if (soDongTinh > 0 && donGiaMotKg === null) {
    canhBao.push("Tổng khối lượng bằng 0 nên chưa ra được đơn giá mỗi kg.");
  }

  return { soDongTinh, tongSoLuong, tongKhoiLuong, tongTien, donGiaMotKg, canhBao };
}

/** Ngưỡng coi là "đã lệch": dưới 1 đồng thì chỉ là sai số dấu phẩy động. */
const SAI_SO = 1;

/**
 * Đơn giá đang lưu trên dòng có còn khớp với bảng cấu thành không.
 *
 * `donGiaMacDinh` là ảnh CHỤP lúc bấm lưu, giống mọi chỗ đóng băng giá khác trong app.
 * Thư viện lên giá bulong sau đó thì ảnh chụp cũ đi mà không ai được báo — nên màn hình
 * phải tự so lại mỗi lần mở.
 */
export function lechVoiBangCauThanh(
  donGiaDangLuu: number | null | undefined,
  kq: KetQuaQuyDoi
): boolean {
  if (kq.donGiaMotKg == null) return false;
  if (donGiaDangLuu == null) return true;
  return Math.abs(donGiaDangLuu - kq.donGiaMotKg) >= SAI_SO;
}
