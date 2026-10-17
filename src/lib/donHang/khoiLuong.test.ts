import { describe, expect, it } from "vitest";
import {
  docDuongKinh,
  docQuyCachTon,
  kgMotDonVi,
  kgSauKhiSua,
  tongNhom,
} from "./khoiLuong";

const mon = (o: Partial<Parameters<typeof kgMotDonVi>[0]>) => ({
  name: "",
  unit: null,
  length: null,
  quyCach: null,
  nhom: null,
  ...o,
});

describe("docQuyCachTon", () => {
  it("đọc dày và khổ hữu dụng", () => {
    expect(
      docQuyCachTon("1. Tôn PU dày 0.45mm, 5 Sóng, khổ hữu dụng 1000mm, màu"),
    ).toEqual({ day: 0.45, kho: 1000 });
    expect(
      docQuyCachTon("TÔN ... DÀY 0.4MM, CÁN 09 SÓNG KHỔ HỮU DỤNG 1000MM"),
    ).toEqual({ day: 0.4, kho: 1000 });
  });
  it("thiếu khổ thì null", () => {
    expect(docQuyCachTon("Diềm tôn, dày 0.45mm, dập theo hình")).toBeNull();
  });
});

describe("docDuongKinh", () => {
  it("đọc D16, bỏ D90", () => {
    expect(docDuongKinh("1. Giằng Rod D16, thanh ren suốt")).toBe(16);
    expect(docDuongKinh("Phễu thu D90")).toBeNull();
  });
});

describe("kgMotDonVi", () => {
  it("rod D16 dài 10m ≈ 15,78 kg", () => {
    const k = kgMotDonVi(
      mon({
        name: "SR.01",
        unit: "Cây",
        length: 10000,
        quyCach: "1. Giằng Rod D16",
      }),
      [],
    );
    expect(k?.cach).toBe("THEP_TRON");
    expect(k?.kg).toBeCloseTo(15.783, 2);
  });
  it("cáp D16 dài 8,5m theo bảng STD", () => {
    const k = kgMotDonVi(
      mon({
        name: "BR1.01",
        unit: "sợi",
        length: 8500,
        quyCach: "1. Cáp giằng kèo mái D16",
      }),
      [],
    );
    expect(k).toEqual({ kg: 13.43, cach: "CAP" });
  });
  it("tôn 0,45mm khổ 1000 dài 12,2m", () => {
    const k = kgMotDonVi(
      mon({
        name: "M.1",
        unit: "Tấm",
        length: 12200,
        quyCach: "Tôn PU dày 0.45mm, khổ hữu dụng 1000mm",
      }),
      [],
    );
    expect(k?.kg).toBeCloseTo(12.2 * 0.45 * 7.85, 2);
  });
  it("bulông theo tên, không cần chiều dài", () => {
    expect(
      kgMotDonVi(mon({ name: "M20x70", unit: "bộ" }), [
        { ten: "M20x70", quyCach: null, khoiLuongDonVi: 0.31 },
      ]),
    ).toEqual({
      kg: 0.31,
      cach: "BULONG",
    });
  });
  it("không có chiều dài, không phải bulông → null", () => {
    expect(
      kgMotDonVi(mon({ name: "SR.01", unit: "Cây", quyCach: "Rod D16" }), []),
    ).toBeNull();
  });
});

describe("kgSauKhiSua", () => {
  it("không tính được thì co giãn theo SL", () => {
    expect(
      kgSauKhiSua(
        { qty: 4, weight: 59 },
        { ...mon({ name: "X" }), qty: 8 },
        [],
      ),
    ).toBe(118);
  });
  it("SL không đổi, không tính được → giữ nguyên", () => {
    expect(
      kgSauKhiSua(
        { qty: 4, weight: 59 },
        { ...mon({ name: "X" }), qty: 4 },
        [],
      ),
    ).toBeUndefined();
  });
});

describe("tongNhom", () => {
  it("cộng kg, tổng dài, m² tôn", () => {
    const q = "Tôn dày 0.45mm, khổ hữu dụng 1000mm";
    expect(
      tongNhom([
        { qty: 2, length: 12000, weight: 84.78, quyCach: q },
        { qty: 1, length: 5000, weight: null, quyCach: null },
      ]),
    ).toEqual({ kg: 84.78, dai: 29, m2: 24 });
  });
});
