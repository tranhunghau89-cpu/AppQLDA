import { describe, expect, it } from "vitest";
import { chuanHoaNgay, ghepThongTinBenA, sangBanNhap } from "./chuanHoa";
import { HopDongAi } from "./khuon";

const f = <T>(giaTri: T | null, tinCay: "cao" | "trung_binh" | "thap" = "cao", trang: number | null = 1) => ({
  giaTri,
  trichDan: giaTri == null ? null : `… ${String(giaTri)} …`,
  trang: giaTri == null ? null : trang,
  tinCay,
});

function mau(): HopDongAi {
  return {
    soHopDong: f("0704/2026/HĐMB"),
    ngayKy: f("07/04/2026"),
    ngayHieuLuc: f("2026-04-10"),
    thoiHanNgay: f(90),
    trichYeu: f("Cung cấp và thi công nhà thép K25L60"),
    benA: {
      ten: f("Công ty TNHH ABC"),
      diaChi: f("KCN Hồng Ngự, Đồng Tháp"),
      mst: f("1400123456"),
      daiDien: f("Ông Nguyễn Văn A"),
      chucVu: f("Giám đốc"),
    },
    tenBenB: f("Công ty CP Xây dựng Dubai"),
    giaTriTruocVat: f(2_000_000_000),
    vatPhanTram: f(8),
    giaTriSauVat: f(2_160_000_000),
    giaTriBangChu: f("Hai tỷ một trăm sáu mươi triệu đồng"),
    hangMuc: [
      { ten: " Khung thép ", donVi: "kg", khoiLuong: 50_000, donGia: 30_000, thanhTien: 1_500_000_000, trang: 3 },
      { ten: "Tôn mái", donVi: "m2", khoiLuong: 1_000, donGia: 500_000, thanhTien: 500_000_000, trang: 3 },
    ],
    dotThanhToan: [
      { ten: "Tạm ứng", phanTram: 30, soTien: null, dieuKien: "sau khi ký", trichDan: null },
      { ten: "Đợt 2", phanTram: 70, soTien: null, dieuKien: null, trichDan: null },
    ],
    dieuKhoanThanhToan: "Thanh toán 2 đợt…",
    ghiChuAi: null,
  };
}

describe("chuanHoaNgay", () => {
  it("nhận các kiểu viết ngày thường gặp, ra YYYY-MM-DD", () => {
    expect(chuanHoaNgay("2026-04-07")).toBe("2026-04-07");
    expect(chuanHoaNgay("07/04/2026")).toBe("2026-04-07");
    expect(chuanHoaNgay("7-4-2026")).toBe("2026-04-07");
    expect(chuanHoaNgay(" 07.04.2026 ")).toBe("2026-04-07");
  });

  it("luôn hiểu là ngày/tháng, không đoán kiểu Mỹ", () => {
    expect(chuanHoaNgay("04/07/2026")).toBe("2026-07-04");
  });

  it("ngày không có thật hoặc không phải ngày → null", () => {
    expect(chuanHoaNgay("31/02/2026")).toBeNull();
    expect(chuanHoaNgay("13/13/2026")).toBeNull();
    expect(chuanHoaNgay("tháng 4/2026")).toBeNull();
    expect(chuanHoaNgay("")).toBeNull();
    expect(chuanHoaNgay(null)).toBeNull();
  });
});

describe("ghepThongTinBenA", () => {
  it("mỗi thông tin một dòng, bỏ dòng trống", () => {
    const b = mau().benA;
    expect(ghepThongTinBenA(b)).toBe(
      "Địa chỉ: KCN Hồng Ngự, Đồng Tháp\nMST: 1400123456\nĐại diện: Ông Nguyễn Văn A – Giám đốc"
    );
    expect(ghepThongTinBenA({ ...b, mst: f(null), chucVu: f(null) })).toBe(
      "Địa chỉ: KCN Hồng Ngự, Đồng Tháp\nĐại diện: Ông Nguyễn Văn A"
    );
  });
});

describe("sangBanNhap", () => {
  it("khuôn mẫu hợp lệ theo schema zod", () => {
    expect(HopDongAi.safeParse(mau()).success).toBe(true);
  });

  it("đổ đúng trường form, chuẩn hoá ngày, có ngày ký thì SIGNED", () => {
    const b = sangBanNhap(mau());
    expect(b.hopDong).toMatchObject({
      contractNo: "0704/2026/HĐMB",
      signDate: "2026-04-07",
      effectiveDate: "2026-04-10",
      durationDays: 90,
      partyAName: "Công ty TNHH ABC",
      status: "SIGNED",
      vatPercent: 8,
    });
    expect(b.hangMuc[0]).toEqual({
      name: "Khung thép", unit: "kg", qty: 50_000, unitPrice: 30_000, amount: 1_500_000_000, trang: 3,
    });
    expect(b.doiChieu.giaTriSauVat).toBe(2_160_000_000);
    expect(b.bangChung.contractNo).toEqual({ trichDan: "… 0704/2026/HĐMB …", trang: 1 });
  });

  it("không có ngày ký thì là báo giá", () => {
    expect(sangBanNhap({ ...mau(), ngayKy: f(null) }).hopDong.status).toBe("QUOTE");
  });

  it("ngày AI trả về sai thì để trống và báo lại", () => {
    const b = sangBanNhap({ ...mau(), ngayKy: f("31/02/2026") });
    expect(b.hopDong.signDate).toBe("");
    expect(b.ngayKhongHopLe).toEqual(["signDate"]);
  });

  it("liệt kê trường AI tự đánh giá tin cậy thấp (bỏ qua trường rỗng)", () => {
    const b = sangBanNhap({ ...mau(), giaTriSauVat: f(2_160_000_000, "thap"), soHopDong: f(null, "thap") });
    expect(b.tinCayThap).toEqual(["giaTriSauVat"]);
  });

  it("HĐ trọn gói không có bảng hạng mục → một dòng khoán bằng giá trị trước VAT", () => {
    const b = sangBanNhap({ ...mau(), hangMuc: [] });
    expect(b.hangMucTuDong).toBe(true);
    expect(b.hangMuc).toHaveLength(1);
    expect(b.hangMuc[0]).toMatchObject({ amount: 2_000_000_000, qty: null, unitPrice: null });
  });

  it("không hạng mục, không giá trị → không tự tạo gì", () => {
    const b = sangBanNhap({ ...mau(), hangMuc: [], giaTriTruocVat: f(null) });
    expect(b.hangMucTuDong).toBe(false);
    expect(b.hangMuc).toEqual([]);
  });
});
