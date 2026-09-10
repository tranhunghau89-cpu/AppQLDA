import { describe, expect, it } from "vitest";
import type { SheetLike } from "./cells";
import {
  bocTachThcp,
  khopDuAn,
  laSoGiaThanh,
  loiKichThuoc,
  loiKichThuocRong,
  soKichThuoc,
} from "./thcp-parse";

/** Dựng một worksheet giả từ lưới [dòng][cột] 1-based, để test không cần file Excel. */
function sheet(
  grid: Record<number, Record<number, unknown>>,
  rowCount: number,
  columnCount = 12
): SheetLike {
  return {
    rowCount,
    columnCount,
    getCell: (r, c) => ({ value: (grid[r]?.[c] ?? null) as never }),
  };
}

/** Khung file quyết toán tối thiểu: đầu đề, khối tài chính, bảng nhóm, phần chi tiết. */
function quyetToan(extra: Record<number, Record<number, unknown>> = {}, rowCount = 40): SheetLike {
  return sheet(
    {
      2: { 2: "CĐT", 3: "Công ty Sơn Việt" },
      3: { 2: "Kích thước", 4: "K20L50" },
      4: { 2: "Vị trí", 4: "Ba Vì" },
      9: { 2: "Doanh Thu", 3: 1_000_000_000, 4: 400_000_000, 5: 900_000_000, 7: 100_000_000 },
      10: { 2: "Chi phí", 3: 800_000_000 },
      11: { 2: "LNTT", 3: 200_000_000 },
      12: { 2: "VAT được nhận thêm", 3: 5_000_000 },
      14: { 1: "Mã", 2: "Hạng mục", 3: "NCC", 4: "Giá trị", 5: "Thanh toán", 6: "Hóa đơn" },
      15: { 1: "A", 2: "Kết cấu thép", 3: "Hòa Phát", 4: 500_000_000, 5: 500_000_000, 6: 1 },
      16: { 1: "G", 2: "Lắp dựng", 3: "Đội anh Tú", 4: 300_000_000, 5: 200_000_000, 6: 0 },
      20: { 1: "CHI TIẾT CHI PHÍ" },
      21: { 1: "Mã", 2: "Hạng Mục", 3: "KL", 4: "Đơn giá", 5: "Thành tiền" },
      22: { 1: "A" },
      23: { 2: "Thép hình H350", 3: 20, 4: 20_000_000, 5: 400_000_000, 6: "HĐ 12/5", 7: "đã về" },
      24: { 2: "Thép tấm", 3: 5, 4: 20_000_000, 5: 100_000_000 },
      25: { 1: "G" },
      26: { 2: "Công lắp dựng", 3: 1000, 4: 300_000, 5: 300_000_000 },
      ...extra,
    },
    rowCount
  );
}

describe("nhận dạng kích thước", () => {
  it("rút K##L## ở giữa chuỗi", () => {
    expect(loiKichThuoc("Nhà xưởng K20L50 Ba Vì")).toBe("K20L50");
    expect(loiKichThuoc("K 25 L 60")).toBe("K25L60");
    expect(loiKichThuoc("Không có gì")).toBeNull();
  });

  it("dạng rộng nhận thêm 20x50, dạng hẹp thì không", () => {
    expect(loiKichThuocRong("THCP 20x50 Ba Vì")).toBe("K20L50");
    expect(loiKichThuoc("THCP 20x50 Ba Vì")).toBeNull();
  });

  it("tách K và L thành số", () => {
    expect(soKichThuoc("K20L50")).toEqual({ k: 20, l: 50 });
    expect(soKichThuoc("Nhà kho")).toEqual({ k: null, l: null });
  });
});

describe("laSoGiaThanh", () => {
  it("nhận ra tiêu đề sổ giá thành ở bất kỳ ô nào trong 8 dòng đầu", () => {
    expect(laSoGiaThanh(sheet({ 3: { 5: "SỔ GIÁ THÀNH XÂY DỰNG" } }, 10))).toBe(true);
  });

  it("không nhầm file quyết toán thành sổ", () => {
    expect(laSoGiaThanh(quyetToan())).toBe(false);
  });

  // Tiêu đề nằm dưới dòng 8 thì coi như không phải sổ — cố ý giới hạn vùng quét để
  // một ô nào đó ở giữa bảng không kéo cả file sang nhánh bóc tách sai.
  it("chỉ quét 8 dòng đầu", () => {
    expect(laSoGiaThanh(sheet({ 9: { 1: "SỔ GIÁ THÀNH" } }, 20))).toBe(false);
  });
});

