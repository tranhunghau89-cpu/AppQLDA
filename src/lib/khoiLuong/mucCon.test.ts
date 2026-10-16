import { describe, expect, it } from "vitest";
import { monDonHangThanhMucCon, tongMucCon } from "./mucCon";

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

describe("món đơn hàng gắn vào đầu việc", () => {
  it("cộng chung với mục con thực tế; ô thành tiền của đơn hàng thắng SL × đơn giá", () => {
    const ds = [
      { ten: "M12x30", donVi: "kg", khoiLuong: 100, donGia: 30000 },
      monDonHangThanhMucCon({ name: "M16x50", unit: "kg", qty: 200, unitPrice: 20000, amount: null }),
      monDonHangThanhMucCon({ name: "Thép", unit: "kg", qty: 100, unitPrice: 10000, amount: 1_100_000 }),
    ];
    const t = tongMucCon(ds, "kg");
    expect(t.khoiLuong).toBe(400);
    expect(t.thanhTien).toBe(3_000_000 + 4_000_000 + 1_100_000);
    expect(t.soThieu).toBe(0);
  });

  it("món chỉ có thành tiền, không SL: vẫn vào tiền, không cộng được KL", () => {
    const m = monDonHangThanhMucCon({ name: "Vận chuyển", unit: null, qty: null, unitPrice: null, amount: 500_000 });
    expect(m.donGia).toBeNull();
    const t = tongMucCon([m], "kg");
    expect(t).toEqual({ khoiLuong: null, thanhTien: 500_000, donGia: null, soThieu: 0 });
  });

  it("đầu việc kg: mục con bộ quy ra kg theo kg/đv, món đơn hàng theo trọng lượng", () => {
    const t = tongMucCon(
      [
        { ten: "M16x50", donVi: "bộ", khoiLuong: 200, donGia: 6000, kgMotDonVi: 0.175 },
        { ten: "Thép", donVi: "kg", khoiLuong: 100, donGia: 20000 },
        monDonHangThanhMucCon({ name: "M20x60", unit: "bộ", qty: 50, unitPrice: 9000, amount: null, weight: 15 }),
      ],
      "kg"
    );
    expect(t.khoiLuong).toBeCloseTo(35 + 100 + 15);
    expect(t.thanhTien).toBe(1_200_000 + 2_000_000 + 450_000);
  });

  it("bộ chưa có kg/đv thì không cộng được KL", () => {
    expect(tongMucCon([{ ten: "M16x50", donVi: "bộ", khoiLuong: 10, donGia: 1 }], "kg").khoiLuong).toBeNull();
  });

  it("chỉ có SL và thành tiền: suy ra đơn giá", () => {
    const m = monDonHangThanhMucCon({ name: "X", unit: "cái", qty: 4, unitPrice: null, amount: 200 });
    expect(m.donGia).toBe(50);
  });
});
