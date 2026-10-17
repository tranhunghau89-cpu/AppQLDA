import { describe, expect, it } from "vitest";
import { gopTheoMa } from "./gop";

describe("gopTheoMa", () => {
  it("cộng cùng mã qua các hạng mục, giữ chi tiết từng hạng mục", () => {
    const r = gopTheoMa([
      { name: "M20x70", unit: "bộ", qty: 232, weight: 72, groupName: "HM khung mái" },
      { name: "M12x40", unit: "bộ", qty: 766, weight: 54, groupName: "HM khung mái" },
      { name: "M20×70", unit: "Bộ", qty: 40, weight: 12.4, groupName: "HM cột" },
      { name: "M20x70", unit: "bộ", qty: 8, weight: 2.5, groupName: "HM khung mái" },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({
      name: "M20x70",
      unit: "bộ",
      qty: 280,
      weight: 86.9,
      chiTiet: [
        { hangMuc: "HM khung mái", qty: 240 },
        { hangMuc: "HM cột", qty: 40 },
      ],
    });
  });
  it("khác đơn vị thì không gộp", () => {
    expect(
      gopTheoMa([
        { name: "Tăng đơ M20", unit: "Cái", qty: 2, weight: null, groupName: null },
        { name: "Tăng đơ M20", unit: "bộ", qty: 2, weight: null, groupName: null },
      ]),
    ).toHaveLength(2);
  });
});
