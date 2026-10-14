import { describe, expect, it } from "vitest";
import {
  boPhanMacDinh,
  buocHienTai,
  loiChuyen,
  loiGuiQc,
  thieuThongTin,
  tinhChuoi,
} from "./quyTrinh";

const DU = {
  customerId: "c",
  location: "Bình Dương",
  khuVucId: "kv",
  kK: 6,
  kL: 60,
  kH: 8,
  area: 1500,
  salePrice: 1e9,
  mauSon: "Xám",
  mauTonMai: "Xanh",
  mauTonVach: "Trắng",
  soNguoiLienHe: 1,
  soQuyCachVatTu: 2,
};

describe("thieuThongTin", () => {
  it("đủ thì rỗng", () => expect(thieuThongTin(DU)).toEqual([]));
  it("liệt kê trường thiếu", () => {
    expect(
      thieuThongTin({ ...DU, location: "  ", kH: null, soNguoiLienHe: 0 }),
    ).toEqual(["Địa điểm", "Kích thước K × L × H", "Người liên hệ"]);
  });
});

describe("loiGuiQc", () => {
  it("chưa có mục", () => expect(loiGuiQc({ tong: 0, xong: 0 })).toMatch(/chưa có/));
  it("còn mục", () => expect(loiGuiQc({ tong: 4, xong: 3 })).toBe("Còn 1/4 mục QC chưa Đạt."));
  it("đủ", () => expect(loiGuiQc({ tong: 4, xong: 4 })).toBeNull());
});

describe("tinhChuoi", () => {
  const qc = { BV_KT: 3, SHOP: 2 };
  it("bước sau khoá khi bước trước chưa duyệt; giai đoạn không có QC thì bỏ qua", () => {
    const c = tinhChuoi([], qc);
    expect(c.slice(0, 4).map((b) => b.trangThai)).toEqual([
      "DANG_LAM",
      "CHUA_MO",
      "CHUA_MO",
      "BO_QUA",
    ]);
    expect(buocHienTai(c)).toBe("THONG_TIN");
  });
  it("duyệt bước 0 thì mở QC Bản vẽ KT", () => {
    const c = tinhChuoi([{ buoc: "THONG_TIN", trangThai: "DA_DUYET" }], qc);
    expect(c[1].trangThai).toBe("DANG_LAM");
    expect(c[2].trangThai).toBe("CHUA_MO");
    expect(buocHienTai(c)).toBe("BV_KT");
  });
  it("bỏ qua không chặn; xong hết thì null", () => {
    const c = tinhChuoi(
      [
        { buoc: "THONG_TIN", trangThai: "DA_DUYET" },
        { buoc: "BV_KT", trangThai: "DA_DUYET" },
        { buoc: "SHOP", trangThai: "DA_DUYET" },
      ],
      qc,
    );
    expect(buocHienTai(c)).toBeNull();
  });
  it("trả lại vẫn hiện trả lại dù bước trước chưa duyệt", () => {
    const c = tinhChuoi([{ buoc: "BV_KT", trangThai: "TRA_LAI" }], qc);
    expect(c[1].trangThai).toBe("TRA_LAI");
  });
});

describe("loiChuyen", () => {
  it("gửi", () => {
    expect(loiChuyen("GUI", "DANG_LAM")).toBeNull();
    expect(loiChuyen("GUI", "TRA_LAI")).toBeNull();
    expect(loiChuyen("GUI", "CHUA_MO")).toMatch(/trước/);
    expect(loiChuyen("GUI", "CHO_DUYET")).not.toBeNull();
  });
  it("duyệt / trả lại chỉ khi chờ duyệt", () => {
    expect(loiChuyen("DUYET", "CHO_DUYET")).toBeNull();
    expect(loiChuyen("TRA_LAI", "DANG_LAM")).not.toBeNull();
  });
});

describe("boPhanMacDinh", () => {
  it("bước 0 là Kinh doanh", () => expect(boPhanMacDinh("THONG_TIN", [])).toBe("SALES"));
  it("bộ phận nhiều mục nhất", () =>
    expect(boPhanMacDinh("MUA_HANG", ["PROCUREMENT", "ADMIN", "PROCUREMENT"])).toBe("PROCUREMENT"));
});
