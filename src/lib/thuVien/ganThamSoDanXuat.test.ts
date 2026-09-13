import { describe, expect, it } from "vitest";
import { ganThamSoDanXuat, type DongBoThamSo, type DongCanThamSo } from "./ganThamSoDanXuat";

const dong = (o: Partial<DongCanThamSo> & { id: string }): DongCanThamSo => ({
  maMuc: "A",
  ten: "Vận chuyển KCT",
  unit: "kg",
  ...o,
});
const bo = (o: Partial<DongBoThamSo> = {}): DongBoThamSo => ({
  maPhan: "A",
  ten: "Vận chuyển KCT",
  donVi: "kg",
  napThamSo: null,
  layTuThamSo: "KCT_KG",
  heSoQuyDoi: 1,
  ...o,
});

describe("ganThamSoDanXuat", () => {
  it("dòng dẫn xuất nhận tham số LẤY, dòng thép nhận tham số NẠP", () => {
    const kq = ganThamSoDanXuat(
      [dong({ id: "vc" }), dong({ id: "thep", ten: "Thép tổ hợp" })],
      [bo(), bo({ ten: "Thép tổ hợp", napThamSo: "KCT_KG", layTuThamSo: null })]
    );
    expect(kq.gan).toEqual([
      { id: "vc", napThamSo: null, layTuThamSo: "KCT_KG", heSoQuyDoi: 1 },
      { id: "thep", napThamSo: "KCT_KG", layTuThamSo: null, heSoQuyDoi: 1 },
    ]);
  });

  it("dòng bộ không khai tham số nào thì không gắn gì", () => {
    const kq = ganThamSoDanXuat(
      [dong({ id: "d1", ten: "Vật tư", unit: "bộ" })],
      [bo({ ten: "Vật tư", donVi: "bộ", layTuThamSo: null })]
    );
    expect(kq.gan).toEqual([]);
  });

  it("cùng tên nhưng khác phần hoặc khác đơn vị là không khớp", () => {
    const kq = ganThamSoDanXuat(
      [dong({ id: "khacPhan", maMuc: "B" }), dong({ id: "khacDonVi", unit: "tấn" })],
      [bo()]
    );
    expect(kq.gan).toEqual([]);
  });

  it("phần E lấy từ DECK_M2, phần A lấy từ TON_M2 — mã phần quyết định", () => {
    const kq = ganThamSoDanXuat(
      [
        dong({ id: "a", ten: "Lợp tôn", unit: "m2" }),
        dong({ id: "e", maMuc: "E", ten: "Lợp tôn", unit: "m2" }),
      ],
      [
        bo({ ten: "Lợp tôn", donVi: "m2", layTuThamSo: "TON_M2" }),
        bo({ maPhan: "E", ten: "Lợp tôn", donVi: "m2", layTuThamSo: "DECK_M2" }),
      ]
    );
    expect(kq.gan.map((g) => [g.id, g.layTuThamSo])).toEqual([
      ["a", "TON_M2"],
      ["e", "DECK_M2"],
    ]);
  });

  it("nhiều bộ khai tham số khác nhau thì không đoán", () => {
    const kq = ganThamSoDanXuat([dong({ id: "d1" })], [bo(), bo({ heSoQuyDoi: 0.5 })]);
    expect(kq.gan).toEqual([]);
    expect(kq.mapMo).toEqual([{ id: "d1", ten: "Vận chuyển KCT", soPhuongAn: 2 }]);
  });
});
