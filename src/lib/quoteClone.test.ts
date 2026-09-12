import { describe, expect, it } from "vitest";
import { dungBanSaoBaoGia, type NguonDong, type NguonPhan } from "./quoteClone";

/** Bộ đếm id giả: đoán được nên khẳng định được, khác hẳn cuid thật. */
function demId() {
  let n = 0;
  return () => `moi-${++n}`;
}

const phan = (p: Partial<NguonPhan> & { id: string }): NguonPhan => ({
  code: "A",
  name: "Phần A",
  kind: "PHAN",
  parentId: null,
  area: null,
  sortOrder: 0,
  ...p,
});

const dong = (d: Partial<NguonDong> & { sectionId: string }): NguonDong => ({
  workCode: null,
  name: "Dòng",
  unit: null,
  qty: null,
  baseCost: null,
  sellPrice: null,
  spec: null,
  note: null,
  napThamSo: null,
  layTuThamSo: null,
  heSoQuyDoi: null,
  sortOrder: 0,
  ...d,
});

const dung = (args: {
  sections: NguonPhan[];
  items?: NguonDong[];
  markup?: number;
  banGia?: Map<string, number | null>;
}) =>
  dungBanSaoBaoGia({
    quoteId: "bg-moi",
    sections: args.sections,
    items: args.items ?? [],
    markup: args.markup ?? 1,
    banGia: args.banGia ?? new Map(),
    idMoi: demId(),
  });

describe("dungBanSaoBaoGia", () => {
  it("cấp id mới cho từng phần và nối mục con vào ĐÚNG cha mới", () => {
    const kq = dung({
      sections: [
        phan({ id: "cu-A", code: "A" }),
        phan({ id: "cu-A1", code: "1", kind: "SUB", parentId: "cu-A", sortOrder: 1 }),
      ],
    });

    expect(kq.sections.map((s) => [s.id, s.code, s.parentId])).toEqual([
      ["moi-1", "A", null],
      ["moi-2", "1", "moi-1"],
    ]);
  });

  it("hai mục con TRÙNG MÃ ở hai phần khác nhau không nối lẫn vào nhau", () => {
    // Mã phần/mục do người dùng tự gõ, không có ràng buộc duy nhất: mục "1" nằm dưới
    // phần A và mục "1" nằm dưới phần B là chuyện thường ngày.
    const kq = dung({
      sections: [
        phan({ id: "cu-A", code: "A", sortOrder: 0 }),
        phan({ id: "cu-A1", code: "1", kind: "SUB", parentId: "cu-A", sortOrder: 1 }),
        phan({ id: "cu-B", code: "B", sortOrder: 2 }),
        phan({ id: "cu-B1", code: "1", kind: "SUB", parentId: "cu-B", sortOrder: 3 }),
      ],
      items: [
        dong({ sectionId: "cu-A1", name: "thuộc A.1" }),
        dong({ sectionId: "cu-B1", name: "thuộc B.1" }),
      ],
    });

    const idCua = new Map(kq.sections.map((s) => [s.id, s]));
    const cuaDong = (ten: string) => {
      const d = kq.items.find((x) => x.name === ten)!;
      const muc = idCua.get(d.sectionId)!;
      return [muc.code, idCua.get(muc.parentId!)!.code];
    };

    expect(cuaDong("thuộc A.1")).toEqual(["1", "A"]);
    expect(cuaDong("thuộc B.1")).toEqual(["1", "B"]);
  });

  it("xếp cha trước con dù bản nguồn liệt kê con trước", () => {
    const kq = dung({
      sections: [
        phan({ id: "cu-A1", code: "1", kind: "SUB", parentId: "cu-A", sortOrder: 9 }),
        phan({ id: "cu-A", code: "A", sortOrder: 0 }),
      ],
    });

    expect(kq.sections.map((s) => s.code)).toEqual(["A", "1"]);
    expect(kq.sections[1].parentId).toBe(kq.sections[0].id);
  });

  it("phần trỏ tới cha không còn trong bản nguồn thì thành phần gốc", () => {
    const kq = dung({ sections: [phan({ id: "cu-A", parentId: "khong-co" })] });
    expect(kq.sections[0].parentId).toBeNull();
  });

  it("lấy giá gốc theo BẢNG GIÁ HIỆN TẠI, không bê giá của bản nguồn", () => {
    const kq = dung({
      sections: [phan({ id: "cu-A" })],
      items: [dong({ sectionId: "cu-A", workCode: "CV01", baseCost: 100, sellPrice: 120 })],
      markup: 1.2,
      banGia: new Map([["CV01", 200]]),
    });

    expect(kq.items[0].baseCost).toBe(200);
    expect(kq.items[0].sellPrice).toBeCloseTo(240);
  });

  it("mã không có trong bảng giá thì giữ giá gốc của bản nguồn", () => {
    const kq = dung({
      sections: [phan({ id: "cu-A" })],
      items: [dong({ sectionId: "cu-A", workCode: "CV-LA", baseCost: 100 })],
      markup: 1.5,
      banGia: new Map([["CV01", 200]]),
    });

    expect(kq.items[0].baseCost).toBe(100);
    expect(kq.items[0].sellPrice).toBeCloseTo(150);
  });

  it("dòng gõ tay không có giá gốc thì giữ nguyên đơn giá bán đã gõ", () => {
    const kq = dung({
      sections: [phan({ id: "cu-A" })],
      items: [dong({ sectionId: "cu-A", workCode: null, baseCost: null, sellPrice: 777 })],
      markup: 2,
    });

    expect(kq.items[0].baseCost).toBeNull();
    expect(kq.items[0].sellPrice).toBe(777);
  });

  it("giữ quan hệ dẫn xuất để cước vận chuyển còn chạy theo khối lượng thép", () => {
    const kq = dung({
      sections: [phan({ id: "cu-A" })],
      items: [
        dong({ sectionId: "cu-A", name: "Thép", napThamSo: "kgThep" }),
        dong({ sectionId: "cu-A", name: "Vận chuyển", layTuThamSo: "kgThep", heSoQuyDoi: 0.5 }),
      ],
    });

    expect(kq.items[0].napThamSo).toBe("kgThep");
    expect(kq.items[1].layTuThamSo).toBe("kgThep");
    expect(kq.items[1].heSoQuyDoi).toBe(0.5);
  });

  it("bỏ dòng trỏ tới phần không còn trong bản nguồn", () => {
    const kq = dung({
      sections: [phan({ id: "cu-A" })],
      items: [dong({ sectionId: "cu-A" }), dong({ sectionId: "cu-mat", name: "mồ côi" })],
    });

    expect(kq.items).toHaveLength(1);
    expect(kq.items[0].name).toBe("Dòng");
  });

  it("mọi hàng đều mang quoteId của bản mới", () => {
    const kq = dung({
      sections: [phan({ id: "cu-A" })],
      items: [dong({ sectionId: "cu-A" })],
    });

    expect(kq.sections.every((s) => s.quoteId === "bg-moi")).toBe(true);
    expect(kq.items.every((d) => d.quoteId === "bg-moi")).toBe(true);
  });
});
