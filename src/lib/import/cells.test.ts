import { describe, expect, it } from "vitest";
import { date, dims, norm, num, text } from "./cells";

describe("num — đọc số từ ô Excel", () => {
  it("số thường", () => {
    expect(num(1234.5)).toBe(1234.5);
    expect(num(0)).toBe(0);
  });

  it("ô CÔNG THỨC lấy được giá trị đã tính — file dự toán đầy công thức", () => {
    expect(num({ formula: "SUM(A1:A5)", result: 900 } as never)).toBe(900);
  });

  it("công thức lỗi (#REF!) -> null chứ không phải NaN", () => {
    expect(num({ formula: "A1/0", result: { error: "#DIV/0!" } } as never)).toBeNull();
  });

  it("chuỗi, null, undefined -> null", () => {
    expect(num("1234" as never)).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(undefined as never)).toBeNull();
  });

  it("Infinity / NaN -> null (không để lọt vào phép cộng tiền)", () => {
    expect(num(Number.POSITIVE_INFINITY)).toBeNull();
    expect(num(Number.NaN)).toBeNull();
    expect(num({ result: Number.NaN } as never)).toBeNull();
  });
});

describe("text — đọc chữ từ ô Excel", () => {
  it("chuỗi được cắt khoảng trắng thừa", () => {
    expect(text("  Thép hình  ")).toBe("Thép hình");
  });

  it("richText (ô có nhiều định dạng) được ghép lại", () => {
    expect(text({ richText: [{ text: "Bu lông " }, { text: "neo" }] } as never)).toBe("Bu lông neo");
  });

  it("ô công thức trả chuỗi hoặc số", () => {
    expect(text({ formula: "A1", result: "K20L60" } as never)).toBe("K20L60");
    expect(text({ formula: "A1", result: 42 } as never)).toBe("42");
  });

  it("số thành chuỗi, null thành rỗng", () => {
    expect(text(42)).toBe("42");
    expect(text(null)).toBe("");
  });

  it("ô hyperlink lấy phần text", () => {
    expect(text({ text: "Xem file", hyperlink: "http://x" } as never)).toBe("Xem file");
  });
});

describe("date", () => {
  it("Date thật", () => {
    const d = new Date("2026-05-01T00:00:00Z");
    expect(date(d)?.getTime()).toBe(d.getTime());
  });
  it("Date không hợp lệ -> null", () => {
    expect(date(new Date("xyz"))).toBeNull();
  });
  it("chuỗi ISO parse được", () => {
    expect(date("2026-05-01")?.getUTCFullYear()).toBe(2026);
  });
  it("chuỗi vô nghĩa và rỗng -> null", () => {
    expect(date("không phải ngày")).toBeNull();
    expect(date("")).toBeNull();
    expect(date(null)).toBeNull();
  });
});

describe("dims — rút kích thước khung từ tên file", () => {
  it("lấy được phần K..L.. ở đầu tên", () => {
    expect(dims("K25L60_PT")).toBe("K25L60");
    expect(dims("k20l50")).toBe("K20L50");
  });
  it("không khớp -> null", () => {
    expect(dims("BaoGia_2026")).toBeNull();
    expect(dims("PT_K25L60")).toBeNull(); // phải ở ĐẦU tên
  });
});

describe("norm — chuẩn hóa để so khớp", () => {
  it("bỏ dấu và đ", () => {
    expect(norm("Công ty Thép Đại Việt")).toBe("congtythepdaiviet");
  });
  it("hai cách viết khác nhau vẫn khớp", () => {
    expect(norm("K25L60_PT")).toBe(norm("k25l60 pt"));
  });
});
