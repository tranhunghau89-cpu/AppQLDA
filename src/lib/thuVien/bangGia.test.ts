import { describe, expect, it } from "vitest";
import { soSanhBangGia, type DongBangGia, type GiaDangApDung } from "./bangGia";

const dong = (p: Partial<DongBangGia> & { ma: string }): DongBangGia => ({
  vatTu: null,
  nhanCongMay: null,
  heSo: null,
  donGia: null,
  ...p,
});
const gia = (donGia: number, p: Partial<GiaDangApDung> = {}): GiaDangApDung => ({
  vatTu: null,
  nhanCongMay: null,
  heSo: null,
  donGia,
  ...p,
});

describe("soSanhBangGia", () => {
  const hienTai = new Map<string, GiaDangApDung | null>([
    ["AA.110", gia(19008)],
    ["AA.120", gia(20600, { vatTu: 15000, nhanCongMay: 5000, heSo: 1.03 })],
    ["AB.110", null],
  ]);

  it("bỏ qua dòng không đổi, kể cả sai số làm tròn của Excel", () => {
    const kq = soSanhBangGia(
      [
        dong({ ma: "AA.110", donGia: 19007.9999 }),
        dong({ ma: "AA.120", vatTu: 15000, nhanCongMay: 5000, heSo: 1.03, donGia: 20600 }),
      ],
      hienTai
    );
    expect(kq.thayDoi).toEqual([]);
    expect(kq.khongDoi).toBe(2);
  });

  it("nhận dòng đổi giá và mã chưa từng có giá", () => {
    const kq = soSanhBangGia(
      [dong({ ma: "AA.110", donGia: 20000 }), dong({ ma: "AB.110", donGia: 215000 })],
      hienTai
    );
    expect(kq.thayDoi.map((t) => [t.ma, t.moi.donGia])).toEqual([
      ["AA.110", 20000],
      ["AB.110", 215000],
    ]);
    expect(kq.thayDoi[1].cu).toBeNull();
  });

  it("đơn giá trống thì tính từ (VT + NC) × HS", () => {
    const kq = soSanhBangGia(
      [dong({ ma: "AA.120", vatTu: 16000, nhanCongMay: 5000, heSo: 1 })],
      hienTai
    );
    expect(kq.thayDoi[0].moi.donGia).toBe(21000);
  });

  it("dòng trống bỏ qua; mã lạ và mã trùng báo lỗi", () => {
    const kq = soSanhBangGia(
      [
        dong({ ma: "AA.110" }),
        dong({ ma: "ZZ.999", donGia: 1 }),
        dong({ ma: "AB.110", donGia: 1 }),
        dong({ ma: "AB.110", donGia: 2 }),
      ],
      hienTai
    );
    expect(kq.thayDoi.map((t) => t.moi.donGia)).toEqual([1]);
    expect(kq.loi).toHaveLength(2);
  });
});
