import { describe, expect, it } from "vitest";
import { laTrangChaoGia } from "./duongDanChaoGia";

describe("laTrangChaoGia", () => {
  it("dự toán chào giá và báo giá gửi khách của dự án lẫn cơ hội", () => {
    expect(laTrangChaoGia("/projects/abc/quote")).toBe(true);
    expect(laTrangChaoGia("/projects/abc/client-quote")).toBe(true);
    expect(laTrangChaoGia("/co-hoi/xyz/quote")).toBe(true);
    expect(laTrangChaoGia("/co-hoi/xyz/client-quote/")).toBe(true);
  });

  it("dự toán thi công và các trang khác của dự án KHÔNG phải trang chào giá", () => {
    expect(laTrangChaoGia("/projects/abc")).toBe(false);
    expect(laTrangChaoGia("/projects/abc/estimate")).toBe(false);
    expect(laTrangChaoGia("/projects/abc/cost")).toBe(false);
    expect(laTrangChaoGia("/co-hoi/xyz")).toBe(false);
  });

  it("không khớp nhầm đoạn đường dẫn chỉ BẮT ĐẦU bằng quote", () => {
    expect(laTrangChaoGia("/projects/abc/quotes")).toBe(false);
    expect(laTrangChaoGia("/projects/abc/quote-templates")).toBe(false);
    expect(laTrangChaoGia("/quotes")).toBe(false);
  });
});
