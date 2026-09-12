import { describe, expect, it } from "vitest";
import {
  bocTachThuVien,
  ngayHieuLucTuTenFile,
  soSanhVoiThuVien,
  type CongTacNhap,
  type GiaHienCo,
  type SheetLike,
} from "./thuVien-parse";

/** Worksheet giả từ lưới [dòng][cột] 1-based — test không cần file Excel. */
function sheet(grid: Record<number, Record<number, unknown>>, rowCount: number): SheetLike {
  return {
    rowCount,
    getCell: (r, c) => ({ value: (grid[r]?.[c] ?? null) as never }),
  };
}

/** Một hàng DV đầy đủ: B..K. */
function hang(
  ma: string,
  ten: string,
  o: Partial<{ loai: string; tskt: string; dv: string; vt: number; ncm: number; hs: number; gt: number; gc: string }> = {}
): Record<number, unknown> {
  return {
    2: ma,
    3: ten,
    4: o.loai ?? null,
    5: o.tskt ?? null,
    6: o.dv ?? "kg",
    7: o.vt ?? null,
    8: o.ncm ?? null,
    9: o.hs ?? null,
    10: o.gt ?? null,
    11: o.gc ?? null,
  };
}

describe("ngayHieuLucTuTenFile", () => {
  it("dạng dài ngày+tháng+năm", () => {
    expect(ngayHieuLucTuTenFile("BG_NX_KL_HN_D2504_23")?.toISOString()).toBe(
      "2023-04-25T00:00:00.000Z"
    );
    expect(ngayHieuLucTuTenFile("BG_NX_KL_HN_D1312_25")?.toISOString()).toBe(
      "2025-12-13T00:00:00.000Z"
    );
  });

  it("dạng ngắn chỉ có tháng -> ngày mùng 1", () => {
    expect(ngayHieuLucTuTenFile("BG_NX_K30L72_HN_D08_26")?.toISOString()).toBe(
      "2026-08-01T00:00:00.000Z"
    );
  });

  it("còn đọc được khi có đuôi phía sau", () => {
    expect(ngayHieuLucTuTenFile("BG_NX_K35L35_PT_D2903_25 (ban sao)")?.toISOString()).toBe(
      "2025-03-29T00:00:00.000Z"
    );
  });

  it("tên không theo quy ước -> null, KHÔNG đoán", () => {
    expect(ngayHieuLucTuTenFile("bang gia moi nhat")).toBeNull();
    expect(ngayHieuLucTuTenFile("BG_NX_KL_HN")).toBeNull();
  });

  it("ngày/tháng vô lý -> null chứ không cuộn sang tháng sau", () => {
    expect(ngayHieuLucTuTenFile("BG_D3202_25")).toBeNull(); // 32/02
    expect(ngayHieuLucTuTenFile("BG_D3102_25")).toBeNull(); // 31/02 — Date sẽ tự cuộn
    expect(ngayHieuLucTuTenFile("BG_D0113_25")).toBeNull(); // tháng 13
  });
});

