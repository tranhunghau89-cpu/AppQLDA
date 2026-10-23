import { describe, expect, it } from "vitest";
import { loaiVatTu, tongHopKhoiLuong, type DongKhoiLuong } from "./tongHopKhoiLuong";

const d = (o: Partial<DongKhoiLuong> & { name: string }): DongKhoiLuong => ({
  sectionId: "A",
  groupLabel: null,
  unit: "kg",
  designQty: null,
  actualQty: null,
  ...o,
});

describe("loaiVatTu", () => {
  it("tách thép tổ hợp, thép hình, xà gồ, tôn theo tên", () => {
    expect(loaiVatTu(d({ name: "Thép tổ hợp" }))).toBe("THEP_TO_HOP");
    expect(loaiVatTu(d({ name: "Thép tấm tổ hợp Q355" }))).toBe("THEP_TO_HOP");
    expect(loaiVatTu(d({ name: "Thép hình" }))).toBe("THEP_HINH");
    expect(loaiVatTu(d({ name: "Xà gồ", groupLabel: "Kết cấu thép" }))).toBe("XA_GO");
    expect(loaiVatTu(d({ name: "Tôn mái" }))).toBe("TON");
  });

  it("bỏ dòng công, phụ kiện và dòng tự tính", () => {
    expect(loaiVatTu(d({ name: "Lợp tôn" }))).toBeNull();
    expect(loaiVatTu(d({ name: "Vận chuyển", groupLabel: "Tôn mái" }))).toBeNull();
    expect(loaiVatTu(d({ name: "Lắp dựng thép hình" }))).toBeNull();
    expect(loaiVatTu(d({ name: "Ty xà gồ" }))).toBeNull();
    expect(loaiVatTu(d({ name: "Bulong liên kết" }))).toBeNull();
    expect(loaiVatTu(d({ name: "Bê tông" }))).toBeNull();
    expect(loaiVatTu(d({ name: "Thép hình", layTuThamSo: "KCT_KG" }))).toBeNull();
  });

  it("tên chung chung thì mượn tên nhóm, trừ nhóm phụ kiện", () => {
    expect(loaiVatTu(d({ name: "Vật tư", groupLabel: "Tôn mái" }))).toBe("TON");
    expect(loaiVatTu(d({ name: "Vật tư", groupLabel: "Bulong neo" }))).toBeNull();
    expect(loaiVatTu(d({ name: "Vật tư", groupLabel: "Bulong, ty xà gồ" }))).toBeNull();
  });
});

describe("tongHopKhoiLuong", () => {
  it("cộng theo loại + đơn vị, rồi theo hạng mục", () => {
    const kq = tongHopKhoiLuong([
      d({ name: "Tôn mái", unit: "m2", designQty: 100, actualQty: 98 }),
      d({ name: "Thép hình", designQty: 3000 }),
      d({ name: "Thép tổ hợp", designQty: 20000, actualQty: 19500 }),
      d({ name: "Thép tổ hợp", sectionId: "B", designQty: 5000 }),
      d({ name: "Tôn vách", unit: "m²", sectionId: "B", designQty: 50 }),
    ]);
    expect(kq.map((v) => [v.label, v.unit, v.duToan])).toEqual([
      ["Thép tổ hợp", "kg", 25000],
      ["Thép hình", "kg", 3000],
      ["Tôn", "m²", 150],
    ]);
    const toHop = kq[0];
    expect(toHop.thucTe).toBe(19500);
    expect(toHop.soDongCoThuc).toBe(1);
    expect(toHop.hangMuc.map((h) => [h.sectionId, h.duToan])).toEqual([
      ["A", 20000],
      ["B", 5000],
    ]);
  });
});
