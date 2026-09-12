import { describe, expect, it } from "vitest";
import { bocBangChiTiet, type SheetLike } from "./bocChiTiet-parse";

/** Worksheet giả từ lưới [dòng][cột] 1-based — test không cần file Excel. */
function sheet(grid: Record<number, Record<number, unknown>>, rowCount: number, columnCount = 14): SheetLike {
  return {
    rowCount,
    columnCount,
    getCell: (r, c) => ({ value: (grid[r]?.[c] ?? null) as never }),
  };
}

/** Dựng lưới từ mảng các hàng, bắt đầu ở dòng `tu`. */
function luoi(hang: unknown[][], tu = 1): Record<number, Record<number, unknown>> {
  const g: Record<number, Record<number, unknown>> = {};
  hang.forEach((h, i) => {
    const row: Record<number, unknown> = {};
    h.forEach((v, j) => {
      if (v !== undefined) row[j + 1] = v;
    });
    g[tu + i] = row;
  });
  return g;
}

// ---------- Bảng thống kê kết cấu ----------

const TD_KET_CAU = [
  "Ma So", "So Luong", "Qui Cach", "Ten Cau Kien", "Dai",
  "Dien Tich", "Tong DT", "KL Don", "Tong KL", "Vat Tu", "Ma BV", "Rev",
];

function sheetKetCau(dong: unknown[][], tren: unknown[][] = []) {
  const hang = [...tren, TD_KET_CAU, ...dong];
  return sheet(luoi(hang), hang.length);
}

describe("bảng thống kê kết cấu", () => {
  it("đọc đúng dòng đầu của bảng thật", () => {
    const kq = bocBangChiTiet(
      sheetKetCau([
        ["AC1.1", 12, "PL6*700", "Cot", 6336, 12.77, 153.27, 351.91, 4222.9, "SS400"],
      ])
    );

    expect(kq.loai).toBe("KET_CAU");
    expect(kq.canhBao).toEqual([]);
    expect(kq.dong).toHaveLength(1);
    expect(kq.dong[0]).toMatchObject({
      maSo: "AC1.1",
      soLuong: 12,
      quyCach: "PL6*700",
      tenCauKien: "Cot",
      nhom: "Cot",
      dai: 6336,
      klDon: 351.91,
      vatTu: "SS400",
    });
  });

  it("lấy DIỆN TÍCH của một cái, không lấy nhầm TỔNG DT", () => {
    const kq = bocBangChiTiet(
      sheetKetCau([["AC1.1", 12, "PL6*700", "Cot", 6336, 12.77, 153.27, 351.91, 4222.9, "SS400"]])
    );
    expect(kq.dong[0].dienTichDon).toBe(12.77);
  });

  it("lấy KL ĐƠN của một cái, không lấy nhầm TỔNG KL", () => {
    const kq = bocBangChiTiet(
      sheetKetCau([["BR1.1", 4, "[]150*3", "GiangDoc", 7874, 4.81, 19.23, 113.2, 452.82, "SS400"]])
    );
    expect(kq.dong[0].klDon).toBe(113.2);
    expect(kq.dong[0].soLuong).toBe(4);
  });

  it("đọc nhiều dòng và giữ nguyên thứ tự", () => {
    const kq = bocBangChiTiet(
      sheetKetCau([
        ["AC1.1", 12, "PL6*700", "Cot", 6336, 12.77, 153.27, 351.91, 4222.9, "SS400"],
        ["AH1.1", 1, "FLAT6*250", "Cot", 6678, 8.76, 8.76, 206.42, 206.42, "SS400"],
        ["BM.1", 1, "FLAT6*300", "Dam", 7673, 11.65, 11.65, 319.41, 319.41, "SS400"],
      ])
    );
    expect(kq.dong.map((d) => d.maSo)).toEqual(["AC1.1", "AH1.1", "BM.1"]);
    expect(kq.dong.map((d) => d.nhom)).toEqual(["Cot", "Cot", "Dam"]);
  });

  it("đọc tên công trình từ khối thông tin phía trên", () => {
    const kq = bocBangChiTiet(
      sheetKetCau(
        [["AC1.1", 12, "PL6*700", "Cot", 6336, 12.77, 153.27, 351.91, 4222.9, "SS400"]],
        [["MA SO", "PROJ No.1"], ["TEN CT", "K26L56"], ["NGAY", "19.06.2026"], []]
      )
    );
    expect(kq.tenCongTrinh).toBe("K26L56");
  });

  it("bỏ dòng trống xen giữa, dừng ở dòng Tổng cộng", () => {
    const kq = bocBangChiTiet(
      sheetKetCau([
        ["AC1.1", 12, "PL6*700", "Cot", 6336, 12.77, 153.27, 351.91, 4222.9, "SS400"],
        [],
        ["AH1.1", 1, "FLAT6*250", "Cot", 6678, 8.76, 8.76, 206.42, 206.42, "SS400"],
        ["Tổng cộng", 13],
        ["RAC", 99],
      ])
    );
    expect(kq.dong.map((d) => d.maSo)).toEqual(["AC1.1", "AH1.1"]);
  });

  it("cột bị chèn thêm không làm lệch — dò theo nhãn chứ không theo vị trí", () => {
    const hang = [
      ["Ghi chu", "Ma So", "So Luong", "Qui Cach", "Ten Cau Kien", "Dai", "Dien Tich", "Tong DT", "KL Don", "Tong KL", "Vat Tu"],
      ["x", "AC1.1", 12, "PL6*700", "Cot", 6336, 12.77, 153.27, 351.91, 4222.9, "SS400"],
    ];
    const kq = bocBangChiTiet(sheet(luoi(hang), hang.length));
    expect(kq.dong[0]).toMatchObject({ maSo: "AC1.1", soLuong: 12, klDon: 351.91 });
  });
});