describe("bocTachThuVien", () => {
  it("bóc đúng một hàng đầy đủ", () => {
    const ws = sheet(
      {
        4: { 2: "MCV", 3: "ND" }, // tiêu đề — phải bị bỏ qua
        5: hang("AA.110", "Thép tổ hợp cột, kèo, dầm, SS400", {
          loai: "Thép tổ hợp",
          tskt: "SS400",
          dv: "kg",
          vt: 13454.5,
          ncm: 5000,
          hs: 1.03,
          gt: 19008.18,
          gc: "fy=2.450kG/cm2",
        }),
      },
      5
    );
    const kq = bocTachThuVien(ws);
    expect(kq.congTac).toHaveLength(1);
    expect(kq.congTac[0]).toMatchObject({
      ma: "AA.110",
      ten: "Thép tổ hợp cột, kèo, dầm, SS400",
      tenNgan: "Thép tổ hợp",
      quyCach: "SS400",
      donVi: "kg",
      donGia: 19008.18,
      ghiChu: "fy=2.450kG/cm2",
      sortOrder: 0,
    });
  });

  it("bỏ qua hàng không mang mã công việc", () => {
    const ws = sheet(
      {
        5: { 2: "STT", 3: "Tiêu đề lạc" },
        6: hang("AA.110", "Có mã"),
        7: { 2: "", 3: "Dòng trống mã" },
        8: { 2: "ABC", 3: "Mã sai dạng" },
      },
      8
    );
    expect(bocTachThuVien(ws).congTac.map((c) => c.ma)).toEqual(["AA.110"]);
  });

  it("tính đơn giá khi ô GT bỏ trống", () => {
    const ws = sheet({ 5: hang("AA.110", "X", { vt: 10000, ncm: 2000, hs: 1.05 }) }, 5);
    expect(bocTachThuVien(ws).congTac[0].donGia).toBeCloseTo(12600, 6);
  });

  it("thiếu hệ số thì coi như 1", () => {
    const ws = sheet({ 5: hang("AA.110", "X", { vt: 10000, ncm: 2000 }) }, 5);
    expect(bocTachThuVien(ws).congTac[0].donGia).toBe(12000);
  });

  it("không có VT lẫn NC_M lẫn GT -> giá null kèm cảnh báo, vẫn giữ công tác", () => {
    const ws = sheet({ 5: hang("AA.110", "X") }, 5);
    const kq = bocTachThuVien(ws);
    expect(kq.congTac).toHaveLength(1);
    expect(kq.congTac[0].donGia).toBeNull();
    expect(kq.canhBao.some((c) => c.includes("không có đơn giá"))).toBe(true);
  });

  it("mã trùng trong cùng file: giữ dòng ĐẦU, cảnh báo dòng sau", () => {
    const ws = sheet(
      {
        5: hang("AA.110", "Bản dùng", { gt: 100 }),
        6: hang("AA.110", "Bản nháp bỏ quên", { gt: 999 }),
      },
      6
    );
    const kq = bocTachThuVien(ws);
    expect(kq.congTac).toHaveLength(1);
    expect(kq.congTac[0].donGia).toBe(100);
    expect(kq.canhBao.some((c) => c.includes("AA.110") && c.includes("hàng 6"))).toBe(true);
  });

  it("mã viết thường vẫn nhận, và chuẩn hoá thành chữ hoa", () => {
    const ws = sheet({ 5: hang("aa.110", "X", { gt: 1 }) }, 5);
    expect(bocTachThuVien(ws).congTac[0].ma).toBe("AA.110");
  });

  it("hàng có mã nhưng không có tên -> bỏ kèm cảnh báo", () => {
    const ws = sheet({ 5: { 2: "AA.110", 3: "", 4: "" } }, 5);
    const kq = bocTachThuVien(ws);
    expect(kq.congTac).toHaveLength(0);
    expect(kq.canhBao.some((c) => c.includes("không có tên"))).toBe(true);
  });

  it("thiếu ND thì lùi về cột Loại", () => {
    const ws = sheet({ 5: { 2: "AA.110", 3: "", 4: "Tên dự phòng", 10: 5 } }, 5);
    expect(bocTachThuVien(ws).congTac[0].ten).toBe("Tên dự phòng");
  });

  it("sheet rỗng -> kết quả rỗng, không ném lỗi", () => {
    expect(bocTachThuVien(sheet({}, 0)).congTac).toEqual([]);
  });

  it("bỏ mã nhóm AL — đơn giá trọn gói theo m² cho cả hạng mục", () => {
    const ws = sheet(
      {
        5: hang("AA.110", "Thép tổ hợp", { gt: 19008 }),
        6: hang("AL.100", "Gia công, lắp dựng khung nhà thép và tôn mái", {
          dv: "m2",
          gt: 670000,
        }),
        7: hang("AL.510", "Cửa đẩy KT 6.0*5.0m", { dv: "m2", gt: 1000000 }),
      },
      7
    );
    const kq = bocTachThuVien(ws);
    expect(kq.congTac.map((c) => c.ma)).toEqual(["AA.110"]);
    expect(kq.soTronGoiM2).toBe(2);
    expect(kq.canhBao.some((c) => c.includes("trọn gói theo m²"))).toBe(true);
  });

  it("m² của nhóm KHÁC vẫn giữ — đơn vị không phải dấu hiệu nhận biết", () => {
    // AD/AF/AK có 18 mã tính theo m² trên bản thật, đều là công tác thật.
    const ws = sheet(
      {
        5: hang("AD.210", "Lợp mái tôn sóng", { dv: "m2", gt: 118000 }),
        6: hang("AK.410", "Thi công tôn sàn", { dv: "m2", gt: 25000 }),
        7: hang("AF.100", "Sàn decking", { dv: "m2", gt: 300000 }),
      },
      7
    );
    const kq = bocTachThuVien(ws);
    expect(kq.congTac.map((c) => c.ma)).toEqual(["AD.210", "AK.410", "AF.100"]);
    expect(kq.soTronGoiM2).toBe(0);
  });

  it("không có mã trọn gói nào thì không sinh cảnh báo thừa", () => {
    const ws = sheet({ 5: hang("AA.110", "X", { gt: 1 }) }, 5);
    const kq = bocTachThuVien(ws);
    expect(kq.soTronGoiM2).toBe(0);
    expect(kq.canhBao).toEqual([]);
  });
});

