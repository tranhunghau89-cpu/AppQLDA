// Lập báo giá thẳng từ danh sách, không phải đi vòng qua CRM.
//
// Đường dài hiện tại: Khách hàng → mở khách → thêm công trình → mở công trình → lập
// báo giá. Nhân viên kinh doanh đang cầm điện thoại nói chuyện với khách thì năm bước
// là quá nhiều. Hộp thoại này hỏi gọn ba việc và tự dựng những gì còn thiếu.
//
// Phần thuần ở đây chỉ lo ĐỌC và KIỂM lựa chọn; phần ghi vào CSDL nằm ở action.

export type NguonKhach =
  | { loai: "CO_SAN"; id: string }
  | { loai: "MOI"; tenCty: string; nguoiLienHe: string | null; phone: string | null };

export type NguonCoHoi =
  | { loai: "CO_SAN"; id: string }
  | {
      loai: "MOI";
      tenCongTrinh: string;
      diaDiem: string | null;
      buildingType: string | null;
      area: number | null;
    };

export interface YeuCauLapNhanh {
  khach: NguonKhach;
  coHoi: NguonCoHoi;
  title: string;
  templateId: string | null;
}

export type KetQuaDoc =
  | { ok: true; yeuCau: YeuCauLapNhanh }
  | { ok: false; loi: string };

/** Ô form thô, đã qua `String(form.get(...) ?? "")`. */
export interface OForm {
  khachMode: string;
  khachHangId: string;
  khachTen: string;
  khachNguoiLienHe: string;
  khachPhone: string;
  coHoiMode: string;
  coHoiId: string;
  coHoiTen: string;
  coHoiDiaDiem: string;
  coHoiBuildingType: string;
  coHoiArea: string;
  title: string;
  templateId: string;
}

const cat = (s: string) => s.trim();
const hoacNull = (s: string) => cat(s) || null;

/** Số dương, hoặc null khi để trống. Chuỗi bậy trả về `undefined` để nơi gọi báo lỗi. */
function docDienTich(s: string): number | null | undefined {
  const t = cat(s);
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function docYeuCau(o: OForm): KetQuaDoc {
  // --- Khách ---
  let khach: NguonKhach;
  if (o.khachMode === "CO_SAN") {
    const id = cat(o.khachHangId);
    if (!id) return { ok: false, loi: "Hãy chọn khách hàng." };
    khach = { loai: "CO_SAN", id };
  } else if (o.khachMode === "MOI") {
    const tenCty = cat(o.khachTen);
    if (!tenCty) return { ok: false, loi: "Tên khách hàng không được để trống." };
    khach = {
      loai: "MOI",
      tenCty,
      nguoiLienHe: hoacNull(o.khachNguoiLienHe),
      phone: hoacNull(o.khachPhone),
    };
  } else {
    return { ok: false, loi: "Chưa chọn khách hàng có sẵn hay khách mới." };
  }

  // --- Công trình ---
  let coHoi: NguonCoHoi;
  if (o.coHoiMode === "CO_SAN") {
    // Khách vừa dựng thì chưa có công trình nào để chọn. Chặn ở đây cho ra thông báo
    // hiểu được, thay vì để truy vấn sau đó trả "không tìm thấy" khó đoán.
    if (khach.loai === "MOI") {
      return { ok: false, loi: "Khách mới thì chưa có công trình nào — hãy tạo công trình mới." };
    }
    const id = cat(o.coHoiId);
    if (!id) return { ok: false, loi: "Hãy chọn công trình." };
    coHoi = { loai: "CO_SAN", id };
  } else if (o.coHoiMode === "MOI") {
    const tenCongTrinh = cat(o.coHoiTen);
    if (!tenCongTrinh) return { ok: false, loi: "Tên công trình không được để trống." };
    const area = docDienTich(o.coHoiArea);
    if (area === undefined) return { ok: false, loi: "Diện tích phải là số lớn hơn 0." };
    coHoi = {
      loai: "MOI",
      tenCongTrinh,
      diaDiem: hoacNull(o.coHoiDiaDiem),
      buildingType: hoacNull(o.coHoiBuildingType),
      area,
    };
  } else {
    return { ok: false, loi: "Chưa chọn công trình có sẵn hay công trình mới." };
  }

  // --- Tiêu đề ---
  // Để trống thì đặt hộ theo tên công trình. Bớt một ô bắt buộc ở đường đi nhanh; người
  // lập đổi lại lúc nào cũng được.
  const title =
    cat(o.title) || (coHoi.loai === "MOI" ? `Báo giá ${coHoi.tenCongTrinh}` : "");

  return {
    ok: true,
    yeuCau: { khach, coHoi, title, templateId: hoacNull(o.templateId) },
  };
}

/** Tiêu đề cuối cùng khi đã biết tên công trình — dùng cho nhánh chọn công trình có sẵn. */
export function tieuDeCuoi(title: string, tenCongTrinh: string): string {
  return cat(title) || `Báo giá ${cat(tenCongTrinh)}`;
}
