import { describe, expect, it } from "vitest";
import { computeTemplateLines, type LineValue, type TemplateLine } from "./estimateTemplate";

function line(p: Partial<TemplateLine> & { id: string }): TemplateLine {
  return {
    groupLabel: "Khung thép",
    name: "Thép hình",
    unit: "kg",
    defaultUnitPrice: null,
    role: "INPUT",
    feedsParam: null,
    takesFromParam: null,
    factor: null,
    defaultQty: null,
    groupCode: "KCT",
    note: null,
    sortOrder: 0,
    ...p,
  };
}
const v = (qty: number | null, unitPrice: number | null = null): LineValue => ({ qty, unitPrice });

describe("computeTemplateLines", () => {
  it("dòng INPUT lấy khối lượng người dùng nhập", () => {
    const [r] = computeTemplateLines([line({ id: "a" })], { a: v(120) });
    expect(r.qty).toBe(120);
  });

  it("dòng DERIVED lấy khối lượng = tham số × hệ số", () => {
    const rows = computeTemplateLines(
      [
        line({ id: "a", role: "INPUT", feedsParam: "kgThep" }),
        line({ id: "b", role: "DERIVED", takesFromParam: "kgThep", factor: 0.02 }),
      ],
      { a: v(1_000) }
    );
    expect(rows[1].qty).toBeCloseTo(20);
  });

  it("nhiều dòng INPUT cùng nạp một tham số thì cộng dồn", () => {
    const rows = computeTemplateLines(
      [
        line({ id: "a", feedsParam: "kg" }),
        line({ id: "b", feedsParam: "kg" }),
        line({ id: "c", role: "DERIVED", takesFromParam: "kg", factor: 1 }),
      ],
      { a: v(300), b: v(700) }
    );
    expect(rows[2].qty).toBe(1_000);
  });

  it("dòng DERIVED thiếu hệ số coi như ×1", () => {
    const rows = computeTemplateLines(
      [
        line({ id: "a", feedsParam: "kg" }),
        line({ id: "b", role: "DERIVED", takesFromParam: "kg", factor: null }),
      ],
      { a: v(50) }
    );
    expect(rows[1].qty).toBe(50);
  });

  it("tham số chưa ai nạp -> dòng DERIVED bằng 0, không phải NaN", () => {
    const rows = computeTemplateLines(
      [line({ id: "b", role: "DERIVED", takesFromParam: "chuaCo", factor: 3 })],
      {}
    );
    expect(rows[0].qty).toBe(0);
  });

  it("đơn giá người dùng nhập ghi đè đơn giá mặc định của mẫu", () => {
    const [r] = computeTemplateLines([line({ id: "a", defaultUnitPrice: 20_000 })], {
      a: v(10, 25_000),
    });
    expect(r.unitPrice).toBe(25_000);
    expect(r.amount).toBe(250_000);
  });

  it("không nhập đơn giá -> dùng đơn giá mặc định của mẫu", () => {
    const [r] = computeTemplateLines([line({ id: "a", defaultUnitPrice: 20_000 })], {
      a: v(10),
    });
    expect(r.unitPrice).toBe(20_000);
    expect(r.amount).toBe(200_000);
  });

  it("thiếu khối lượng hoặc đơn giá -> thành tiền null (không phải 0)", () => {
    const [noQty] = computeTemplateLines([line({ id: "a", defaultUnitPrice: 100 })], {});
    expect(noQty.qty).toBeNull();
    expect(noQty.amount).toBeNull();

    const [noPrice] = computeTemplateLines([line({ id: "a" })], { a: v(10) });
    expect(noPrice.unitPrice).toBeNull();
    expect(noPrice.amount).toBeNull();
  });

  it("giá trị không hữu hạn bị loại (NaN/Infinity không lọt vào dự toán)", () => {
    const rows = computeTemplateLines(
      [
        line({ id: "a", feedsParam: "kg" }),
        line({ id: "b", role: "DERIVED", takesFromParam: "kg", factor: 2 }),
      ],
      { a: { qty: Number.NaN, unitPrice: Number.POSITIVE_INFINITY } }
    );
    expect(rows[0].qty).toBeNull();
    expect(rows[0].unitPrice).toBeNull();
    expect(rows[1].qty).toBe(0);
  });

  it("giữ nguyên thứ tự và metadata của mẫu", () => {
    const rows = computeTemplateLines(
      [
        line({ id: "a", name: "Thép", sortOrder: 0, groupCode: "KCT" }),
        line({ id: "b", name: "Tôn", sortOrder: 1, groupCode: "TON" }),
      ],
      {}
    );
    expect(rows.map((r) => r.name)).toEqual(["Thép", "Tôn"]);
    expect(rows.map((r) => r.groupCode)).toEqual(["KCT", "TON"]);
    expect(rows.map((r) => r.lineId)).toEqual(["a", "b"]);
  });

  it("dòng INPUT không khai feedsParam thì không nạp tham số nào", () => {
    const rows = computeTemplateLines(
      [
        line({ id: "a", feedsParam: null }),
        line({ id: "b", role: "DERIVED", takesFromParam: "kg", factor: 1 }),
      ],
      { a: v(500) }
    );
    expect(rows[1].qty).toBe(0);
  });
});
