import { describe, expect, it } from "vitest";
import { quyCachBoSung } from "./text";

describe("quyCachBoSung", () => {
  it("quy cách đã chép trong tên thì không hiện lại — dòng thật của thư viện", () => {
    expect(
      quyCachBoSung("Bulong neo M30 dài 900, CT34, xi kẽm ren", "CT34, xi kẽm ren")
    ).toBeNull();
    expect(quyCachBoSung("Thép tổ hợp cột, kèo, dầm, SS400", "SS400")).toBeNull();
  });

  it("khác khoảng trắng, dấu phẩy, hoa thường, dấu tiếng Việt vẫn nhận ra là trùng", () => {
    expect(quyCachBoSung("Xà gồ dập C và Z, SS400, G350Z80", "ss400 g350z80")).toBeNull();
    // Chấm và phẩy thập phân bị coi là một: "0.45mm" và "0,45mm" là cùng một độ dày.
    expect(quyCachBoSung("Tôn thẳng 5, 6 sóng, 0,45mm", "0.45MM")).toBeNull();
    expect(quyCachBoSung("Tôn thẳng 5, 6 sóng, 0,45mm", "0,45 MM")).toBeNull();
  });

  it("quy cách bổ sung thông tin mới thì vẫn hiện nguyên văn", () => {
    expect(quyCachBoSung("Tôn lợp mái", "0,45mm Hoa Sen")).toBe("0,45mm Hoa Sen");
  });

  it("trống thì không hiện", () => {
    expect(quyCachBoSung("Tôn", null)).toBeNull();
    expect(quyCachBoSung("Tôn", "   ")).toBeNull();
    expect(quyCachBoSung("Tôn", undefined)).toBeNull();
  });

  it("quy cách chỉ toàn ký tự đặc biệt không bị coi là 'nằm trong tên' của mọi chuỗi", () => {
    // norm("---") là chuỗi rỗng, mà mọi chuỗi đều "chứa" chuỗi rỗng.
    expect(quyCachBoSung("Tôn", "---")).toBeNull();
  });

  it("tên trống thì quy cách là thứ duy nhất có nghĩa", () => {
    expect(quyCachBoSung(null, "SS400")).toBe("SS400");
  });
});
