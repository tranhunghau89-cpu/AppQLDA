import { describe, expect, it } from "vitest";
import { lechVoiBangCauThanh, quyDoiRaKg, type DongCauThanh } from "./quyDoiKg";

function dong(p: Partial<DongCauThanh> = {}): DongCauThanh {
  return {
    congTacId: "ct1",
    ma: "AC.130",
    ten: "Bulong liên kết M16x50",
    khoiLuongDonVi: 0.13,
    soLuong: 200,
    donGia: 7370,
    ...p,
  };
}

describe("quyDoiRaKg", () => {
  it("cộng ba cỡ bulong ra đơn giá mỗi kg", () => {
    const kq = quyDoiRaKg([
      dong({ ma: "AC.130", khoiLuongDonVi: 0.13, soLuong: 200, donGia: 7370 }),
      dong({ congTacId: "ct2", ma: "AC.140", khoiLuongDonVi: 0.24, soLuong: 120, donGia: 12440 }),
      dong({ congTacId: "ct3", ma: "AC.160", khoiLuongDonVi: 0.42, soLuong: 60, donGia: 21175 }),
    ]);

    expect(kq.soDongTinh).toBe(3);
    expect(kq.tongSoLuong).toBe(380);
    expect(kq.tongKhoiLuong).toBeCloseTo(26 + 28.8 + 25.2, 6);
    expect(kq.tongTien).toBeCloseTo(1474000 + 1492800 + 1270500, 6);
    expect(kq.donGiaMotKg).toBeCloseTo(4237300 / 80, 6);
    expect(kq.canhBao).toEqual([]);
  });

  it("một cỡ duy nhất ra đúng giá mỗi bộ chia trọng lượng mỗi bộ", () => {
    const kq = quyDoiRaKg([dong({ khoiLuongDonVi: 0.13, soLuong: 1, donGia: 7370 })]);
    expect(kq.donGiaMotKg).toBeCloseTo(7370 / 0.13, 6);
  });

  it("chỉ tỉ lệ giữa các cỡ mới đổi kết quả, không phải số tuyệt đối", () => {
    const it1 = quyDoiRaKg([
      dong({ khoiLuongDonVi: 0.13, soLuong: 200, donGia: 7370 }),
      dong({ congTacId: "ct2", ma: "AC.140", khoiLuongDonVi: 0.24, soLuong: 120, donGia: 12440 }),
    ]);
    const nhieu = quyDoiRaKg([
      dong({ khoiLuongDonVi: 0.13, soLuong: 2000, donGia: 7370 }),
      dong({ congTacId: "ct2", ma: "AC.140", khoiLuongDonVi: 0.24, soLuong: 1200, donGia: 12440 }),
    ]);
    expect(nhieu.donGiaMotKg).toBeCloseTo(it1.donGiaMotKg!, 9);
  });

  describe("dòng thiếu dữ liệu", () => {
    it("bỏ qua dòng chưa khai trọng lượng nhưng vẫn tính các dòng còn lại", () => {
      const kq = quyDoiRaKg([
        dong({ khoiLuongDonVi: 0.13, soLuong: 200, donGia: 7370 }),
        dong({ congTacId: "ct2", ma: "AC.140", khoiLuongDonVi: null }),
      ]);
      expect(kq.soDongTinh).toBe(1);
      expect(kq.donGiaMotKg).toBeCloseTo(7370 / 0.13, 6);
      expect(kq.canhBao).toHaveLength(1);
      expect(kq.canhBao[0]).toContain("AC.140");
      expect(kq.canhBao[0]).toContain("trọng lượng một đơn vị");
    });

    it("bỏ qua dòng chưa khai số lượng", () => {
      const kq = quyDoiRaKg([dong({ soLuong: null })]);
      expect(kq.soDongTinh).toBe(0);
      expect(kq.donGiaMotKg).toBeNull();
      expect(kq.canhBao[0]).toContain("số lượng");
    });

    it("nêu cả hai thứ thiếu trong một cảnh báo", () => {
      const kq = quyDoiRaKg([dong({ khoiLuongDonVi: null, soLuong: null })]);
      expect(kq.canhBao).toHaveLength(1);
      expect(kq.canhBao[0]).toContain("trọng lượng một đơn vị");
      expect(kq.canhBao[0]).toContain("số lượng");
    });

    it("công tác chưa có giá vẫn góp khối lượng, kèm cảnh báo", () => {
      const kq = quyDoiRaKg([
        dong({ khoiLuongDonVi: 0.13, soLuong: 100, donGia: 7370 }),
        dong({ congTacId: "ct2", ma: "AC.140", khoiLuongDonVi: 0.24, soLuong: 100, donGia: null }),
      ]);
      expect(kq.soDongTinh).toBe(2);
      expect(kq.tongKhoiLuong).toBeCloseTo(13 + 24, 6);
      expect(kq.tongTien).toBeCloseTo(737000, 6);
      expect(kq.donGiaMotKg).toBeCloseTo(737000 / 37, 6);
      expect(kq.canhBao[0]).toContain("chưa có đơn giá");
    });
  });

  describe("số rác không được lọt ra ngoài", () => {
    it("bảng rỗng trả null chứ không NaN", () => {
      const kq = quyDoiRaKg([]);
      expect(kq.donGiaMotKg).toBeNull();
      expect(kq.tongKhoiLuong).toBe(0);
      expect(kq.canhBao).toEqual([]);
    });

    it("số lượng 0 và số âm đều bị loại", () => {
      for (const sl of [0, -5]) {
        const kq = quyDoiRaKg([dong({ soLuong: sl })]);
        expect(kq.soDongTinh).toBe(0);
        expect(kq.donGiaMotKg).toBeNull();
      }
    });

    it("trọng lượng 0 bị loại — nếu không thì chia cho 0", () => {
      const kq = quyDoiRaKg([dong({ khoiLuongDonVi: 0 })]);
      expect(kq.donGiaMotKg).toBeNull();
      expect(Number.isNaN(kq.donGiaMotKg as unknown as number)).toBe(false);
    });

    it("NaN và Infinity bị loại chứ không lan ra tổng", () => {
      const kq = quyDoiRaKg([
        dong({ khoiLuongDonVi: 0.13, soLuong: 100, donGia: 7370 }),
        dong({ congTacId: "ct2", ma: "AC.140", soLuong: Number.NaN }),
        dong({ congTacId: "ct3", ma: "AC.160", khoiLuongDonVi: Number.POSITIVE_INFINITY }),
        dong({ congTacId: "ct4", ma: "AC.170", donGia: Number.NaN }),
      ]);
      expect(kq.soDongTinh).toBe(1);
      expect(Number.isFinite(kq.tongKhoiLuong)).toBe(true);
      expect(Number.isFinite(kq.tongTien)).toBe(true);
      expect(kq.donGiaMotKg).toBeCloseTo(7370 / 0.13, 6);
    });
  });
});

describe("lechVoiBangCauThanh", () => {
  const kq = quyDoiRaKg([dong({ khoiLuongDonVi: 0.1, soLuong: 10, donGia: 5000 })]); // 50.000 đ/kg

  it("khớp thì không báo lệch", () => {
    expect(lechVoiBangCauThanh(50000, kq)).toBe(false);
  });

  it("chênh dưới một đồng chỉ là sai số dấu phẩy động", () => {
    expect(lechVoiBangCauThanh(50000.4, kq)).toBe(false);
  });

  it("chênh từ một đồng trở lên là lệch thật", () => {
    expect(lechVoiBangCauThanh(49999, kq)).toBe(true);
  });

  it("dòng chưa có đơn giá mà bảng đã tính ra thì coi là lệch", () => {
    expect(lechVoiBangCauThanh(null, kq)).toBe(true);
  });

  it("bảng chưa tính ra được thì không báo lệch — không có gì để so", () => {
    expect(lechVoiBangCauThanh(50000, quyDoiRaKg([]))).toBe(false);
    expect(lechVoiBangCauThanh(null, quyDoiRaKg([]))).toBe(false);
  });
});
