// Khuôn JSON mà AI phải trả về khi đọc một file hợp đồng (plan/34 mục 2).
//
// Một schema dùng cho ba việc: ép đầu ra của Claude (structured output), validate lại
// khi lưu bản nháp, và test. Giữ schema ĐƠN GIẢN (không min/max/regex): structured
// output chỉ hỗ trợ một phần JSON Schema, ràng buộc nghiệp vụ nằm ở kiemTra.ts.
import { z } from "zod";

export const TIN_CAY = ["cao", "trung_binh", "thap"] as const;
export type TinCay = (typeof TIN_CAY)[number];

/**
 * Một trường đọc được kèm bằng chứng. Không dùng tính năng citations của API vì nó
 * không chạy chung với structured output — nên AI tự chép câu nguyên văn và số trang.
 */
function truong<T extends z.ZodType>(t: T) {
  return z.object({
    /** null = không tìm thấy trong file. AI không được đoán. */
    giaTri: t.nullable(),
    trichDan: z.string().nullable(),
    trang: z.number().nullable(),
    tinCay: z.enum(TIN_CAY),
  });
}

export const HopDongAi = z.object({
  soHopDong: truong(z.string()),
  /** YYYY-MM-DD */
  ngayKy: truong(z.string()),
  /** YYYY-MM-DD */
  ngayHieuLuc: truong(z.string()),
  thoiHanNgay: truong(z.number()),
  trichYeu: truong(z.string()),
  benA: z.object({
    ten: truong(z.string()),
    diaChi: truong(z.string()),
    mst: truong(z.string()),
    daiDien: truong(z.string()),
    chucVu: truong(z.string()),
  }),
  /** Để kiểm Bên B có đúng là công ty mình không (HĐ thầu phụ thì bị đảo bên). */
  tenBenB: truong(z.string()),
  giaTriTruocVat: truong(z.number()),
  vatPhanTram: truong(z.number()),
  giaTriSauVat: truong(z.number()),
  /** Nguyên văn dòng "Bằng chữ: ..." — đối chiếu với docTienVietNam. */
  giaTriBangChu: truong(z.string()),
  hangMuc: z.array(
    z.object({
      ten: z.string(),
      donVi: z.string().nullable(),
      khoiLuong: z.number().nullable(),
      donGia: z.number().nullable(),
      thanhTien: z.number().nullable(),
      trang: z.number().nullable(),
    })
  ),
  dotThanhToan: z.array(
    z.object({
      ten: z.string(),
      phanTram: z.number().nullable(),
      soTien: z.number().nullable(),
      /** "trong 7 ngày sau khi lắp dựng xong khung" */
      dieuKien: z.string().nullable(),
      trichDan: z.string().nullable(),
    })
  ),
  /** Nguyên văn điều khoản thanh toán — đổ vào Contract.paymentTerms. */
  dieuKhoanThanhToan: z.string().nullable(),
  /** Điều AI thấy bất thường, ghi cho người duyệt đọc. */
  ghiChuAi: z.string().nullable(),
});
export type HopDongAi = z.infer<typeof HopDongAi>;
export type TruongAi<T> = { giaTri: T | null; trichDan: string | null; trang: number | null; tinCay: TinCay };