describe("soSanhVoiThuVien", () => {
  const nhap = (ma: string, donGia: number | null): CongTacNhap => ({
    ma,
    ten: "CT " + ma,
    tenNgan: null,
    quyCach: null,
    donVi: "kg",
    vatTu: null,
    nhanCongMay: null,
    heSo: null,
    donGia,
    ghiChu: null,
    sortOrder: 0,
  });
  const co = (ma: string, donGia: number | null): GiaHienCo => ({
    ma,
    donGia,
    daCoCongTac: true,
  });

  it("giá y hệt -> KHÔNG ĐỔI, không sinh bản giá mới", () => {
    const kq = soSanhVoiThuVien([nhap("AA.110", 19008)], [co("AA.110", 19008)]);
    expect(kq.dong[0].loai).toBe("KHONG_DOI");
    expect(kq.khongDoi).toBe(1);
    expect(kq.doiGia).toBe(0);
  });

  it("lệch dưới một đồng vẫn coi là không đổi", () => {
    // Ô Excel là số thực: 19008.181818... đọc lại có thể lệch ở hàng phần nghìn.
    const kq = soSanhVoiThuVien([nhap("AA.110", 19008.18)], [co("AA.110", 19008.1818)]);
    expect(kq.dong[0].loai).toBe("KHONG_DOI");
  });

  it("lệch từ một đồng trở lên là ĐỔI GIÁ", () => {
    const kq = soSanhVoiThuVien([nhap("AC.630", 32500)], [co("AC.630", 26500)]);
    expect(kq.dong[0]).toMatchObject({ loai: "DOI_GIA", giaCu: 26500, giaMoi: 32500 });
    expect(kq.doiGia).toBe(1);
  });

  it("mã chưa có trong thư viện -> CÔNG TÁC MỚI", () => {
    const kq = soSanhVoiThuVien([nhap("AZ.999", 1000)], []);
    expect(kq.dong[0].loai).toBe("CONG_TAC_MOI");
    expect(kq.congTacMoi).toBe(1);
  });

  it("công tác đã có nhưng chưa có bản giá nào -> GIÁ MỚI", () => {
    const kq = soSanhVoiThuVien([nhap("AA.110", 100)], [co("AA.110", null)]);
    expect(kq.dong[0].loai).toBe("GIA_MOI");
    expect(kq.doiGia).toBe(1);
  });

  it("file không có giá -> KHÔNG CÓ GIÁ, không tính là thay đổi", () => {
    const kq = soSanhVoiThuVien([nhap("AA.110", null)], [co("AA.110", 100)]);
    expect(kq.dong[0].loai).toBe("KHONG_CO_GIA");
    expect(kq.doiGia).toBe(0);
    expect(kq.khongDoi).toBe(1);
  });

  it("nhập lại đúng file vừa nhập thì không còn gì để ghi", () => {
    const ds = [nhap("AA.110", 19008), nhap("AA.120", 20600), nhap("AD.210", 118000)];
    const kq = soSanhVoiThuVien(ds, ds.map((c) => co(c.ma, c.donGia)));
    expect(kq.doiGia).toBe(0);
    expect(kq.congTacMoi).toBe(0);
    expect(kq.khongDoi).toBe(3);
  });

  it("đếm luôn khớp tổng số dòng", () => {
    const kq = soSanhVoiThuVien(
      [nhap("A.1", 1), nhap("B.2", 2), nhap("C.3", null), nhap("D.4", 4)],
      [co("A.1", 1), co("B.2", 99), co("C.3", 3)]
    );
    expect(kq.congTacMoi + kq.doiGia + kq.khongDoi).toBe(kq.dong.length);
    expect(kq.dong.length).toBe(4);
  });
});
