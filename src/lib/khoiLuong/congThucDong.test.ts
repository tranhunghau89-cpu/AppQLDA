import { describe, expect, it } from "vitest";
import { coThamChieuMa, coVong, idSangMa, maSangId, tinhCongThucDong } from "./congThucDong";

const ma = new Map([
  ["6.1", "a"],
  ["7.1", "b"],
  ["8.1", "c"],
]);

describe("congThucDong", () => {
  it("dịch mã ↔ id hai chiều", () => {
    const r = maSangId("=[6.1] + [7.1]+[8.1]", ma);
    expect(r).toEqual({ ok: true, congThuc: "=[@a] + [@b]+[@c]" });
    if (r.ok) expect(idSangMa(r.congThuc, new Map([["a", "6.2"], ["b", "7.1"]]))).toBe("=[6.2] + [7.1]+[?]");
  });

  it("thêm dấu = khi thiếu, báo mã không có", () => {
    expect(maSangId("[6.1]*2", ma)).toEqual({ ok: true, congThuc: "=[@a]*2" });
    expect(maSangId("=[6.1]+[9.9]", ma)).toEqual({ ok: false, error: "Không có dòng 9.9 trong hạng mục này." });
  });

  it("tính tổng ba dòng, số lẻ đúng quy ước phẩy thập phân", () => {
    const kl = new Map<string, number | null>([
      ["a", 156],
      ["b", 161],
      ["c", 172.5],
    ]);
    expect(tinhCongThucDong("=[@a]+[@b]+[@c]", kl)).toBe(489.5);
    expect(tinhCongThucDong("=([@a]+[@b])*1,1", kl)).toBeCloseTo(348.7);
    expect(tinhCongThucDong("=[@a]+[@x]", kl)).toBeNull();
    expect(tinhCongThucDong("=[@a]+[@b]", new Map([["a", null], ["b", 5]]))).toBe(5);
  });

  it("nhận ra tham chiếu, không nhầm với công thức số", () => {
    expect(coThamChieuMa("=[6.1]+1")).toBe(true);
    expect(coThamChieuMa("=6,1*3")).toBe(false);
  });

  it("chặn vòng", () => {
    expect(coVong("a", "=[@a]", new Map())).toBe(true);
    expect(coVong("a", "=[@b]", new Map([["b", "=[@a]*2"]]))).toBe(true);
    expect(coVong("a", "=[@b]+[@c]", new Map([["b", "=[@c]"]]))).toBe(false);
  });
});
