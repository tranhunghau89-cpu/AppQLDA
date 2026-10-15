import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
import { dongBaoHanh, khoaNgay, phanViec, phieuCuaNguoi, type DuLieuNhac } from "./nhacTheoNguoi";

const d: DuLieuNhac = {
  moc: [
    { projectId: "p1", projectCode: "A", projectName: "A", type: "T", planDate: new Date(0) },
    { projectId: "p2", projectCode: "B", projectName: "B", type: "T", planDate: new Date(0) },
  ],
  dot: [
    { projectId: "p1", projectCode: "A", direction: "THU", name: "Đợt 1", counterpart: null, amount: 1, dueDate: new Date(0) },
    { projectId: "p2", projectCode: "B", direction: "CHI", name: "Đợt 2", counterpart: null, amount: 1, dueDate: new Date(0) },
  ],
  baoGia: [
    { clientQuoteId: "q", quoteNo: null, projectCode: "A", customer: null, total: 1, expiryDate: new Date(0), henLienHeLai: null },
  ],
  hen: [
    { khachHangId: "k1", tenCty: "K1", phuTrach: null, noiDung: "", ngayHen: new Date(0) },
    { khachHangId: "k2", tenCty: "K2", phuTrach: null, noiDung: "", ngayHen: new Date(0) },
  ],
  chuKhach: new Map([["k1", "u1"], ["k2", "u2"]]),
};

describe("phanViec", () => {
  it("Ban giám đốc nhận tất cả", () => {
    const v = phanViec({ id: "x", role: "ADMIN", duAn: new Set() }, d);
    expect([v.moc.length, v.dot.length, v.baoGia.length, v.hen.length]).toEqual([2, 2, 1, 2]);
  });

  it("kỹ thuật chỉ nhận mốc và thanh toán của dự án mình", () => {
    const v = phanViec({ id: "u9", role: "ENGINEERING", duAn: new Set(["p1"]) }, d);
    expect(v.moc.map((m) => m.projectId)).toEqual(["p1"]);
    expect(v.dot.map((m) => m.projectId)).toEqual(["p1"]);
    expect(v.baoGia).toEqual([]);
    expect(v.hen).toEqual([]);
  });

  it("kế toán nhận mọi đợt thanh toán", () => {
    const v = phanViec({ id: "u9", role: "ACCOUNTING", duAn: new Set() }, d);
    expect(v.dot.length).toBe(2);
    expect(v.moc).toEqual([]);
  });

  it("kinh doanh nhận báo giá và hẹn của khách mình phụ trách", () => {
    const v = phanViec({ id: "u1", role: "SALES", duAn: new Set() }, d);
    expect(v.baoGia.length).toBe(1);
    expect(v.hen.map((h) => h.khachHangId)).toEqual(["k1"]);
  });
});

describe("khoaNgay", () => {
  it("theo giờ Việt Nam", () => {
    expect(khoaNgay(Date.UTC(2026, 9, 15, 18, 0))).toBe("2026-10-16");
  });
});

describe("bảo hành trong nhắc việc", () => {
  const NOW = Date.UTC(2026, 9, 15);
  const ds = [
    { projectCode: "A", tieuDe: "Thấm trần", mucDo: "KHAN", phuTrachId: "u1", hanXuLy: new Date(NOW - 2 * 86_400_000) },
    { projectCode: "B", tieuDe: "Nứt tường", mucDo: "THUONG", phuTrachId: null, hanXuLy: new Date(NOW + 3 * 86_400_000) },
  ];

  it("người phụ trách thấy phiếu của mình; BGĐ thấy phiếu chưa giao", () => {
    expect(phieuCuaNguoi({ id: "u1", role: "ENGINEERING" }, ds).map((p) => p.tieuDe)).toEqual(["Thấm trần"]);
    expect(phieuCuaNguoi({ id: "x", role: "ADMIN" }, ds).map((p) => p.tieuDe)).toEqual(["Nứt tường"]);
  });

  it("ghi quá hạn và khẩn", () => {
    const t = dongBaoHanh(ds, NOW);
    expect(t).toContain("BẢO HÀNH (2)");
    expect(t).toContain("[KHẨN] A — Thấm trần: quá hạn 2 ngày");
    expect(t).toContain("B — Nứt tường: còn 3 ngày (chưa giao)");
    expect(dongBaoHanh([], NOW)).toBe("");
  });
});