describe("bocTachThcp — dạng quyết toán", () => {
  const kq = bocTachThcp(quyetToan(), "THCP 20x50 Ba Vi.xlsx");

  it("nhận đúng dạng file và thông tin dự án", () => {
    expect(kq.dang).toBe("quyet-toan");
    expect(kq.dims).toBe("K20L50");
    expect(kq.location).toBe("Ba Vì");
    expect(kq.customer).toBe("Công ty Sơn Việt");
  });

  it("bóc đủ khối tài chính, kể cả các cột đã chi / đã thu / còn phải thu", () => {
    expect(kq.fin).toMatchObject({
      revenue: 1_000_000_000,
      cost: 800_000_000,
      profit: 200_000_000,
      extraVat: 5_000_000,
      paid: 400_000_000,
      collected: 900_000_000,
      receivable: 100_000_000,
    });
  });

  it("bóc bảng tổng hợp hạng mục", () => {
    expect(kq.nhom).toHaveLength(2);
    expect(kq.nhom[0]).toMatchObject({ code: "A", supplier: "Hòa Phát", value: 500_000_000 });
  });

  it("gán dòng chi tiết vào nhóm gần nhất phía trên, bỏ dòng subtotal", () => {
    expect(kq.dong).toHaveLength(3);
    expect(kq.dong.map((d) => d.cat)).toEqual(["A", "A", "G"]);
    expect(kq.dong[0]).toMatchObject({ name: "Thép hình H350", amount: 400_000_000, ref: "HĐ 12/5" });
    expect(kq.dong[2].cat).toBe("G");
  });

  it("không cảnh báo khi tổng chi tiết khớp ô Chi phí", () => {
    expect(kq.canhBao).toEqual([]);
  });
});

describe("bocTachThcp — cảnh báo dạng quyết toán", () => {
  it("báo khi tổng chi tiết lệch quá 1% so với ô Chi phí trong file", () => {
    const kq = bocTachThcp(quyetToan({ 10: { 2: "Chi phí", 3: 500_000_000 } }), "x.xlsx");
    expect(kq.canhBao.join(" ")).toContain("lệch");
  });

  it("bỏ qua lệch nhỏ dưới 1% (làm tròn trong file)", () => {
    const kq = bocTachThcp(quyetToan({ 10: { 2: "Chi phí", 3: 800_500_000 } }), "x.xlsx");
    expect(kq.canhBao).toEqual([]);
  });

  // Dòng chi tiết nằm trước mã nhóm đầu tiên thì không biết thuộc nhóm nào. Script CLI
  // cũ im lặng bỏ qua; ở đây phải nói ra vì người dùng đang nhìn bảng xem trước.
  it("đếm và báo dòng chi tiết mồ côi (chưa có mã nhóm phía trên)", () => {
    const kq = bocTachThcp(
      quyetToan({ 22: { 2: "Dòng lạc", 5: 1_000_000 }, 25: {}, 26: {} }, 40),
      "x.xlsx"
    );
    expect(kq.dong).toHaveLength(0);
    expect(kq.canhBao.join(" ")).toContain("3 dòng chi tiết nằm trước mã hạng mục");
  });

  it("báo khi thiếu hẳn bảng tổng hợp hạng mục", () => {
    const kq = bocTachThcp(quyetToan({ 14: {}, 15: {}, 16: {} }), "x.xlsx");
    expect(kq.canhBao.join(" ")).toContain("tổng hợp hạng mục");
  });

  it("file rỗng thì báo ngay dòng đầu tiên", () => {
    const kq = bocTachThcp(sheet({}, 30), "rong.xlsx");
    expect(kq.dong).toHaveLength(0);
    expect(kq.canhBao[0]).toContain("Không bóc được dòng chi phí nào");
  });

  // Khoảng trống giữa bảng là chuyện thường; chỉ 20 dòng trống liên tiếp mới là hết bảng.
  it("không dừng sớm khi giữa bảng chi tiết có vài dòng trống", () => {
    const kq = bocTachThcp(quyetToan({ 32: { 2: "Vận chuyển", 5: 10_000_000 } }, 40), "x.xlsx");
    expect(kq.dong.map((d) => d.name)).toContain("Vận chuyển");
  });
});

