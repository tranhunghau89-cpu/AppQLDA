import { describe, expect, it } from "vitest";
import { tinhKhoiLuongDanXuat, type DongThamSo, type PhanCay } from "./danXuat";

const PHAN: PhanCay[] = [
  { id: "A", parentId: null },
  { id: "B", parentId: null },
];

function d(p: Partial<DongThamSo> & { id: string }): DongThamSo {
  return {
    sectionId: "A",
    qty: null,
    napThamSo: null,
    layTuThamSo: null,
    heSoQuyDoi: 1,
    ...p,
  };
}

describe("tinhKhoiLuongDanXuat", () => {
  it("vận chuyển KCT bằng tổng thép của phần", () => {
    const kq = tinhKhoiLuongDanXuat(
      [
        d({ id: "toHop", napThamSo: "KCT_KG", qty: 8000 }),
        d({ id: "thepHinh", napThamSo: "KCT_KG", qty: 3000 }),
        d({ id: "xaGo", napThamSo: "KCT_KG", qty: 1500 }),
        d({ id: "vanChuyen", layTuThamSo: "KCT_KG" }),
        d({ id: "lapDung", layTuThamSo: "KCT_KG" }),
      ],
      PHAN
    );

    expect(kq.get("vanChuyen")!.khoiLuong).toBe(12500);
    expect(kq.get("lapDung")!.khoiLuong).toBe(12500);
    expect(kq.get("vanChuyen")!.tuDong).toEqual(["toHop", "thepHinh", "xaGo"]);
  });

  it("chỉ dòng dẫn xuất có mặt trong kết quả", () => {
    const kq = tinhKhoiLuongDanXuat(
      [
        d({ id: "toHop", napThamSo: "KCT_KG", qty: 8000 }),
        d({ id: "vit", qty: 500 }),
        d({ id: "vanChuyen", layTuThamSo: "KCT_KG" }),
      ],
      PHAN
    );
    expect([...kq.keys()]).toEqual(["vanChuyen"]);
  });

  it("mỗi tham số một dòng chảy riêng", () => {
    const kq = tinhKhoiLuongDanXuat(
      [
        d({ id: "thep", napThamSo: "KCT_KG", qty: 10000 }),
        d({ id: "ton", napThamSo: "TON_M2", qty: 600 }),
        d({ id: "vanChuyenKct", layTuThamSo: "KCT_KG" }),
        d({ id: "lopTon", layTuThamSo: "TON_M2" }),
      ],
      PHAN
    );
    expect(kq.get("vanChuyenKct")!.khoiLuong).toBe(10000);
    expect(kq.get("lopTon")!.khoiLuong).toBe(600);
  });

  it("hệ số quy đổi được nhân vào", () => {
    const kq = tinhKhoiLuongDanXuat(
      [
        d({ id: "thep", napThamSo: "KCT_KG", qty: 10000 }),
        d({ id: "haHang", layTuThamSo: "KCT_KG", heSoQuyDoi: 0.001 }),
      ],
      PHAN
    );
    expect(kq.get("haHang")!.khoiLuong).toBeCloseTo(10, 9);
  });

  describe("phạm vi là từng phần", () => {
    it("hai phần cùng dùng KCT_KG không cộng lẫn nhau", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thepA", sectionId: "A", napThamSo: "KCT_KG", qty: 10000 }),
          d({ id: "vcA", sectionId: "A", layTuThamSo: "KCT_KG" }),
          d({ id: "thepB", sectionId: "B", napThamSo: "KCT_KG", qty: 2000 }),
          d({ id: "vcB", sectionId: "B", layTuThamSo: "KCT_KG" }),
        ],
        PHAN
      );
      expect(kq.get("vcA")!.khoiLuong).toBe(10000);
      expect(kq.get("vcB")!.khoiLuong).toBe(2000);
    });

    it("mục con gộp về phần gốc", () => {
      const phan: PhanCay[] = [
        { id: "A", parentId: null },
        { id: "A1", parentId: "A" },
        { id: "A2", parentId: "A" },
      ];
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep1", sectionId: "A1", napThamSo: "KCT_KG", qty: 8000 }),
          d({ id: "thep2", sectionId: "A2", napThamSo: "KCT_KG", qty: 3000 }),
          d({ id: "vc", sectionId: "A1", layTuThamSo: "KCT_KG" }),
        ],
        phan
      );
      expect(kq.get("vc")!.khoiLuong).toBe(11000);
    });

    it("mục con lồng nhiều tầng vẫn về đúng gốc", () => {
      const phan: PhanCay[] = [
        { id: "A", parentId: null },
        { id: "A1", parentId: "A" },
        { id: "A1a", parentId: "A1" },
      ];
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", sectionId: "A1a", napThamSo: "KCT_KG", qty: 500 }),
          d({ id: "vc", sectionId: "A", layTuThamSo: "KCT_KG" }),
        ],
        phan
      );
      expect(kq.get("vc")!.khoiLuong).toBe(500);
    });
  });

  describe("chưa đủ dữ liệu", () => {
    it("chưa dòng nguồn nào có khối lượng thì trả null, không phải 0", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", napThamSo: "KCT_KG", qty: null }),
          d({ id: "vc", layTuThamSo: "KCT_KG" }),
        ],
        PHAN
      );
      expect(kq.get("vc")!.khoiLuong).toBeNull();
      expect(kq.get("vc")!.tuDong).toEqual([]);
    });

    it("không có dòng nguồn nào cho tham số đó thì trả null", () => {
      const kq = tinhKhoiLuongDanXuat([d({ id: "vc", layTuThamSo: "KCT_KG" })], PHAN);
      expect(kq.get("vc")!.khoiLuong).toBeNull();
    });

    it("một nguồn đã nhập, một nguồn còn trống thì cộng phần đã nhập", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "toHop", napThamSo: "KCT_KG", qty: 8000 }),
          d({ id: "thepHinh", napThamSo: "KCT_KG", qty: null }),
          d({ id: "vc", layTuThamSo: "KCT_KG" }),
        ],
        PHAN
      );
      expect(kq.get("vc")!.khoiLuong).toBe(8000);
      expect(kq.get("vc")!.tuDong).toEqual(["toHop"]);
    });

    it("khối lượng 0 vẫn là một con số đã nhập", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", napThamSo: "KCT_KG", qty: 0 }),
          d({ id: "vc", layTuThamSo: "KCT_KG" }),
        ],
        PHAN
      );
      expect(kq.get("vc")!.khoiLuong).toBe(0);
    });
  });

  describe("dữ liệu rác không lan ra", () => {
    it("khối lượng NaN hay vô cực bị loại khỏi tổng", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "toHop", napThamSo: "KCT_KG", qty: 8000 }),
          d({ id: "rac", napThamSo: "KCT_KG", qty: Number.NaN }),
          d({ id: "rac2", napThamSo: "KCT_KG", qty: Number.POSITIVE_INFINITY }),
          d({ id: "vc", layTuThamSo: "KCT_KG" }),
        ],
        PHAN
      );
      expect(kq.get("vc")!.khoiLuong).toBe(8000);
    });

    it("hệ số rác coi như 1", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", napThamSo: "KCT_KG", qty: 500 }),
          d({ id: "a", layTuThamSo: "KCT_KG", heSoQuyDoi: null }),
          d({ id: "b", layTuThamSo: "KCT_KG", heSoQuyDoi: Number.NaN }),
        ],
        PHAN
      );
      expect(kq.get("a")!.khoiLuong).toBe(500);
      expect(kq.get("b")!.khoiLuong).toBe(500);
    });

    it("hệ số 0 được tôn trọng chứ không đổi thành 1", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", napThamSo: "KCT_KG", qty: 500 }),
          d({ id: "vc", layTuThamSo: "KCT_KG", heSoQuyDoi: 0 }),
        ],
        PHAN
      );
      expect(kq.get("vc")!.khoiLuong).toBe(0);
    });

    it("dòng vừa nạp vừa lấy chỉ được coi là dòng lấy — không tự nuôi chính nó", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", napThamSo: "KCT_KG", qty: 500 }),
          d({ id: "vua", napThamSo: "KCT_KG", layTuThamSo: "KCT_KG", qty: 9999 }),
        ],
        PHAN
      );
      expect(kq.get("vua")!.khoiLuong).toBe(500);
      expect(kq.get("vua")!.tuDong).toEqual(["thep"]);
    });

    it("mục trỏ vòng về chính nó không làm treo", () => {
      const phan: PhanCay[] = [
        { id: "X", parentId: "Y" },
        { id: "Y", parentId: "X" },
      ];
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", sectionId: "X", napThamSo: "KCT_KG", qty: 100 }),
          d({ id: "vc", sectionId: "X", layTuThamSo: "KCT_KG" }),
        ],
        phan
      );
      expect(kq.get("vc")!.khoiLuong).toBe(100);
    });

    it("mục trỏ tới phần cha không còn thì tự nó là gốc", () => {
      const kq = tinhKhoiLuongDanXuat(
        [
          d({ id: "thep", sectionId: "Z", napThamSo: "KCT_KG", qty: 100 }),
          d({ id: "vc", sectionId: "Z", layTuThamSo: "KCT_KG" }),
        ],
        PHAN
      );
      expect(kq.get("vc")!.khoiLuong).toBe(100);
    });

    it("bảng rỗng trả bảng rỗng", () => {
      expect(tinhKhoiLuongDanXuat([], PHAN).size).toBe(0);
    });
  });
});
