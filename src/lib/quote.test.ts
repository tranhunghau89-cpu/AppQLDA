import { describe, expect, it } from "vitest";
import {
  computeBaseCost,
  computeQuoteTotals,
  lineCost,
  lineSell,
  sellFromBase,
} from "./quote";

describe("lineSell / lineCost", () => {
  it("nhân khối lượng với đơn giá tương ứng", () => {
    const it0 = { qty: 12.5, baseCost: 1_000, sellPrice: 1_300 };
    expect(lineSell(it0)).toBe(16_250);
    expect(lineCost(it0)).toBe(12_500);
  });

  it("thiếu khối lượng hoặc đơn giá -> 0", () => {
    expect(lineSell({ qty: null, baseCost: 1, sellPrice: 1 })).toBe(0);
    expect(lineSell({ qty: 5, baseCost: 1, sellPrice: null })).toBe(0);
    expect(lineCost({ qty: 5, baseCost: null, sellPrice: 1 })).toBe(0);
  });
});

describe("computeQuoteTotals", () => {
  it("tổng giá bán, giá gốc, lợi nhuận và biên", () => {
    const t = computeQuoteTotals([
      { qty: 10, baseCost: 100, sellPrice: 130 },
      { qty: 5, baseCost: 200, sellPrice: 260 },
    ]);
    expect(t.cost).toBe(2_000);
    expect(t.sell).toBe(2_600);
    expect(t.profit).toBe(600);
    expect(t.margin).toBeCloseTo(600 / 2_600);
  });

  it("báo giá rỗng -> mọi tổng bằng 0, biên null", () => {
    const t = computeQuoteTotals([]);
    expect(t).toEqual({ sell: 0, cost: 0, profit: 0, margin: null });
  });

  it("tổng bán bằng 0 -> biên null, không chia cho 0", () => {
    expect(computeQuoteTotals([{ qty: 10, baseCost: 100, sellPrice: 0 }]).margin).toBeNull();
  });

  it("bán dưới giá gốc -> lợi nhuận âm", () => {
    const t = computeQuoteTotals([{ qty: 1, baseCost: 100, sellPrice: 80 }]);
    expect(t.profit).toBe(-20);
    expect(t.margin).toBeCloseTo(-0.25);
  });
});

describe("computeBaseCost", () => {
  it("giá thành = (vật tư + nhân công/máy) × hệ số", () => {
    expect(computeBaseCost(10_000, 4_000, 1.15)).toBeCloseTo(16_100);
  });

  it("thiếu hệ số coi như 1", () => {
    expect(computeBaseCost(10_000, 4_000, null)).toBe(14_000);
  });

  it("hệ số 0 được tôn trọng (không mặc định thành 1)", () => {
    expect(computeBaseCost(10_000, 4_000, 0)).toBe(0);
  });

  it("thiếu thành phần coi như 0", () => {
    expect(computeBaseCost(null, null, 2)).toBe(0);
  });
});

describe("sellFromBase", () => {
  it("đơn giá bán = giá gốc × hệ số TL", () => {
    expect(sellFromBase(100_000, 1.25)).toBe(125_000);
  });

  it("thiếu hệ số TL -> giữ nguyên giá gốc", () => {
    expect(sellFromBase(100_000, null)).toBe(100_000);
  });

  it("thiếu giá gốc -> 0", () => {
    expect(sellFromBase(null, 1.25)).toBe(0);
  });
});
