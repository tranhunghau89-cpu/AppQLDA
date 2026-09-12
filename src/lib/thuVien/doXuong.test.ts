import { describe, it, expect } from "vitest";
import { doXuongDuToan, type PhanNguon, type DongNguon } from "./doXuong";

function phan(p: Partial<PhanNguon> & { id: string }): PhanNguon {
  return {
    ma: p.id.toUpperCase(),
    ten: "Phần " + p.id,
    loai: p.parentId ? "SUB" : "PHAN",
    parentId: null,
    sortOrder: 0,
    ...p,
  };
}

function dong(d: Partial<DongNguon> & { id: string; sectionId: string }): DongNguon {
  return {
    ten: "Dòng " + d.id,
    donVi: "kg",
    khoiLuong: 10,
    giaVon: 1000,
    ghiChu: null,
    sortOrder: 0,
    congTacId: "ct1",
    donGiaId: "dg1",
    giaSuaTay: false,
    nhomChiPhi: "KCT",
    ...d,
  };
}

describe("doXuongDuToan — hình dạng cây", () => {
  it("PHẦN thành hạng mục, NHÓM tụt xuống groupLabel", () => {
    const kq = doXuongDuToan(
      [
        phan({ id: "a", ma: "A", ten: "PHẦN KHUNG VÀ MÁI", sortOrder: 0 }),
        phan({ id: "a1", ma: "I", ten: "Phần kết cấu thép", parentId: "a", sortOrder: 0 }),
      ],
      [dong({ id: "d1", sectionId: "a1" })]
    );

    expect(kq.hangMuc).toEqual([
      { khoa: "a", ma: "A", ten: "PHẦN KHUNG VÀ MÁI", sortOrder: 0 },
    ]);
    expect(kq.dong).toHaveLength(1);
    expect(kq.dong[0].hangMucKhoa).toBe("a");
    expect(kq.dong[0].groupLabel).toBe("Phần kết cấu thép");
  });

  it("mã nhóm trùng nhau giữa các phần vẫn tách đúng hạng mục", () => {
    // Đây chính là hình dạng dữ liệu thật: mọi phần đều có nhóm "I — Phần kết cấu thép".
    const kq = doXuongDuToan(
      [
        phan({ id: "a", ma: "A", ten: "PHẦN KHUNG", sortOrder: 0 }),
        phan({ id: "b", ma: "B", ten: "PHẦN VÁCH", sortOrder: 1 }),
        phan({ id: "a1", ma: "I", ten: "Phần kết cấu thép", parentId: "a", sortOrder: 0 }),
        phan({ id: "b1", ma: "I", ten: "Phần kết cấu thép", parentId: "b", sortOrder: 0 }),
      ],
      [dong({ id: "d1", sectionId: "a1" }), dong({ id: "d2", sectionId: "b1" })]
    );

    expect(kq.hangMuc.map((h) => h.ma)).toEqual(["A", "B"]);
    expect(kq.dong.map((d) => d.hangMucKhoa)).toEqual(["a", "b"]);
    // Cả hai vẫn mang cùng nhãn nhóm — nhãn trùng nhau là bình thường, hạng mục thì không.
    expect(kq.dong.every((d) => d.groupLabel === "Phần kết cấu thép")).toBe(true);
  });

  it("dòng nằm thẳng trong phần thì không có nhãn nhóm và đứng trước", () => {
    const kq = doXuongDuToan(
      [
        phan({ id: "f", ma: "F", ten: "VẬN CHUYỂN VÀ LẮP ĐẶT", sortOrder: 0 }),
        phan({ id: "f1", ma: "I", ten: "Nhóm phụ", parentId: "f", sortOrder: 0 }),
      ],
      [
        dong({ id: "trong-nhom", sectionId: "f1", sortOrder: 0 }),
        dong({ id: "thang", sectionId: "f", sortOrder: 1 }),
      ]
    );

    expect(kq.dong.map((d) => d.ten)).toEqual(["Dòng thang", "Dòng trong-nhom"]);
    expect(kq.dong[0].groupLabel).toBeNull();
    expect(kq.dong[1].groupLabel).toBe("Nhóm phụ");
  });

  it("trong một hạng mục: xếp theo nhóm trước, thứ tự dòng gốc sau", () => {
    const kq = doXuongDuToan(
      [
        phan({ id: "a", sortOrder: 0 }),
        phan({ id: "n1", ten: "Nhóm 1", parentId: "a", sortOrder: 0 }),
        phan({ id: "n2", ten: "Nhóm 2", parentId: "a", sortOrder: 1 }),
      ],
      [
        dong({ id: "n2-sau", sectionId: "n2", sortOrder: 3 }),
        dong({ id: "n1-sau", sectionId: "n1", sortOrder: 2 }),
        dong({ id: "n2-truoc", sectionId: "n2", sortOrder: 1 }),
        dong({ id: "n1-truoc", sectionId: "n1", sortOrder: 0 }),
      ]
    );

    expect(kq.dong.map((d) => d.ten)).toEqual([
      "Dòng n1-truoc",
      "Dòng n1-sau",
      "Dòng n2-truoc",
      "Dòng n2-sau",
    ]);
    expect(kq.dong.map((d) => d.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("hạng mục giữ thứ tự của bản gốc và đánh lại số liên tục", () => {
    const kq = doXuongDuToan(
      [
        phan({ id: "b", ma: "B", sortOrder: 5 }),
        phan({ id: "a", ma: "A", sortOrder: 1 }),
      ],
      [dong({ id: "d1", sectionId: "a" }), dong({ id: "d2", sectionId: "b" })]
    );
    expect(kq.hangMuc.map((h) => [h.ma, h.sortOrder])).toEqual([
      ["A", 0],
      ["B", 1],
    ]);
  });
});

describe("doXuongDuToan — những gì bị bỏ", () => {
  it("hạng mục rỗng bị bỏ kèm cảnh báo", () => {
    const kq = doXuongDuToan(
      [
        phan({ id: "a", ma: "A", ten: "Có dòng", sortOrder: 0 }),
        phan({ id: "z", ma: "Z", ten: "Rỗng", sortOrder: 1 }),
      ],
      [dong({ id: "d1", sectionId: "a" })]
    );
    expect(kq.hangMuc.map((h) => h.ma)).toEqual(["A"]);
    expect(kq.canhBao.some((c) => c.includes("Z — Rỗng"))).toBe(true);
  });

  it("phần chỉ chứa nhóm rỗng cũng bị bỏ", () => {
    const kq = doXuongDuToan(
      [phan({ id: "a" }), phan({ id: "a1", parentId: "a" })],
      []
    );
    expect(kq.hangMuc).toEqual([]);
    expect(kq.dong).toEqual([]);
  });

  it("dòng trỏ vào phần không tồn tại thì bỏ kèm cảnh báo", () => {
    const kq = doXuongDuToan(
      [phan({ id: "a" })],
      [dong({ id: "d1", sectionId: "a" }), dong({ id: "mo-coi", sectionId: "khong-co" })]
    );
    expect(kq.dong).toHaveLength(1);
    expect(kq.canhBao.some((c) => c.includes("Dòng mo-coi"))).toBe(true);
  });

  it("nhóm mất cha thì tự đứng làm hạng mục chứ không mất dòng", () => {
    const kq = doXuongDuToan(
      [phan({ id: "n", ma: "I", ten: "Nhóm lạc", parentId: "da-mat", sortOrder: 0 })],
      [dong({ id: "d1", sectionId: "n" })]
    );
    expect(kq.hangMuc.map((h) => h.ten)).toEqual(["Nhóm lạc"]);
    expect(kq.dong).toHaveLength(1);
    expect(kq.dong[0].groupLabel).toBeNull();
    expect(kq.canhBao.some((c) => c.includes("mất phần cha"))).toBe(true);
  });
});

describe("doXuongDuToan — tiền và xuất xứ", () => {
  it("thành tiền chỉ tính khi có đủ hai vế", () => {
    const kq = doXuongDuToan(
      [phan({ id: "a" })],
      [
        dong({ id: "du", sectionId: "a", khoiLuong: 3, giaVon: 100, sortOrder: 0 }),
        dong({ id: "thieu-kl", sectionId: "a", khoiLuong: null, giaVon: 100, sortOrder: 1 }),
        dong({ id: "thieu-gia", sectionId: "a", khoiLuong: 3, giaVon: null, sortOrder: 2 }),
      ]
    );
    expect(kq.dong.map((d) => d.thanhTien)).toEqual([300, null, null]);
  });

  it("không bao giờ trả NaN hay Infinity", () => {
    const kq = doXuongDuToan(
      [phan({ id: "a" })],
      [
        dong({ id: "nan", sectionId: "a", khoiLuong: Number.NaN, sortOrder: 0 }),
        dong({ id: "inf", sectionId: "a", giaVon: Number.POSITIVE_INFINITY, sortOrder: 1 }),
      ]
    );
    for (const d of kq.dong) {
      expect(d.khoiLuong === null || Number.isFinite(d.khoiLuong)).toBe(true);
      expect(d.donGia === null || Number.isFinite(d.donGia)).toBe(true);
      expect(d.thanhTien === null || Number.isFinite(d.thanhTien)).toBe(true);
    }
  });

  it("không tra được công tác thì về nhóm KHAC kèm cảnh báo", () => {
    const kq = doXuongDuToan(
      [phan({ id: "a" })],
      [dong({ id: "d1", sectionId: "a", nhomChiPhi: null, congTacId: null })]
    );
    expect(kq.dong[0].groupCode).toBe("KHAC");
    expect(kq.canhBao.some((c) => c.includes("không tra được công tác"))).toBe(true);
  });

  it("giá sửa tay thì KHÔNG gắn nguồn giá, nhưng vẫn giữ công tác", () => {
    const kq = doXuongDuToan(
      [phan({ id: "a" })],
      [dong({ id: "d1", sectionId: "a", giaSuaTay: true, donGiaId: "dg9", congTacId: "ct9" })]
    );
    expect(kq.dong[0].donGiaId).toBeNull();
    expect(kq.dong[0].congTacId).toBe("ct9");
    expect(kq.canhBao.some((c) => c.includes("giá sửa tay"))).toBe(true);
  });

  it("giá không sửa tay thì giữ nguyên nguồn giá", () => {
    const kq = doXuongDuToan([phan({ id: "a" })], [dong({ id: "d1", sectionId: "a" })]);
    expect(kq.dong[0].donGiaId).toBe("dg1");
    expect(kq.canhBao).toEqual([]);
  });
});

describe("doXuongDuToan — hàm thuần", () => {
  it("không sửa mảng của người gọi", () => {
    const phans = [phan({ id: "b", sortOrder: 5 }), phan({ id: "a", sortOrder: 1 })];
    const dongs = [
      dong({ id: "d2", sectionId: "b", sortOrder: 9 }),
      dong({ id: "d1", sectionId: "a", sortOrder: 0 }),
    ];
    const phansTruoc = phans.map((p) => p.id);
    const dongsTruoc = dongs.map((d) => d.id);

    doXuongDuToan(phans, dongs);

    expect(phans.map((p) => p.id)).toEqual(phansTruoc);
    expect(dongs.map((d) => d.id)).toEqual(dongsTruoc);
  });

  it("bản dự toán rỗng cho kết quả rỗng, không ném lỗi", () => {
    expect(doXuongDuToan([], [])).toEqual({ hangMuc: [], dong: [], canhBao: [] });
  });
});
