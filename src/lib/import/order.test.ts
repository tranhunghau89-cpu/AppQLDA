import { describe, expect, it } from "vitest";
import {
  bocTachDonHang,
  bocTachSheet,
  danhMucTuTen,
  doCot,
  ganAnhVaoDong,
  kichThuocTuTen,
  ngayTuTen,
  tenSheetSach,
  type DongDonHang,
  type OrderSheetLike,
} from "./order-parse";

/** Dựng một sheet giả từ lưới [dòng][cột] 1-based. */
function sheet(
  name: string,
  grid: Record<number, Record<number, unknown>>,
  rowCount: number,
  columnCount = 12
): OrderSheetLike {
  return {
    name,
    rowCount,
    columnCount,
    getCell: (r, c) => ({ value: (grid[r]?.[c] ?? null) as never }),
  };
}

/** Sheet đặt hàng tối thiểu: marker, dòng tiêu đề, rồi các dòng vật tư. */
function sheetDatHang(
  name: string,
  extra: Record<number, Record<number, unknown>> = {},
  rowCount = 20
): OrderSheetLike {
  return sheet(
    name,
    {
      1: { 1: "PHIẾU ĐẶT HÀNG" },
      3: { 1: "STT", 2: "Tên hàng", 3: "Đơn vị", 4: "SL", 5: "Đơn giá", 6: "Thành tiền", 7: "Trọng lượng", 8: "Ghi chú" },
      4: { 1: "A", 2: "HM Khung mái" },
      5: { 1: "1", 2: "Tôn mạ màu 0.45", 3: "m", 4: 100, 5: 50_000, 6: 5_000_000, 7: 320 },
      6: { 1: "2", 2: "Diềm mái", 3: "m", 4: 20, 5: 60_000, 6: 1_200_000, 7: 45 },
      ...extra,
    },
    rowCount
  );
}

describe("tenSheetSach", () => {
  it("bỏ tiền tố đánh số", () => {
    expect(tenSheetSach("1. Tôn mái")).toBe("Tôn mái");
    expect(tenSheetSach("  2.  BLLK ")).toBe("BLLK");
    expect(tenSheetSach("Diềm")).toBe("Diềm");
  });
});

describe("danhMucTuTen", () => {
  it("nhận diện bốn loại đơn từ tên file", () => {
    expect(danhMucTuTen("26_0420_DH_KCT_K16L20.xlsx")).toBe("KCT");
    expect(danhMucTuTen("26_0420_DH_XG_K16L20.xlsx")).toBe("XA_GO");
    expect(danhMucTuTen("26_0507_DH_TON_K16L20.xlsx")).toBe("TON");
  });

  // Đơn vật tư phụ có quá nhiều biến thể tên (BL, panel, cửa lùa, phụ kiện...) nên
  // VTP là nhánh mặc định, không phải một từ khóa riêng.
  it("mọi thứ không nhận ra đều về VTP thay vì báo lỗi", () => {
    expect(danhMucTuTen("26_0507_DH_BL_K16L20.xlsx")).toBe("VTP");
    expect(danhMucTuTen("26_0616_DH_PK_Panel_PickLang.xlsx")).toBe("VTP");
    expect(danhMucTuTen("file la hoac.xlsx")).toBe("VTP");
  });

  it("xà gồ được kiểm trước tôn", () => {
    expect(danhMucTuTen("DH_XG_TON_K1L1.xlsx")).toBe("XA_GO");
  });
});

describe("ngayTuTen", () => {
  it("đọc ngày từ tiền tố tên file", () => {
    expect(ngayTuTen("26_0507_DH_BL_K16L20")).toEqual(new Date(2026, 4, 7));
  });

  it("không có tiền tố ngày thì trả null", () => {
    expect(ngayTuTen("DH_BL_K16L20")).toBeNull();
  });

  // new Date(2026, 1, 31) tự trôi sang 03/03 mà không báo gì — phải tự chặn.
  it("ngày không tồn tại thì trả null, không trôi sang tháng sau", () => {
    expect(ngayTuTen("26_0231_DH_BL")).toBeNull();
    expect(ngayTuTen("26_1332_DH_BL")).toBeNull();
  });
});

describe("kichThuocTuTen", () => {
  it("rút K##L## và viết hoa", () => {
    expect(kichThuocTuTen("26_0507_DH_TON_k16l20")).toBe("K16L20");
    expect(kichThuocTuTen("26_0420_DH_TON_KL")).toBeNull();
  });
});

