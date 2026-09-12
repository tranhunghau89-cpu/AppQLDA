import { describe, expect, it } from "vitest";
import {
  cachCongTheoDonVi,
  dienGiaiCach,
  lechVoiBangBoc,
  tongChiTiet,
  type DongChiTietKL,
} from "./tongChiTiet";

function d(p: Partial<DongChiTietKL> = {}): DongChiTietKL {
  return { soLuong: 1, dai: null, klDon: null, dienTichDon: null, ...p };
}

describe("cachCongTheoDonVi", () => {
  it.each([
    ["kg", "KL_DON"],
    ["Kg", "KL_DON"],
    [" KG ", "KL_DON"],
    ["m2", "DIEN_TICH"],
    ["M2", "DIEN_TICH"],
    ["m²", "DIEN_TICH"],
    ["m", "CHIEU_DAI"],
    ["md", "CHIEU_DAI"],
    ["mđ", "CHIEU_DAI"],
    ["tấm", "DEM"],
    ["cái", "DEM"],
    ["bộ", "DEM"],
    ["con", "DEM"],
    ["", "DEM"],
  ])("%s -> %s", (donVi, mong) => {
    expect(cachCongTheoDonVi(donVi)).toBe(mong);
  });

  it("đơn vị lạ lùi về đếm chứ không bịa ra phép nhân", () => {
    expect(cachCongTheoDonVi("chuyến")).toBe("DEM");
    expect(cachCongTheoDonVi(null)).toBe("DEM");
  });
});

describe("tongChiTiet — bảng thống kê kết cấu (kg)", () => {
  it("dòng đầu bảng thật: 12 × 351,91 = 4.222,90 kg", () => {
    const kq = tongChiTiet([d({ soLuong: 12, klDon: 351.91 })], "kg");
    expect(kq.tong).toBeCloseTo(4222.92, 2);
    expect(kq.cach).toBe("KL_DON");
    expect(kq.soDongTinh).toBe(1);
    expect(kq.canhBao).toEqual([]);
  });

  it("cộng nhiều mã cấu kiện", () => {
    const kq = tongChiTiet(
      [
        d({ soLuong: 1, klDon: 206.42 }), // AH1.1
        d({ soLuong: 1, klDon: 206.42 }), // AH1.2
        d({ soLuong: 4, klDon: 113.2 }), // BR1.1
      ],
      "kg"
    );
    expect(kq.tong).toBeCloseTo(206.42 + 206.42 + 452.8, 6);
    expect(kq.soDongTinh).toBe(3);
  });

  it("bỏ dòng chưa có khối lượng đơn, kèm cảnh báo nêu đúng tên cột", () => {
    const kq = tongChiTiet([d({ soLuong: 2, klDon: 100 }), d({ soLuong: 5, klDon: null })], "kg");
    expect(kq.tong).toBe(200);
    expect(kq.soDongTinh).toBe(1);
    expect(kq.soDongThieu).toBe(1);
    expect(kq.canhBao[0]).toContain("khối lượng đơn");
  });
});

describe("tongChiTiet — bảng bóc tôn (mét)", () => {
  it("chiều dài mm đổi ra mét: 112 tấm × 3.170mm = 355,0 m", () => {
    const kq = tongChiTiet([d({ soLuong: 112, dai: 3170 })], "m");
    expect(kq.tong).toBeCloseTo(355.04, 2);
    expect(kq.cach).toBe("CHIEU_DAI");
  });

  it("cộng cả trục X1 của bảng thật ra đúng tổng dài", () => {
    const daiX1 = [2370, 2520, 2670, 2820, 2970, 3120, 3270, 3420, 3570, 3720, 3870, 4020, 4160];
    const kq = tongChiTiet(
      daiX1.map((dai) => d({ soLuong: 2, dai })),
      "m"
    );
    const mong = (daiX1.reduce((a, b) => a + b, 0) * 2) / 1000;
    expect(kq.tong).toBeCloseTo(mong, 6);
    expect(kq.soDongTinh).toBe(13);
  });

  it("đơn vị tấm thì chỉ đếm, không nhân chiều dài", () => {
    const kq = tongChiTiet([d({ soLuong: 112, dai: 3170 }), d({ soLuong: 52, dai: 2370 })], "tấm");
    expect(kq.tong).toBe(164);
    expect(kq.cach).toBe("DEM");
  });
});

