import { describe, expect, it } from "vitest";
import {
  buildBaoCaoKy,
  cacKyGanDay,
  docMaKy,
  dongTien,
  gopTheoMoc,
  khoangKy,
  kyChua,
  kyTruoc,
  maKy,
  nhanKy,
  phanTramDoi,
  type Ky,
} from "./period";

/** Một thời điểm ghi theo giờ Việt Nam, đổi sang UTC để so sánh. */
function gioVN(iso: string): Date {
  return new Date(`${iso}+07:00`);
}

describe("khoangKy", () => {
  // Đây là lý do cả module này tồn tại thay vì dùng thẳng new Date(nam, thang, 1).
  it("mốc kỳ là nửa đêm GIỜ VIỆT NAM, không phải nửa đêm UTC", () => {
    const { tu } = khoangKy({ loai: "thang", nam: 2026, so: 9 });
    expect(tu.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(tu.getTime()).toBe(gioVN("2026-09-01T00:00:00").getTime());
  });

  it("quý gồm đúng ba tháng", () => {
    const { tu, den } = khoangKy({ loai: "quy", nam: 2026, so: 3 });
    expect(tu.getTime()).toBe(gioVN("2026-07-01T00:00:00").getTime());
    expect(den.getTime()).toBe(gioVN("2026-10-01T00:00:00").getTime());
  });

  it("năm gồm đúng 12 tháng", () => {
    const { tu, den } = khoangKy({ loai: "nam", nam: 2026, so: 0 });
    expect(tu.getTime()).toBe(gioVN("2026-01-01T00:00:00").getTime());
    expect(den.getTime()).toBe(gioVN("2027-01-01T00:00:00").getTime());
  });

  it("tháng 12 bắc cầu sang năm sau", () => {
    const { den } = khoangKy({ loai: "thang", nam: 2026, so: 12 });
    expect(den.getTime()).toBe(gioVN("2027-01-01T00:00:00").getTime());
  });
});

describe("maKy / docMaKy", () => {
  const cases: [Ky, string][] = [
    [{ loai: "thang", nam: 2026, so: 9 }, "2026-09"],
    [{ loai: "quy", nam: 2026, so: 3 }, "2026-Q3"],
    [{ loai: "nam", nam: 2026, so: 0 }, "2026"],
  ];

  it("mã kỳ đi được cả hai chiều", () => {
    for (const [ky, ma] of cases) {
      expect(maKy(ky)).toBe(ma);
      expect(docMaKy(ma)).toEqual(ky);
    }
  });

  // Người dùng sửa được thanh địa chỉ, nên đọc mã hỏng phải trả null chứ không nổ.
  it("mã hỏng trả null", () => {
    for (const x of ["", null, undefined, "2026-13", "2026-Q5", "abc", "26-09", "2026-9"]) {
      expect(docMaKy(x)).toBeNull();
    }
  });
});

describe("kyTruoc", () => {
  it("lùi trong cùng năm", () => {
    expect(kyTruoc({ loai: "thang", nam: 2026, so: 9 })).toEqual({ loai: "thang", nam: 2026, so: 8 });
    expect(kyTruoc({ loai: "quy", nam: 2026, so: 3 })).toEqual({ loai: "quy", nam: 2026, so: 2 });
  });

  it("lùi qua đầu năm", () => {
    expect(kyTruoc({ loai: "thang", nam: 2026, so: 1 })).toEqual({ loai: "thang", nam: 2025, so: 12 });
    expect(kyTruoc({ loai: "quy", nam: 2026, so: 1 })).toEqual({ loai: "quy", nam: 2025, so: 4 });
    expect(kyTruoc({ loai: "nam", nam: 2026, so: 0 })).toEqual({ loai: "nam", nam: 2025, so: 0 });
  });
});

describe("kyChua", () => {
  it("xác định kỳ theo lịch Việt Nam", () => {
    expect(kyChua("thang", gioVN("2026-09-10T09:00:00"))).toEqual({ loai: "thang", nam: 2026, so: 9 });
    expect(kyChua("quy", gioVN("2026-09-10T09:00:00"))).toEqual({ loai: "quy", nam: 2026, so: 3 });
    expect(kyChua("nam", gioVN("2026-09-10T09:00:00"))).toEqual({ loai: "nam", nam: 2026, so: 0 });
  });

  // 01/01 lúc 02:00 giờ VN vẫn là 31/12 theo UTC — phải theo lịch Việt Nam.
  it("không lệch năm ở ranh giới giao thừa", () => {
    expect(kyChua("nam", gioVN("2026-01-01T02:00:00"))).toEqual({ loai: "nam", nam: 2026, so: 0 });
  });

  it("ranh giới quý", () => {
    expect(kyChua("quy", gioVN("2026-03-31T23:00:00")).so).toBe(1);
    expect(kyChua("quy", gioVN("2026-04-01T00:00:00")).so).toBe(2);
  });
});

describe("cacKyGanDay", () => {
  it("liệt kê lùi dần, kỳ hiện tại đứng đầu", () => {
    const ds = cacKyGanDay({ loai: "thang", nam: 2026, so: 2 }, 4).map(maKy);
    expect(ds).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });
});

describe("gopTheoMoc", () => {
  const tu = gioVN("2026-09-01T00:00:00");
  const den = gioVN("2026-10-01T00:00:00");
  const rows = [
    { d: gioVN("2026-08-31T23:59:00"), v: 1 },
    { d: gioVN("2026-09-01T00:00:00"), v: 10 },
    { d: gioVN("2026-09-15T12:00:00"), v: 100 },
    { d: gioVN("2026-09-30T23:59:00"), v: 1000 },
    { d: gioVN("2026-10-01T00:00:00"), v: 10000 },
    { d: null, v: 100000 },
  ];

  // Nửa mở: mốc đúng bằng `den` thuộc kỳ SAU. Nếu đóng cả hai đầu thì một khoản nằm
  // đúng ranh giới bị đếm vào cả hai kỳ, và tổng hai kỳ không khớp tổng chung.
  it("lấy mốc bằng `tu` nhưng KHÔNG lấy mốc bằng `den`", () => {
    const g = gopTheoMoc(rows, (r) => r.d, (r) => r.v, tu, den);
    expect(g.tien).toBe(1110);
    expect(g.so).toBe(3);
  });

  it("bỏ qua dòng không có mốc thời gian", () => {
    const g = gopTheoMoc(rows, (r) => r.d, (r) => r.v, tu, den);
    expect(g.tien).not.toContain(100000);
  });

  it("số tiền null tính là 0 nhưng vẫn được đếm", () => {
    const g = gopTheoMoc(
      [{ d: gioVN("2026-09-05T00:00:00"), v: null as number | null }],
      (r) => r.d,
      (r) => r.v,
      tu,
      den
    );
    expect(g).toEqual({ so: 1, tien: 0 });
  });
});

describe("dongTien", () => {
  const tu = gioVN("2026-09-01T00:00:00");
  const den = gioVN("2026-10-01T00:00:00");

  it("tách thu và chi", () => {
    const r = dongTien(
      [
        { direction: "THU", paidDate: gioVN("2026-09-05T00:00:00"), paidAmount: 500, amount: 400 },
        { direction: "CHI", paidDate: gioVN("2026-09-06T00:00:00"), paidAmount: 200, amount: null },
      ],
      tu,
      den
    );
    expect(r.vao).toEqual({ so: 1, tien: 500 });
    expect(r.ra).toEqual({ so: 1, tien: 200 });
  });

  // Báo cáo kỳ nói về tiền đã thực sự vào/ra, không phải kế hoạch.
  it("bỏ qua khoản chưa thanh toán dù đã tới hạn", () => {
    const r = dongTien(
      [{ direction: "THU", paidDate: null, paidAmount: null, amount: 999 }],
      tu,
      den
    );
    expect(r.vao).toEqual({ so: 0, tien: 0 });
  });

  // Dữ liệu thật có nhiều dòng đánh dấu đã trả nhưng không nhập lại số tiền.
  it("thiếu paidAmount thì lùi về amount theo kế hoạch", () => {
    const r = dongTien(
      [{ direction: "THU", paidDate: gioVN("2026-09-05T00:00:00"), paidAmount: null, amount: 700 }],
      tu,
      den
    );
    expect(r.vao.tien).toBe(700);
  });
});

describe("buildBaoCaoKy", () => {
  const ky: Ky = { loai: "thang", nam: 2026, so: 9 };
  const trong = gioVN("2026-09-10T00:00:00");
  const ngoai = gioVN("2026-08-10T00:00:00");

  const bc = buildBaoCaoKy(
    {
      thanhToan: [
        { direction: "THU", paidDate: trong, paidAmount: 1000, amount: null },
        { direction: "CHI", paidDate: trong, paidAmount: 300, amount: null },
        { direction: "THU", paidDate: ngoai, paidAmount: 9999, amount: null },
      ],
      hopDong: [{ signDate: trong, giaTri: 5000 }, { signDate: ngoai, giaTri: 1 }],
      donHang: [{ orderDate: trong, value: 400 }],
      duAn: [
        { startDate: trong, endDate: null, salePrice: 100 },
        { startDate: ngoai, endDate: trong, salePrice: 200 },
      ],
      moc: [{ actualDate: trong }, { actualDate: trong }, { actualDate: ngoai }],
    },
    ky
  );

  it("gom đủ các mục và tính dòng tiền ròng", () => {
    expect(bc.tienVao).toEqual({ so: 1, tien: 1000 });
    expect(bc.tienRa).toEqual({ so: 1, tien: 300 });
    expect(bc.dongTienRong).toBe(700);
    expect(bc.hopDongKy).toEqual({ so: 1, tien: 5000 });
    expect(bc.donHang).toEqual({ so: 1, tien: 400 });
  });

  it("một dự án có thể vừa khởi công vừa hoàn thành trong các kỳ khác nhau", () => {
    expect(bc.duAnKhoiCong.so).toBe(1);
    expect(bc.duAnHoanThanh.so).toBe(1);
  });

  it("mốc chỉ đếm số, không có tiền", () => {
    expect(bc.mocHoanThanh).toEqual({ so: 2, tien: 0 });
  });

  it("mang theo nhãn và khoảng thời gian để hiển thị", () => {
    expect(bc.nhan).toBe(nhanKy(ky));
    expect(bc.tu.getTime()).toBe(gioVN("2026-09-01T00:00:00").getTime());
  });
});

describe("phanTramDoi", () => {
  it("tăng giảm thông thường", () => {
    expect(phanTramDoi(150, 100)).toBe(50);
    expect(phanTramDoi(50, 100)).toBe(-50);
    expect(phanTramDoi(100, 100)).toBe(0);
  });

  // "Tăng vô hạn phần trăm" là con số vô nghĩa — giao diện hiện dấu gạch thay vì số.
  it("kỳ trước bằng 0 trả null chứ không phải Infinity", () => {
    expect(phanTramDoi(100, 0)).toBeNull();
    expect(phanTramDoi(0, 0)).toBeNull();
  });

  it("kỳ trước âm vẫn tính theo độ lớn", () => {
    expect(phanTramDoi(0, -100)).toBe(100);
  });
});
