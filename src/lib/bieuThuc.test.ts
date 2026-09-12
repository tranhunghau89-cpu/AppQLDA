import { describe, expect, it } from "vitest";
import { laCongThuc, tinhBieuThuc } from "./bieuThuc";

describe("tinhBieuThuc", () => {
  it("ví dụ trong yêu cầu: =20*50 ra 1000", () => {
    expect(tinhBieuThuc("=20*50")).toBe(1000);
  });

  describe("không có dấu bằng thì vẫn là số thường", () => {
    it.each([
      ["1000", 1000],
      ["20.580", 20580],
      ["1,5", 1.5],
      ["  42  ", 42],
    ])("%s -> %s", (tho, mong) => {
      expect(tinhBieuThuc(tho)).toBe(mong);
    });

    it("chuỗi rác vẫn là null như trước", () => {
      expect(tinhBieuThuc("abc")).toBeNull();
      expect(tinhBieuThuc("")).toBeNull();
      expect(tinhBieuThuc(null)).toBeNull();
      expect(tinhBieuThuc(undefined)).toBeNull();
    });

    it("số truyền thẳng vào thì giữ nguyên", () => {
      expect(tinhBieuThuc(1234.5)).toBe(1234.5);
      expect(tinhBieuThuc(Number.NaN)).toBeNull();
      expect(tinhBieuThuc(Number.POSITIVE_INFINITY)).toBeNull();
    });
  });

  describe("bốn phép tính", () => {
    it.each([
      ["=2+3", 5],
      ["=10-4", 6],
      ["=6*7", 42],
      ["=100/4", 25],
      ["=12*6", 72],
    ])("%s -> %s", (tho, mong) => {
      expect(tinhBieuThuc(tho)).toBe(mong);
    });

    it("nhân chia trước cộng trừ", () => {
      expect(tinhBieuThuc("=2+3*4")).toBe(14);
      expect(tinhBieuThuc("=20-6/2")).toBe(17);
    });

    it("ngoặc đổi thứ tự", () => {
      expect(tinhBieuThuc("=(2+3)*4")).toBe(20);
      expect(tinhBieuThuc("=2*(3+(4-1))")).toBe(12);
    });

    it("dấu âm đứng đầu và sau phép tính", () => {
      expect(tinhBieuThuc("=-5+8")).toBe(3);
      expect(tinhBieuThuc("=10*-2")).toBe(-20);
      expect(tinhBieuThuc("=--5")).toBe(5);
      expect(tinhBieuThuc("=+7")).toBe(7);
    });

    it("khoảng trắng không ảnh hưởng", () => {
      expect(tinhBieuThuc("= 20 * 50 ")).toBe(1000);
    });
  });

  describe("quy ước số kiểu Việt bên trong công thức", () => {
    it("dấu chấm là phân cách nghìn", () => {
      expect(tinhBieuThuc("=20.580*2")).toBe(41160);
    });

    it("dấu phẩy là thập phân", () => {
      expect(tinhBieuThuc("=1,5*4")).toBe(6);
      expect(tinhBieuThuc("=20*1,2")).toBeCloseTo(24, 9);
    });

    it("bóc khối lượng thật: 12 gian × 6 m × 1,2", () => {
      expect(tinhBieuThuc("=12*6*1,2")).toBeCloseTo(86.4, 9);
    });
  });

  describe("dấu nhân chia gõ kiểu khác", () => {
    it.each([
      ["=20×50", 1000],
      ["=20x50", 1000],
      ["=100÷4", 25],
      ["=100:4", 25],
    ])("%s -> %s", (tho, mong) => {
      expect(tinhBieuThuc(tho)).toBe(mong);
    });
  });

  describe("cú pháp sai trả null chứ không trả một nửa kết quả", () => {
    it.each([
      ["=2+", "thiếu vế phải"],
      ["=*5", "thiếu vế trái"],
      ["=(2+3", "thiếu ngoặc đóng"],
      ["=2+3)", "thừa ngoặc đóng"],
      ["=2 3", "hai số dính nhau"],
      ["=", "rỗng sau dấu bằng"],
      ["=abc", "không phải số"],
      ["=2^3", "phép tính không hỗ trợ"],
      ["=alert(1)", "không phải biểu thức số"],
    ])("%s (%s)", (tho) => {
      expect(tinhBieuThuc(tho)).toBeNull();
    });
  });

  describe("không để số rác lọt ra", () => {
    it("chia cho 0 trả null chứ không phải vô cực", () => {
      expect(tinhBieuThuc("=5/0")).toBeNull();
      expect(tinhBieuThuc("=5/(3-3)")).toBeNull();
    });

    it("kết quả tràn số trả null chứ không trả vô cực", () => {
      // 10^200 × 10^200 = 10^400, vượt số lớn nhất JavaScript biểu diễn được.
      const to = "1" + "0".repeat(200);
      expect(tinhBieuThuc(`=${to}*${to}`)).toBeNull();
    });

    it("số lớn nhưng còn biểu diễn được thì vẫn ra kết quả", () => {
      expect(tinhBieuThuc("=1000000*1000000")).toBe(1e12);
    });

    it("kết quả 0 là một kết quả hợp lệ", () => {
      expect(tinhBieuThuc("=5-5")).toBe(0);
      expect(tinhBieuThuc("=0*100")).toBe(0);
    });

    it("kết quả âm được giữ nguyên — chỗ gọi tự quyết có nhận hay không", () => {
      expect(tinhBieuThuc("=5-8")).toBe(-3);
    });
  });

  it("không chạy mã: chuỗi trông giống JavaScript chỉ là cú pháp sai", () => {
    for (const doc of [
      "=process.exit(1)",
      "=require('fs')",
      "=(()=>1)()",
      "=this",
      "=1;2",
      "=global",
    ]) {
      expect(tinhBieuThuc(doc)).toBeNull();
    }
  });
});

describe("laCongThuc", () => {
  it.each([
    ["=20*50", true],
    ["  =1+1", true],
    ["1000", false],
    ["", false],
    [null, false],
  ])("%s -> %s", (tho, mong) => {
    expect(laCongThuc(tho)).toBe(mong);
  });
});