describe("bocTachThcp — dạng sổ giá thành", () => {
  /** Sổ kế toán: cột 6 = vật tư, cột 7 = nhân công, cột 9 = thành tiền. */
  const so = sheet(
    {
      1: { 3: "SỔ GIÁ THÀNH XÂY DỰNG" },
      4: { 1: "Mã hàng", 3: "Diễn giải", 5: "SL", 6: "NVL", 7: "NC", 9: "Cộng" },
      5: { 1: "1", 3: "2", 5: "3", 6: "4", 7: "5", 9: "6" },
      6: { 2: "K20L50", 3: "Thép hình", 5: 10, 6: 300_000_000, 9: 300_000_000 },
      7: { 3: "Công lắp dựng", 5: 1, 7: 100_000_000, 9: 100_000_000 },
      8: { 3: "Chi phí quản lý", 5: 1, 9: 50_000_000 },
      9: { 3: "Doanh thu", 6: 0.15, 9: 600_000_000 },
      10: { 3: "Tổng cộng", 9: 450_000_000 },
      11: { 3: "Người ghi sổ" },
    },
    12
  );
  const kq = bocTachThcp(so, "THCP 20x50 Ba Vi.xlsx");

  it("nhận đúng dạng và rút kích thước từ trong sổ", () => {
    expect(kq.dang).toBe("so-gia-thanh");
    expect(kq.dims).toBe("K20L50");
  });

  it("suy nhóm từ cột tiền: NVL -> A, nhân công -> G, còn lại -> H", () => {
    expect(kq.dong.map((d) => [d.cat, d.name])).toEqual([
      ["A", "Thép hình"],
      ["G", "Công lắp dựng"],
      ["H", "Chi phí quản lý"],
    ]);
  });

  it("chi phí = tổng dòng đã bóc, LNTT tính lại từ doanh thu", () => {
    expect(kq.fin.cost).toBe(450_000_000);
    expect(kq.fin.revenue).toBe(600_000_000);
    expect(kq.fin.profit).toBe(150_000_000);
  });

  // Dòng Doanh thu có ô tỷ lệ 0,15 nằm ngay cạnh ô tiền. Lấy "ô cuối cùng có số" sẽ
  // đúng ở đây nhưng sai khi tỷ lệ nằm bên phải, nên dùng ô có trị tuyệt đối lớn nhất.
  it("không nhầm ô tỷ lệ % thành doanh thu", () => {
    expect(kq.fin.revenue).not.toBe(0.15);
  });

  it("dừng ở Tổng cộng, không nuốt dòng tổng thành một khoản chi phí", () => {
    expect(kq.dong.map((d) => d.name)).not.toContain("Tổng cộng");
  });

  it("luôn nói rõ nhóm chi phí là suy đoán", () => {
    expect(kq.canhBao.join(" ")).toContain("suy ra từ cột tiền");
  });

  it("địa điểm lấy từ tên file sau khi bỏ THCP và phần kích thước", () => {
    expect(kq.location).toBe("Ba Vi");
  });
});

describe("khopDuAn", () => {
  const DS = [
    { id: "1", code: "N026", name: "K20L20_NB", location: "Ninh Bình" },
    { id: "2", code: "N031", name: "K36L63", location: "Tây Ninh" },
    { id: "3", code: "N044", name: "K20L20", location: "Tuyên Quang" },
    { id: "4", code: "N070", name: "K36L63 giai đoạn 2", location: "Tây Ninh" },
  ];

  it("ưu tiên tên trùng khít trước", () => {
    const r = khopDuAn({ dims: "K20L20", location: "Tuyên Quang" }, DS, "x.xlsx");
    expect(r.duAn?.code).toBe("N044");
  });

  it("tên trùng khít thắng cả khi có dự án khác cùng kích thước + địa điểm", () => {
    const r = khopDuAn({ dims: "K20L20", location: "Ninh Bình" }, DS, "x.xlsx");
    expect(r.duAn?.code).toBe("N044");
  });

  // Tên trong file THCP hay dài hơn tên dự án ("K20L20 Ninh Bình" vs "K20L20_NB"),
  // nên bước 1 trượt và phải nhờ bước 2 mới ra đúng dự án.
  it("không trùng tên thì khớp kích thước + địa điểm", () => {
    const r = khopDuAn({ dims: "K20L20 Ninh Bình", location: "Ninh Bình" }, DS, "x.xlsx");
    expect(r.duAn?.code).toBe("N026");
    expect(r.cachKhop).toContain("Ninh Bình");
  });

  // Ghi đè nhầm quyết toán của dự án khác là không sửa lại được, nên khi có nhiều
  // ứng viên thì từ chối đoán. Script CLI cũ lấy đại cái đầu tiên.
  it("nhiều ứng viên -> KHÔNG chọn bừa, báo rõ để người dùng quyết", () => {
    const r = khopDuAn({ dims: "K36L63 mới", location: "Tây Ninh" }, DS, "x.xlsx");
    expect(r.duAn).toBeNull();
    expect(r.canhBao[0]).toContain("N031");
    expect(r.canhBao[0]).toContain("N070");
  });

  // Không có địa điểm thì bước 2 quá lỏng: hai nhà cùng kích thước ở hai tỉnh khác
  // nhau sẽ bị gộp làm một. Thà tạo mới còn hơn ghi đè nhầm.
  it("thiếu địa điểm thì không dùng bước khớp lỏng", () => {
    const r = khopDuAn({ dims: "K20L20_XX", location: "" }, DS, "x.xlsx");
    expect(r.duAn).toBeNull();
    expect(r.cachKhop).toContain("TẠO DỰ ÁN MỚI");
  });

  it("địa điểm khác tỉnh thì không khớp", () => {
    const r = khopDuAn({ dims: "K36L63_HN", location: "Hà Nội" }, DS, "x.xlsx");
    expect(r.duAn).toBeNull();
  });

  it("lấy kích thước từ tên file khi trong file không có", () => {
    const r = khopDuAn({ dims: "", location: "Tuyên Quang" }, DS, "THCP K20L20 abc.xlsx");
    expect(r.duAn?.code).toBe("N044");
  });

  it("danh sách rỗng -> tạo mới, không nổ", () => {
    expect(khopDuAn({ dims: "K1L1", location: "X" }, [], "x.xlsx").duAn).toBeNull();
  });
});
