import { describe, expect, it } from "vitest";
import { formatNumber, formatVND, parseViNumber, formatQty } from "./utils";

describe("parseViNumber", () => {
  it("dấu chấm là phân cách nghìn", () => {
    expect(parseViNumber("100.000.000")).toBe(100_000_000);
    expect(parseViNumber("1.130")).toBe(1_130);
  });

  it("dấu phẩy là thập phân", () => {
    expect(parseViNumber("12.496,57")).toBeCloseTo(12_496.57);
    expect(parseViNumber("0,5")).toBe(0.5);
  });

  it("bỏ qua khoảng trắng", () => {
    expect(parseViNumber(" 1 234 567 ")).toBe(1_234_567);
  });

  it("số truyền vào giữ nguyên", () => {
    expect(parseViNumber(12.5)).toBe(12.5);
  });

  it("rỗng / null / undefined -> null", () => {
    expect(parseViNumber("")).toBeNull();
    expect(parseViNumber("   ")).toBeNull();
    expect(parseViNumber(null)).toBeNull();
    expect(parseViNumber(undefined)).toBeNull();
  });

  it("chuỗi không phải số -> null", () => {
    expect(parseViNumber("abc")).toBeNull();
    expect(parseViNumber("12abc")).toBeNull();
  });

  it("số không hữu hạn -> null", () => {
    expect(parseViNumber(Number.NaN)).toBeNull();
    expect(parseViNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("số âm giữ dấu", () => {
    expect(parseViNumber("-1.500")).toBe(-1_500);
  });
});

describe("formatNumber / formatVND", () => {
  it("làm tròn và chèn dấu phân cách nghìn", () => {
    expect(formatNumber(1234567.4).replace(/\u00a0/g, " ")).toBe("1.234.567");
  });

  it("thêm ký hiệu tiền", () => {
    expect(formatVND(1_000_000)).toMatch(/₫$/);
  });

  it("null / NaN -> gạch ngang", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatVND(Number.NaN)).toBe("—");
  });

  it("0 hiển thị là 0, không phải gạch ngang", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatQty", () => {
  it("giữ số lẻ thật của khối lượng", () => {
    // Chốt lỗi cũ: formatNumber làm tròn 15,6 -> 16 ngay trên báo giá gửi khách.
    expect(formatQty(15.6)).toBe("15,6");
    expect(formatQty(714.5)).toBe("714,5");
    expect(formatQty(15.65)).toBe("15,65");
  });

  it("số nguyên KHÔNG kèm đuôi ,00", () => {
    expect(formatQty(1000)).toBe("1.000");
    expect(formatQty(714)).toBe("714");
  });

  it("không có khối lượng -> gạch ngang", () => {
    expect(formatQty(null)).toBe("—");
    expect(formatQty(undefined)).toBe("—");
    expect(formatQty(NaN)).toBe("—");
  });

  it("khối lượng 0 là giá trị thật, không phải thiếu dữ liệu", () => {
    expect(formatQty(0)).toBe("0");
  });
});
