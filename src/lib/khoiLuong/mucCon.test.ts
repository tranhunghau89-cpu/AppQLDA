import { describe, expect, it } from "vitest";
import { tongMucCon } from "./mucCon";

describe("tongMucCon", () => {
  it("cùng đơn vị: cộng KL, thành tiền, ra đơn giá bình quân", () => {
    const t = tongMucCon(
      [
        { ten: "M12x30", donVi: "kg", khoiLuong: 100, donGia: 30000 },
        { ten: "M16x50", donVi: null, khoiLuong: 300, donGia: 20000 },
      ],
      "kg"
    );
    expect(t).toEqual({ khoiLuong: 400, thanhTien: 9_000_000, donGia: 22500, soThieu: 0 });
  });

  it("khác đơn vị dòng cha: không cộng KL nhưng vẫn cộng tiền", () => {
    const t = tongMucCon([{ ten: "M12x30", donVi: "cái", khoiLuong: 400, donGia: 5000 }], "kg");
    expect(t.khoiLuong).toBeNull();
    expect(t.donGia).toBeNull();
    expect(t.thanhTien).toBe(2_000_000);
  });

  it("thiếu giá: đếm vào soThieu, chưa mục nào có giá thì thành tiền null", () => {
    const t = tongMucCon([{ ten: "M12", donVi: null, khoiLuong: 5, donGia: null }], "cái");
    expect(t).toEqual({ khoiLuong: 5, thanhTien: null, donGia: null, soThieu: 1 });
  });

  it("danh sách rỗng", () => {
    expect(tongMucCon([], "kg")).toEqual({ khoiLuong: null, thanhTien: null, donGia: null, soThieu: 0 });
  });
});
