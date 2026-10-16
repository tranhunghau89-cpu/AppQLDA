import { describe, expect, it } from "vitest";
import { docQuyCach, goiYKgMotBo, kgMotBo, laDonViDem } from "./trongLuongBulong";

describe("docQuyCach", () => {
  it("bulong liên kết các kiểu viết", () => {
    expect(docQuyCach("Bulong M16x50")).toEqual({ loai: "BULONG", d: 16, L: 50 });
    expect(docQuyCach("Bu lông M20*60 8.8")).toEqual({ loai: "BULONG", d: 20, L: 60 });
    expect(docQuyCach("M12 x 35")).toEqual({ loai: "BULONG", d: 12, L: 35 });
  });
  it("bulong neo và ty xà gồ", () => {
    expect(docQuyCach("Bulông neo M24x800")).toEqual({ loai: "NEO", d: 24, L: 800 });
    expect(docQuyCach("Ty xà gồ Ø12 L=1500")).toEqual({ loai: "TY", d: 12, L: 1500 });
    expect(docQuyCach("Ty D12x1200")).toEqual({ loai: "TY", d: 12, L: 1200 });
  });
  it("ecu, long đen bán lẻ", () => {
    expect(docQuyCach("Ecu M20")).toEqual({ loai: "ECU", d: 20, L: null });
    expect(docQuyCach("Long đen M16")).toEqual({ loai: "LONG_DEN", d: 16, L: null });
  });
  it("không chắc thì null", () => {
    expect(docQuyCach("Bulong liên kết")).toBeNull();
    expect(docQuyCach("M17x50")).toBeNull();
  });
});

describe("kgMotBo — khớp bảng tra trong vài %", () => {
  it("M16x50 bộ (bulong ~0,12 + ecu ~0,034 + 2 long đen ~0,011)", () => {
    expect(kgMotBo({ loai: "BULONG", d: 16, L: 50 })).toBeCloseTo(0.175, 2);
  });
  it("ty Ø12 dài 1500: thanh ~1,33 kg + phụ kiện", () => {
    const kg = kgMotBo({ loai: "TY", d: 12, L: 1500 })!;
    expect(kg).toBeGreaterThan(1.33);
    expect(kg).toBeLessThan(1.4);
  });
  it("thiếu chiều dài thì không đoán", () => {
    expect(kgMotBo({ loai: "BULONG", d: 16, L: null })).toBeNull();
  });
});

describe("goiYKgMotBo / laDonViDem", () => {
  it("gợi ý làm tròn 3 số lẻ kèm cấu tạo", () => {
    const g = goiYKgMotBo("Bulong M20x60")!;
    expect(g.kg).toBeGreaterThan(0.25);
    expect(g.cauTao).toContain("ecu");
  });
  it("đơn vị đếm", () => {
    expect(laDonViDem("Bộ")).toBe(true);
    expect(laDonViDem("cái")).toBe(true);
    expect(laDonViDem("kg")).toBe(false);
  });
});
