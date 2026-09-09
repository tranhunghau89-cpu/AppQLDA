import { describe, expect, it } from "vitest";
import { computeAmount, computeProfit, formatPercent } from "./profit";
import type { EstimateLine } from "./profit";

function line(p: Partial<EstimateLine> = {}): EstimateLine {
  return {
    groupCode: "KCT",
    designQty: null,
    actualQty: null,
    unitPrice: null,
    amount: null,
    ...p,
  };
}

describe("computeAmount", () => {
  it("ưu tiên amount đã nhập sẵn", () => {
    expect(computeAmount(line({ amount: 5_000_000, designQty: 10, unitPrice: 1 }))).toBe(
      5_000_000
    );
  });

  it("amount = 0 được coi như chưa nhập, quay về tính KL × đơn giá", () => {
    expect(computeAmount(line({ amount: 0, designQty: 10, unitPrice: 20_000 }))).toBe(200_000);
  });

  it("dùng KL thực tế thay cho KL thiết kế khi có", () => {
    expect(
      computeAmount(line({ designQty: 10, actualQty: 12, unitPrice: 1_000 }))
    ).toBe(12_000);
  });

  it("KL thực tế = 0 vẫn được tôn trọng (không rơi về KL thiết kế)", () => {
    expect(computeAmount(line({ designQty: 10, actualQty: 0, unitPrice: 1_000 }))).toBe(0);
  });

  it("thiếu dữ liệu trả về 0", () => {
    expect(computeAmount(line())).toBe(0);
  });
});

describe("computeProfit", () => {
  it("cộng dồn chi phí và tính lợi nhuận, biên LN, CP/m²", () => {
    const r = computeProfit(
      [
        line({ groupCode: "KCT", amount: 600_000_000 }),
        line({ groupCode: "TON", amount: 200_000_000 }),
      ],
      1_000_000_000,
      500
    );
    expect(r.totalCost).toBe(800_000_000);
    expect(r.salePrice).toBe(1_000_000_000);
    expect(r.profit).toBe(200_000_000);
    expect(r.margin).toBeCloseTo(0.2);
    expect(r.costPerM2).toBe(1_600_000);
  });

  it("gộp nhiều dòng cùng nhóm thành một dòng tổng", () => {
    const r = computeProfit(
      [
        line({ groupCode: "KCT", amount: 100 }),
        line({ groupCode: "KCT", amount: 250 }),
        line({ groupCode: "TON", amount: 40 }),
      ],
      0,
      null
    );
    const kct = r.groupSubtotals.find((g) => g.code === "KCT");
    expect(kct?.amount).toBe(350);
    expect(r.groupSubtotals).toHaveLength(2);
  });

  it("chỉ liệt kê nhóm thực sự có số liệu", () => {
    const r = computeProfit([line({ groupCode: "KCT", amount: 1 })], null, null);
    expect(r.groupSubtotals.map((g) => g.code)).toEqual(["KCT"]);
  });

  it("giá bán bằng 0 hoặc null -> biên LN là null, không chia cho 0", () => {
    expect(computeProfit([line({ amount: 100 })], null, null).margin).toBeNull();
    expect(computeProfit([line({ amount: 100 })], 0, null).margin).toBeNull();
  });

  it("diện tích null hoặc 0 -> CP/m² là null", () => {
    expect(computeProfit([line({ amount: 100 })], 1, null).costPerM2).toBeNull();
    expect(computeProfit([line({ amount: 100 })], 1, 0).costPerM2).toBeNull();
  });

  it("lỗ được thể hiện bằng lợi nhuận âm và biên LN âm", () => {
    const r = computeProfit([line({ amount: 1_200 })], 1_000, null);
    expect(r.profit).toBe(-200);
    expect(r.margin).toBeCloseTo(-0.2);
  });

  it("không có dòng nào -> chi phí 0", () => {
    const r = computeProfit([], 500, 10);
    expect(r.totalCost).toBe(0);
    expect(r.profit).toBe(500);
    expect(r.costPerM2).toBe(0);
  });
});

describe("formatPercent", () => {
  it("hiển thị 1 chữ số thập phân", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
  });
  it("null hoặc NaN -> gạch ngang", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(Number.NaN)).toBe("—");
  });
});
