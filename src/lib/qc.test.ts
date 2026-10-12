import { describe, expect, it } from "vitest";
import { duocDanhQc, kiemTraDanhGia, lyDoQc, sapXepViecQc, tomTatGiaiDoan } from "./qc";

// 12/10/2026 09:00 giờ VN
const NOW = Date.parse("2026-10-12T02:00:00Z");
const vn = (s: string) => new Date(`${s}T00:00:00+07:00`);

describe("duocDanhQc", () => {
  it("đúng bộ phận hoặc ADMIN", () => {
    expect(duocDanhQc("ENGINEERING", "ENGINEERING")).toBe(true);
    expect(duocDanhQc("ADMIN", "PROCUREMENT")).toBe(true);
    expect(duocDanhQc("SALES", "ENGINEERING")).toBe(false);
  });
});

describe("kiemTraDanhGia", () => {
  it("KHONG_DAT bắt buộc ghi chú", () => {
    expect(kiemTraDanhGia({ ketQua: "KHONG_DAT", ghiChu: "  " })).toMatch(/ghi chú/i);
    expect(kiemTraDanhGia({ ketQua: "KHONG_DAT", ghiChu: "Sai màu" })).toBeNull();
  });
  it("kết quả lạ bị từ chối; CHUA không được đánh", () => {
    expect(kiemTraDanhGia({ ketQua: "XYZ", ghiChu: "" })).not.toBeNull();
    expect(kiemTraDanhGia({ ketQua: "CHUA", ghiChu: "" })).not.toBeNull();
    expect(kiemTraDanhGia({ ketQua: "DAT", ghiChu: "" })).toBeNull();
    expect(kiemTraDanhGia({ ketQua: "KHONG_AP_DUNG", ghiChu: "" })).toBeNull();
  });
});

describe("tomTatGiaiDoan", () => {
  it("bỏ KHONG_AP_DUNG khỏi tổng", () => {
    const r = tomTatGiaiDoan(
      ["DAT", "KHONG_AP_DUNG", "CHUA", "KHONG_DAT"].map((k) => ({ giaiDoan: "SHOP", ketQua: k }))
    );
    expect(r).toEqual({ dat: 1, tong: 3, khongDat: 1, chua: 1 });
  });
});

describe("lyDoQc", () => {
  const m = (giaiDoan: string, ketQua: string) => ({ giaiDoan, ketQua });

  it("không có mục → không lý do", () => expect(lyDoQc([], [], NOW)).toEqual([]));

  it("KHONG_DAT → ĐỎ kể cả khi mốc đã xong", () => {
    const r = lyDoQc([m("GIA_CONG", "KHONG_DAT")], [{ type: "GIA_CONG", planDate: null, done: true }], NOW);
    expect(r).toEqual([{ muc: "DO", loai: "QC", soNgay: 1, text: "QC Gia công: 1 mục không đạt" }]);
  });

  it("CHUA + mốc trong 7 ngày (hoặc quá hạn) → VÀNG; 8 ngày / không hạn / đã xong → không", () => {
    const chua = [m("LAP_DUNG", "CHUA"), m("LAP_DUNG", "CHUA"), m("LAP_DUNG", "DAT")];
    const mk = (planDate: Date | null, done = false) => [{ type: "LAP_DUNG", planDate, done }];
    expect(lyDoQc(chua, mk(vn("2026-10-19")), NOW)[0]).toMatchObject({
      muc: "VANG",
      loai: "QC",
      text: "QC Lắp dựng còn 2 mục chưa kiểm",
    });
    expect(lyDoQc(chua, mk(vn("2026-10-01")), NOW)[0]?.muc).toBe("VANG");
    expect(lyDoQc(chua, mk(vn("2026-10-20")), NOW)).toEqual([]);
    expect(lyDoQc(chua, mk(null), NOW)).toEqual([]);
    expect(lyDoQc(chua, mk(vn("2026-10-14"), true), NOW)).toEqual([]);
  });

  it("một giai đoạn có cả không đạt và chưa kiểm → một ĐỎ và một VÀNG", () => {
    const r = lyDoQc(
      [m("SHOP", "KHONG_DAT"), m("SHOP", "CHUA")],
      [{ type: "SHOP", planDate: vn("2026-10-13"), done: false }],
      NOW
    );
    expect(r.map((l) => l.muc).sort()).toEqual(["DO", "VANG"]);
  });
});

describe("sapXepViecQc", () => {
  it("KHONG_DAT trước, rồi hạn tăng dần, không hạn cuối", () => {
    const rows = [
      { id: "a", ketQua: "CHUA", han: null },
      { id: "b", ketQua: "CHUA", han: vn("2026-10-20") },
      { id: "c", ketQua: "KHONG_DAT", han: null },
      { id: "d", ketQua: "CHUA", han: vn("2026-10-13") },
    ];
    expect(rows.sort(sapXepViecQc).map((r) => r.id)).toEqual(["c", "d", "b", "a"]);
  });
});
