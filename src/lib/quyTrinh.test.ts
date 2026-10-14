import { describe, expect, it } from "vitest";
import {
  boPhanMacDinh,
  buocHienTai,
  loiChuyen,
  loiGuiQc,
  lyDoQuyTrinh,
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
  it("còn mục", () => expect(loiGuiQc({ tong: 4, xong: 3 })).toBe("Còn 1/4 mục QC chưa xong."));
  it("đủ", () => expect(loiGuiQc({ tong: 4, xong: 4 })).toBeNull());
});

describe("tinhChuoi", () => {
  const qc = { BV_KT: 3, SHOP: 2 };
  const tt = (c: ReturnType<typeof tinhChuoi>, buoc: string) =>
    c.find((b) => b.buoc === buoc)?.trangThai;
  it("bước sau khoá khi bước trước chưa duyệt; giai đoạn không có QC thì bỏ qua", () => {
    const c = tinhChuoi([], qc);
    expect(["THONG_TIN", "HD_DT", "BV_KT", "SHOP", "MUA_HANG"].map((b) => tt(c, b))).toEqual([
      "DANG_LAM",
      "BO_QUA",
      "CHUA_MO",
      "CHUA_MO",
      "BO_QUA",
    ]);
    expect(buocHienTai(c)).toBe("THONG_TIN");
  });
  it("duyệt bước 0 thì mở QC Bản vẽ KT", () => {
    const c = tinhChuoi([{ buoc: "THONG_TIN", trangThai: "DA_DUYET" }], qc);
    expect(tt(c, "BV_KT")).toBe("DANG_LAM");
    expect(tt(c, "SHOP")).toBe("CHUA_MO");
    expect(buocHienTai(c)).toBe("BV_KT");
  });
  it("QC Hợp đồng & Dự toán có mục thì đứng giữa Thông tin và Bản vẽ KT", () => {
    const c = tinhChuoi([{ buoc: "THONG_TIN", trangThai: "DA_DUYET" }], { ...qc, HD_DT: 7 });
    expect(c.map((b) => b.buoc).slice(0, 3)).toEqual(["THONG_TIN", "HD_DT", "BV_KT"]);
    expect(buocHienTai(c)).toBe("HD_DT");
    expect(tt(c, "BV_KT")).toBe("CHUA_MO");
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
    expect(tt(c, "BV_KT")).toBe("TRA_LAI");
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

describe("lyDoQuyTrinh", () => {
  const now = Date.UTC(2026, 9, 14, 3);
  const ngay = (d: number) => new Date(Date.UTC(2026, 9, d, 3));
  it("quá hạn thì đỏ; chưa mở thì không xét hạn", () => {
    const r = lyDoQuyTrinh(
      [
        { buoc: "THONG_TIN", ten: "Thông tin dự án", trangThai: "DANG_LAM", han: ngay(10), daGiao: true },
        { buoc: "BV_KT", ten: "QC Bản vẽ KT", trangThai: "CHUA_MO", han: ngay(1), daGiao: true },
      ],
      [],
      now,
    );
    expect(r).toEqual([
      { muc: "DO", loai: "QUY_TRINH", soNgay: 4, text: "Bước Thông tin dự án quá hạn 4 ngày" },
    ]);
  });
  it("trả lại thì vàng; tiến độ xong mà chưa duyệt thì vàng; đã duyệt bỏ qua", () => {
    const r = lyDoQuyTrinh(
      [
        { buoc: "THONG_TIN", ten: "Thông tin dự án", trangThai: "TRA_LAI", han: null, daGiao: true },
        { buoc: "BV_KT", ten: "QC Bản vẽ KT", trangThai: "CHO_DUYET", han: ngay(20), daGiao: true },
        { buoc: "SHOP", ten: "QC Shop", trangThai: "DA_DUYET", han: ngay(1), daGiao: true },
      ],
      [
        { type: "BV_KT", done: true },
        { type: "SHOP", done: true },
      ],
      now,
    );
    expect(r.map((x) => [x.muc, x.text])).toEqual([
      ["VANG", "Bước Thông tin dự án bị trả lại"],
      ["VANG", "Tiến độ xong nhưng QC Bản vẽ KT chưa duyệt"],
    ]);
  });
});

describe("lyDoQuyTrinh — chưa giao người", () => {
  it("quá hạn mà chưa giao thì không lên cờ đỏ", () => {
    const r = lyDoQuyTrinh(
      [{ buoc: "THONG_TIN", ten: "Thông tin dự án", trangThai: "DANG_LAM", han: new Date(Date.UTC(2026, 0, 1)), daGiao: false }],
      [],
      Date.UTC(2026, 9, 14),
    );
    expect(r).toEqual([]);
  });
});
