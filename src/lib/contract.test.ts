import { describe, expect, it } from "vitest";
import { computeContractTotals, lineAmount } from "./contract";

describe("lineAmount", () => {
  it("ưu tiên amount đã nhập", () => {
    expect(lineAmount({ amount: 250, qty: 10, unitPrice: 99 })).toBe(250);
  });

  it("amount = 0 vẫn được tôn trọng (khác với dòng dự toán)", () => {
    expect(lineAmount({ amount: 0, qty: 10, unitPrice: 99 })).toBe(0);
  });

  it("thiếu amount thì tính KL × đơn giá", () => {
    expect(lineAmount({ qty: 12.5, unitPrice: 200_000 })).toBe(2_500_000);
  });

  it("thiếu một trong hai (KL hoặc đơn giá) -> 0", () => {
    expect(lineAmount({ qty: 10 })).toBe(0);
    expect(lineAmount({ unitPrice: 10 })).toBe(0);
    expect(lineAmount({})).toBe(0);
  });
});

describe("computeContractTotals", () => {
  it("cộng các dòng rồi tính VAT 8%", () => {
    const t = computeContractTotals(
      [{ amount: 2_000_000_000 }, { qty: 100, unitPrice: 8_300_000 }],
      8
    );
    expect(t.beforeVat).toBe(2_830_000_000);
    expect(t.vat).toBeCloseTo(226_400_000);
    expect(t.withVat).toBeCloseTo(3_056_400_000);
  });

  it("VAT null coi như 0%", () => {
    const t = computeContractTotals([{ amount: 1_000 }], null);
    expect(t.vat).toBe(0);
    expect(t.withVat).toBe(1_000);
  });

  it("VAT 0 khác với VAT null? — cả hai đều ra 0", () => {
    expect(computeContractTotals([{ amount: 1_000 }], 0).withVat).toBe(1_000);
  });

  it("hợp đồng chưa có hạng mục -> toàn bộ bằng 0", () => {
    expect(computeContractTotals([], 10)).toEqual({ beforeVat: 0, vat: 0, withVat: 0 });
  });

  it("VAT 10% tính đúng", () => {
    const t = computeContractTotals([{ amount: 1_000_000 }], 10);
    expect(t.vat).toBe(100_000);
    expect(t.withVat).toBe(1_100_000);
  });
});
