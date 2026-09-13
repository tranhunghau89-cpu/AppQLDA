import { describe, expect, it } from "vitest";
import { ganTenGonNhom, type DongBo, type DongCanGan } from "./ganTenGonNhom";

const dong = (o: Partial<DongCanGan> & { id: string }): DongCanGan => ({
  maMuc: "A",
  name: "Vật tư",
  unit: "bộ",
  note: null,
  ...o,
});
const bo = (o: Partial<DongBo> = {}): DongBo => ({
  maPhan: "A",
  ten: "Vật tư",
  donVi: "bộ",
  groupLabel: "Bulong neo",
  ghiChu: null,
  tenCongTac: "Bulong neo M22 dày 650, CT34, xi kẽm ren",
  ...o,
});

describe("ganTenGonNhom", () => {
  it("tên hiện tại thành tên gọn, tên công tác thành tên đầy đủ, nhận nhóm của bộ", () => {
    const kq = ganTenGonNhom([dong({ id: "d1" })], [bo()]);
    expect(kq.gan).toEqual([
      {
        id: "d1",
        tenGon: "Vật tư",
        groupLabel: "Bulong neo",
        name: "Bulong neo M22 dày 650, CT34, xi kẽm ren",
        note: null,
      },
    ]);
  });

  it("dòng bộ chưa gắn công tác thì giữ nguyên tên", () => {
    const kq = ganTenGonNhom(
      [dong({ id: "d1", name: "Bulong liên kết", unit: "kg" })],
      [bo({ ten: "Bulong liên kết", donVi: "kg", groupLabel: "Bulong, ty xà gồ", tenCongTac: null })]
    );
    expect(kq.gan[0]).toMatchObject({ tenGon: "Bulong liên kết", name: null });
  });

  it("ghi chú của bộ chỉ điền vào dòng CHƯA có ghi chú", () => {
    const kq = ganTenGonNhom(
      [dong({ id: "trong" }), dong({ id: "co", note: "khách tự cấp" })],
      [bo({ ghiChu: "Q355" })]
    );
    expect(kq.gan.find((g) => g.id === "trong")?.note).toBe("Q355");
    expect(kq.gan.find((g) => g.id === "co")?.note).toBeNull();
  });

  it("khớp theo mã mục và đơn vị: cùng tên khác phần hoặc khác đơn vị là không khớp", () => {
    const kq = ganTenGonNhom(
      [dong({ id: "khacPhan", maMuc: "B" }), dong({ id: "khacDonVi", unit: "kg" })],
      [bo()]
    );
    expect(kq.gan).toEqual([]);
    expect(kq.soKhongKhop).toBe(2);
  });

  it("không bỏ dấu tiếng Việt khi so, nhưng bỏ qua hoa thường và dấu cách", () => {
    const kq = ganTenGonNhom(
      [dong({ id: "ok", name: " VẬT TƯ " }), dong({ id: "sai", name: "Vát tư" })],
      [bo()]
    );
    expect(kq.gan.map((g) => g.id)).toEqual(["ok"]);
    expect(kq.gan[0].tenGon).toBe("VẬT TƯ");
  });

  it("nhiều bộ nói CÙNG một điều thì vẫn gán", () => {
    const kq = ganTenGonNhom([dong({ id: "d1" })], [bo(), bo()]);
    expect(kq.gan).toHaveLength(1);
    expect(kq.mapMo).toEqual([]);
  });

  it("nhiều bộ nói KHÁC nhau thì không đoán — báo mập mờ", () => {
    const kq = ganTenGonNhom([dong({ id: "d1" })], [bo(), bo({ groupLabel: "Giằng" })]);
    expect(kq.gan).toEqual([]);
    expect(kq.mapMo).toEqual([{ id: "d1", name: "Vật tư", soPhuongAn: 2 }]);
  });
});
