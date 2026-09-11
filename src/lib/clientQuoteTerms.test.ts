import { describe, expect, it } from "vitest";
import { congDonNgay, tienCacDot } from "./clientQuoteTerms";
import { DEFAULT_PAYMENTS, DEFAULT_STAGES } from "./clientQuoteDefaults";

const cong = (t: (number | null)[]) => t.reduce<number>((s, x) => s + (x ?? 0), 0);

describe("congDonNgay", () => {
  it("cộng dồn theo thứ tự chặng", () => {
    expect(congDonNgay([{ days: 3 }, { days: 15 }, { days: 2 }, { days: 25 }, { days: 10 }])).toEqual(
      [3, 18, 20, 45, 55]
    );
  });

  it("chặng chưa điền số ngày thì không làm đứt mạch cộng dồn", () => {
    expect(congDonNgay([{ days: 5 }, { days: null }, { days: 4 }])).toEqual([5, 5, 9]);
  });

  it("danh sách rỗng -> rỗng", () => {
    expect(congDonNgay([])).toEqual([]);
  });

  it("khớp với tổng của bộ mặc định", () => {
    const c = congDonNgay(DEFAULT_STAGES);
    expect(c[c.length - 1]).toBe(55);
  });
});

describe("tienCacDot", () => {
  const TONG = 783_450_140;

  it("chia đúng theo phần trăm", () => {
    const t = tienCacDot(TONG, [30, 40, 20, 10]);
    expect(t[0]).toBe(235_035_042);
    expect(t[1]).toBe(313_380_056);
  });

  it("đủ 100% thì cột tiền cộng lại ĐÚNG bằng tổng sau thuế", () => {
    // Làm tròn từng đợt riêng lẻ lệch vài đồng; đợt cuối gánh phần dư.
    for (const ps of [
      [30, 40, 20, 10],
      [33.33, 33.33, 33.34],
      [50, 50],
      [100],
    ]) {
      expect(cong(tienCacDot(TONG, ps))).toBe(TONG);
    }
  });

  it("chưa đủ 100% thì KHÔNG bù — lệch tổng là điều cần thấy", () => {
    const t = tienCacDot(1_000_000, [30, 40]);
    expect(t).toEqual([300_000, 400_000]);
    expect(cong(t)).toBe(700_000);
  });

  it("quá 100% cũng không bù", () => {
    expect(tienCacDot(1_000_000, [60, 60])).toEqual([600_000, 600_000]);
  });

  it("đợt chưa điền phần trăm là null, không phải 0 đồng", () => {
    const t = tienCacDot(1_000_000, [50, null, 50]);
    expect(t[1]).toBeNull();
    expect(cong(t)).toBe(1_000_000);
  });

  it("toàn null thì không bù vào đâu cả", () => {
    expect(tienCacDot(1_000_000, [null, null])).toEqual([null, null]);
  });

  it("danh sách rỗng -> rỗng, không lỗi", () => {
    expect(tienCacDot(1_000_000, [])).toEqual([]);
  });

  it("tổng 0 đồng -> mọi đợt 0 đồng", () => {
    expect(tienCacDot(0, [30, 40, 20, 10])).toEqual([0, 0, 0, 0]);
  });

  it("bộ mặc định 30/40/20/10 cộng đủ tổng", () => {
    const t = tienCacDot(TONG, DEFAULT_PAYMENTS.map((p) => p.percent ?? null));
    expect(cong(t)).toBe(TONG);
  });
});