describe("tongChiTiet — m²", () => {
  it("nhân diện tích đơn", () => {
    const kq = tongChiTiet([d({ soLuong: 12, dienTichDon: 12.77 })], "m2");
    expect(kq.tong).toBeCloseTo(153.24, 2);
  });

  it("có chiều dài nhưng thiếu diện tích thì không lấy bừa cột khác", () => {
    const kq = tongChiTiet([d({ soLuong: 10, dai: 5000, dienTichDon: null })], "m2");
    expect(kq.tong).toBeNull();
    expect(kq.soDongThieu).toBe(1);
    expect(kq.canhBao[0]).toContain("diện tích đơn");
  });
});

describe("chưa đủ dữ liệu và số rác", () => {
  it("bảng rỗng trả null chứ không phải 0", () => {
    const kq = tongChiTiet([], "kg");
    expect(kq.tong).toBeNull();
    expect(kq.soDongTinh).toBe(0);
    expect(kq.canhBao).toEqual([]);
  });

  it("mọi dòng đều thiếu thì trả null", () => {
    const kq = tongChiTiet([d({ soLuong: null }), d({ soLuong: 5, klDon: null })], "kg");
    expect(kq.tong).toBeNull();
    expect(kq.soDongThieu).toBe(2);
  });

  it("số lượng 0 là một con số đã nhập, vào tổng bình thường", () => {
    const kq = tongChiTiet([d({ soLuong: 0, klDon: 100 }), d({ soLuong: 2, klDon: 100 })], "kg");
    expect(kq.tong).toBe(200);
    expect(kq.soDongTinh).toBe(2);
  });

  it("NaN và vô cực bị loại, không lan ra tổng", () => {
    const kq = tongChiTiet(
      [
        d({ soLuong: 2, klDon: 100 }),
        d({ soLuong: Number.NaN, klDon: 100 }),
        d({ soLuong: 2, klDon: Number.POSITIVE_INFINITY }),
      ],
      "kg"
    );
    expect(kq.tong).toBe(200);
    expect(Number.isFinite(kq.tong as number)).toBe(true);
    expect(kq.soDongThieu).toBe(2);
  });
});

describe("dienGiaiCach", () => {
  it("nói đúng cột nào được nhân và bao nhiêu dòng", () => {
    const kq = tongChiTiet([d({ soLuong: 2, klDon: 100 })], "kg");
    expect(dienGiaiCach(kq)).toBe("số lượng × khối lượng đơn · 1 dòng");
  });
});

describe("lechVoiBangBoc", () => {
  const kq = tongChiTiet([d({ soLuong: 10, klDon: 100 })], "kg"); // 1000

  it("khớp thì không lệch", () => {
    expect(lechVoiBangBoc(1000, kq)).toBe(false);
  });

  it("chênh dưới một phần nghìn chỉ là sai số dấu phẩy động", () => {
    expect(lechVoiBangBoc(1000.0005, kq)).toBe(false);
  });

  it("chênh đáng kể là lệch thật", () => {
    expect(lechVoiBangBoc(999, kq)).toBe(true);
  });

  it("đầu mục chưa có khối lượng mà bảng đã ra tổng thì coi là lệch", () => {
    expect(lechVoiBangBoc(null, kq)).toBe(true);
  });

  it("bảng chưa ra tổng thì không có gì để so", () => {
    const rong = tongChiTiet([], "kg");
    expect(lechVoiBangBoc(1000, rong)).toBe(false);
    expect(lechVoiBangBoc(null, rong)).toBe(false);
  });
});
