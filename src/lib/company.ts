// Thông tin công ty in trên đầu báo giá / hợp đồng.
//
// Cố ý KHÔNG làm thành bảng trong cơ sở dữ liệu: đây là dữ liệu một dòng, gần như
// không bao giờ đổi, và thêm một model + trang quản trị chỉ để sửa số điện thoại thì
// đắt hơn giá trị nó mang lại. Đặt qua biến môi trường, có sẵn giá trị mặc định.

export interface ThongTinCongTy {
  ten: string;
  diaChi: string;
  dienThoai: string;
  email: string;
  maSoThue: string;
  website: string;
}

export function congTy(): ThongTinCongTy {
  return {
    ten: process.env.COMPANY_NAME || "CÔNG TY CP XÂY DỰNG DUBAI",
    diaChi: process.env.COMPANY_ADDRESS || "",
    dienThoai: process.env.COMPANY_PHONE || "",
    email: process.env.COMPANY_EMAIL || "",
    maSoThue: process.env.COMPANY_TAX_ID || "",
    website: process.env.COMPANY_WEBSITE || "",
  };
}
