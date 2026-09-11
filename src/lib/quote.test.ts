import { describe, expect, it } from "vitest";
import {
  computeBaseCost,
  computeQuoteTotals,
  lineCost,
  lineSell,
  sectionSubtotals,
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

describe("sectionSubtotals", () => {
  // Dòng rút gọn: chỉ cần qty × sellPrice, baseCost không ảnh hưởng.
  const dong = (sectionId: string, tien: number) => ({
    sectionId,
    qty: 1,
    baseCost: 0,
    sellPrice: tien,
  });

  it("phần chỉ có dòng trực tiếp", () => {
    const m = sectionSubtotals(
      [{ id: "A", parentId: null }],
      [dong("A", 100), dong("A", 250)]
    );
    expect(m.get("A")).toBe(350);
  });

  it("cộng cả dòng của các mục con vào phần gốc", () => {
    const m = sectionSubtotals(
      [
        { id: "A", parentId: null },
        { id: "I", parentId: "A" },
        { id: "II", parentId: "A" },
      ],
      [dong("A", 10), dong("I", 20), dong("II", 30)]
    );
    expect(m.get("A")).toBe(60);
    // Mục con KHÔNG có khóa riêng — chỉ phần gốc mới xuất hiện trong map.
    expect(m.has("I")).toBe(false);
  });

  it("phần rỗng -> 0 chứ không undefined", () => {
    const m = sectionSubtotals([{ id: "A", parentId: null }], []);
    expect(m.get("A")).toBe(0);
  });

  it("dòng trỏ tới section không tồn tại thì bị bỏ qua, không ném lỗi", () => {
    const m = sectionSubtotals(
      [{ id: "A", parentId: null }],
      [dong("A", 100), dong("KHONG_CO", 999)]
    );
    expect(m.get("A")).toBe(100);
  });

  it("section tự làm cha nó thì không lặp vô hạn", () => {
    const m = sectionSubtotals(
      [
        { id: "A", parentId: null },
        { id: "X", parentId: "X" },
      ],
      [dong("A", 100), dong("X", 999)]
    );
    expect(m.get("A")).toBe(100);
    expect(m.has("X")).toBe(false);
  });

  it("hai phần gốc không lẫn tiền của nhau", () => {
    const m = sectionSubtotals(
      [
        { id: "A", parentId: null },
        { id: "B", parentId: null },
        { id: "I", parentId: "B" },
      ],
      [dong("A", 10), dong("I", 20)]
    );
    expect(m.get("A")).toBe(10);
    expect(m.get("B")).toBe(20);
  });
});