describe("doCot", () => {
  it("dò được vị trí từng cột từ dòng tiêu đề", () => {
    const col = doCot(sheetDatHang("Tôn"), 3);
    expect(col).toMatchObject({ name: 2, unit: 3, qty: 4, price: 5, amount: 6, weight: 7, note: 8 });
  });

  // Mỗi file đặt hàng một kiểu cột nên không được cố định chỉ số.
  it("cột đảo thứ tự vẫn dò đúng", () => {
    const ws = sheet("X", { 2: { 1: "STT", 3: "Thành tiền", 5: "Quy cách", 7: "SL" } }, 5);
    const col = doCot(ws, 2);
    expect(col.amount).toBe(3);
    expect(col.name).toBe(5);
    expect(col.qty).toBe(7);
  });

  it("thiếu cột thì bỏ trống, không đoán bừa", () => {
    const col = doCot(sheet("X", { 2: { 1: "STT", 2: "Tên hàng" } }, 5), 2);
    expect(col.name).toBe(2);
    expect(col.weight).toBeUndefined();
  });
});

describe("bocTachSheet", () => {
  it("bóc dòng vật tư và gán hạng mục theo dòng chữ cái phía trên", () => {
    const r = bocTachSheet(sheetDatHang("Tôn mái"), "Tôn mái", 0, 0);
    expect(r.headerRow).toBe(3);
    expect(r.dong).toHaveLength(2);
    expect(r.dong[0]).toMatchObject({
      category: "Tôn mái",
      groupName: "HM Khung mái",
      name: "Tôn mạ màu 0.45",
      qty: 100,
      amount: 5_000_000,
      weight: 320,
      sortOrder: 0,
      row: 5,
    });
  });

  // Sheet phụ (bảng tra, ghi chú) không phải lỗi — bỏ qua và nói lý do.
  it("sheet không có marker ĐẶT HÀNG thì bỏ qua kèm lý do", () => {
    const r = bocTachSheet(sheet("Data1", { 1: { 1: "Bảng tra" } }, 5), "Data1", 0, 0);
    expect(r.dong).toEqual([]);
    expect(r.boQua).toContain("ĐẶT HÀNG");
  });

  it("có marker nhưng không có dòng STT cũng bỏ qua", () => {
    const r = bocTachSheet(sheet("X", { 1: { 1: "PHIẾU ĐẶT HÀNG" } }, 5), "X", 0, 0);
    expect(r.boQua).toContain("STT");
  });

  it("dừng ở dòng Tổng, không nuốt dòng tổng thành vật tư", () => {
    const ws = sheetDatHang("T", { 7: { 1: "Tổng cộng", 4: 999, 7: 999 } });
    const r = bocTachSheet(ws, "T", 0, 0);
    expect(r.dong.map((d) => d.name)).not.toContain("Tổng cộng");
    expect(r.dong).toHaveLength(2);
  });

  // Dòng không có cả SL lẫn trọng lượng là dòng trang trí / để trống.
  it("bỏ dòng không có cả số lượng lẫn trọng lượng", () => {
    const ws = sheetDatHang("T", { 7: { 1: "3", 2: "Dòng trống", 3: "m" } });
    expect(bocTachSheet(ws, "T", 0, 0).dong).toHaveLength(2);
  });

  it("giữ dòng chỉ có trọng lượng, không có số lượng", () => {
    const ws = sheetDatHang("T", { 7: { 1: "3", 2: "Thép tấm", 7: 500 } });
    const r = bocTachSheet(ws, "T", 0, 0);
    expect(r.dong).toHaveLength(3);
    expect(r.dong[2]).toMatchObject({ name: "Thép tấm", qty: null, weight: 500 });
  });

  it("sortOrder chạy tiếp từ startSort để nối nhiều sheet", () => {
    const r = bocTachSheet(sheetDatHang("T"), "T", 10, 2);
    expect(r.dong.map((d) => d.sortOrder)).toEqual([10, 11]);
    expect(r.dong.every((d) => d.si === 2)).toBe(true);
  });
});