// ---------- Bảng bóc tôn ----------

const TD_TON = ["STT", "Tên hàng, quy cách", "Chiều dài (mm)", "SL", "Đơn Vị", "Tổng Dài (m)", "Ghi chú"];

function sheetTon(dong: unknown[][], tren: unknown[][] = []) {
  const hang = [...tren, TD_TON, ...dong];
  return sheet(luoi(hang), hang.length, 7);
}

describe("bảng bóc tôn", () => {
  it("đọc mã, chiều dài, số lượng và gom theo trục", () => {
    const kq = bocBangChiTiet(
      sheetTon([
        [undefined, "TÔN ...  DÀY 0.4MM, CÁN 09 SÓNG KHỔ HỮU DỤNG 1000MM, MÀU ..."],
        [undefined, "I. TRỤC Y1, Y5"],
        [1, "V1.1", 3170, 112, "Tấm", 355.0],
        [undefined, "II. TRỤC X1"],
        [2, "V2.1", 2370, 2, "Tấm", 4.7],
        [3, "V2.2", 2520, 2, "Tấm", 5.0],
      ])
    );

    expect(kq.loai).toBe("TON");
    expect(kq.dong).toHaveLength(3);
    expect(kq.dong[0]).toMatchObject({ maSo: "V1.1", dai: 3170, soLuong: 112, nhom: "I. TRỤC Y1, Y5" });
    expect(kq.dong[1]).toMatchObject({ maSo: "V2.1", dai: 2370, soLuong: 2, nhom: "II. TRỤC X1" });
    expect(kq.dong[2].nhom).toBe("II. TRỤC X1");
  });

  it("dòng quy cách chung được ghi vào từng dòng", () => {
    const kq = bocBangChiTiet(
      sheetTon([
        [undefined, "TÔN ...  DÀY 0.4MM, CÁN 09 SÓNG KHỔ HỮU DỤNG 1000MM, MÀU ..."],
        [undefined, "I. TRỤC Y1, Y5"],
        [1, "V1.1", 3170, 112, "Tấm", 355.0],
      ])
    );
    expect(kq.dong[0].quyCach).toContain("0.4MM");
    expect(kq.dong[0].quyCach).toContain("KHỔ HỮU DỤNG 1000MM");
  });

  it("dừng ở dòng Tổng cộng, không cộng đôi", () => {
    const kq = bocBangChiTiet(
      sheetTon([
        [undefined, "I. TRỤC Y1, Y5"],
        [1, "V1.1", 3170, 112, "Tấm", 355.0],
        [undefined, "Tổng cộng", undefined, 164, undefined, 551],
      ])
    );
    expect(kq.dong).toHaveLength(1);
    expect(kq.dong[0].soLuong).toBe(112);
  });

  it("đọc công trình, hạng mục, địa điểm từ khối thông tin", () => {
    const kq = bocBangChiTiet(
      sheetTon(
        [[1, "V1.1", 3170, 112, "Tấm", 355.0]],
        [["Công trình:", undefined, "NX_K26L56"], ["Hạng mục:", undefined, "TÔN VÁCH"], ["Địa điểm:", undefined, "Nghệ An"], []]
      )
    );
    expect(kq.tenCongTrinh).toBe("NX_K26L56");
    expect(kq.hangMuc).toBe("TÔN VÁCH");
    expect(kq.diaDiem).toBe("Nghệ An");
  });

  it("gom được theo nhóm không phải trục — nhận dòng nhóm bằng “không có số”", () => {
    const kq = bocBangChiTiet(
      sheetTon([
        [undefined, "MÁI TRƯỚC"],
        [1, "M1.1", 6000, 20, "Tấm", 120],
        [undefined, "TƯỜNG HỒI"],
        [2, "H1.1", 4000, 10, "Tấm", 40],
      ])
    );
    expect(kq.dong.map((d) => d.nhom)).toEqual(["MÁI TRƯỚC", "TƯỜNG HỒI"]);
  });
});

// ---------- Không nhận ra ----------

describe("file lạ", () => {
  it("không có dòng tiêu đề nào thì từ chối kèm chỉ dẫn, không đoán bừa", () => {
    const hang = [["Tên", "Giá"], ["Xi măng", 100000]];
    const kq = bocBangChiTiet(sheet(luoi(hang), hang.length, 2));
    expect(kq.loai).toBeNull();
    expect(kq.dong).toEqual([]);
    expect(kq.canhBao[0]).toContain("Không nhận ra bảng này");
  });

  it("sheet rỗng không làm vỡ", () => {
    const kq = bocBangChiTiet(sheet({}, 0, 5));
    expect(kq.loai).toBeNull();
    expect(kq.dong).toEqual([]);
  });

  it("có tiêu đề nhưng không có dòng nào thì cảnh báo rõ", () => {
    const kq = bocBangChiTiet(sheetKetCau([]));
    expect(kq.loai).toBe("KET_CAU");
    expect(kq.dong).toEqual([]);
    expect(kq.canhBao.join(" ")).toContain("Không đọc được dòng dữ liệu nào");
  });
});
