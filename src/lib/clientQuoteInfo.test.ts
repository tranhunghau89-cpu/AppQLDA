import { describe, expect, it } from "vitest";
import { demOTrong } from "./clientQuoteInfo";

describe("demOTrong", () => {
  it("điền đủ thì không thiếu ô nào", () => {
    expect(demOTrong(["a", "b", "c"])).toBe(0);
  });

  it("chuỗi rỗng và chuỗi toàn khoảng trắng đều tính là chưa điền", () => {
    // Trên giấy thì một dấu cách cũng là chỗ trống.
    expect(demOTrong(["", "   ", "\t", "\n ", "x"])).toBe(4);
  });

  it("số 0 gõ vào ô hiệu lực là giá trị thật, không phải chỗ trống", () => {
    expect(demOTrong(["0"])).toBe(0);
  });

  it("khoảng trắng KẸP GIỮA chữ thì vẫn là đã điền", () => {
    expect(demOTrong(["Công ty CP ABC", " Hà Nội "])).toBe(0);
  });

  it("danh sách rỗng -> 0", () => {
    expect(demOTrong([])).toBe(0);
  });
});