describe("bocTachDonHang", () => {
  it("ghép nhiều sheet thành một đơn, sortOrder liên tục", () => {
    const kq = bocTachDonHang(
      [sheetDatHang("1. Tôn mái"), sheetDatHang("2. Diềm")],
      "26_0507_DH_TON_K16L20.xlsx"
    );
    expect(kq.dong).toHaveLength(4);
    expect(kq.dong.map((d) => d.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(kq.dong[2].category).toBe("Diềm");
    expect(kq.orderNo).toBe("26_0507_DH_TON_K16L20");
    expect(kq.category).toBe("TON");
    expect(kq.dims).toBe("K16L20");
    expect(kq.orderDate).toEqual(new Date(2026, 4, 7));
  });

  it("cộng tổng tiền và tổng trọng lượng", () => {
    const kq = bocTachDonHang([sheetDatHang("T")], "x.xlsx");
    expect(kq.tongTien).toBe(6_200_000);
    expect(kq.tongTrongLuong).toBe(365);
  });

  // File thật luôn kèm Data1/Data2/STD Cáp; báo từng sheet một sẽ ngập cảnh báo.
  it("gộp các sheet bị bỏ qua thành MỘT cảnh báo", () => {
    const kq = bocTachDonHang(
      [sheetDatHang("Tôn"), sheet("Data1", {}, 3), sheet("Data2", {}, 3), sheet("STD Cáp", {}, 3)],
      "x.xlsx"
    );
    const boQua = kq.canhBao.filter((c) => c.includes("Bỏ qua"));
    expect(boQua).toHaveLength(1);
    expect(boQua[0]).toContain("3 sheet");
  });

  it("không có sheet đặt hàng nào thì báo rõ điều kiện file phải có", () => {
    const kq = bocTachDonHang([sheet("Data1", {}, 3)], "x.xlsx");
    expect(kq.dong).toEqual([]);
    expect(kq.canhBao[0]).toContain("ĐẶT HÀNG");
  });

  // Đơn hàng thật trong kho phần lớn KHÔNG có cột thành tiền — chỉ theo dõi khối
  // lượng. Đó là hợp lệ, nhưng phải nói ra để không ai tưởng giá trị đơn bị mất.
  it("đơn không có thành tiền thì nói rõ giá trị = 0, không coi là lỗi", () => {
    const ws = sheet(
      "T",
      {
        1: { 1: "ĐẶT HÀNG" },
        3: { 1: "STT", 2: "Tên hàng", 4: "SL", 7: "Trọng lượng" },
        4: { 1: "1", 2: "Tôn", 4: 10, 7: 100 },
      },
      6
    );
    const kq = bocTachDonHang([ws], "x.xlsx");
    expect(kq.dong).toHaveLength(1);
    expect(kq.tongTien).toBe(0);
    expect(kq.canhBao.join(" ")).toContain("chỉ theo dõi khối lượng");
  });

  it("chỉ một phần dòng thiếu thành tiền thì báo tỷ lệ", () => {
    const kq = bocTachDonHang([sheetDatHang("T", { 7: { 1: "3", 2: "Thép", 7: 50 } })], "x.xlsx");
    expect(kq.canhBao.join(" ")).toContain("1/3 dòng không có thành tiền");
  });
});

describe("ganAnhVaoDong", () => {
  const dong = [
    { si: 0, row: 5, sortOrder: 0 },
    { si: 0, row: 9, sortOrder: 1 },
    { si: 1, row: 4, sortOrder: 2 },
  ] as DongDonHang[];

  it("gắn ảnh vào dòng gần nhất PHÍA TRÊN trong cùng sheet", () => {
    expect(ganAnhVaoDong(dong, [{ si: 0, anchorRow: 10 }])).toEqual([1]);
    expect(ganAnhVaoDong(dong, [{ si: 0, anchorRow: 6 }])).toEqual([0]);
  });

  it("không lẫn sang sheet khác", () => {
    expect(ganAnhVaoDong(dong, [{ si: 1, anchorRow: 99 }])).toEqual([2]);
  });

  // Thà gắn hơi lệch còn hơn mất ảnh biên dạng.
  it("ảnh nằm trên mọi dòng thì gắn vào dòng đầu tiên", () => {
    expect(ganAnhVaoDong(dong, [{ si: 0, anchorRow: 1 }])).toEqual([0]);
  });

  it("sheet không có dòng vật tư nào thì trả -1", () => {
    expect(ganAnhVaoDong(dong, [{ si: 7, anchorRow: 3 }])).toEqual([-1]);
  });
});
