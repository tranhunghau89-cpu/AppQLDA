import { describe, expect, it } from "vitest";
import { isoWeek, recentWeeks, weekLabel, weekRange } from "./week";

describe("isoWeek", () => {
  it("giữa năm: tuần ISO đúng", () => {
    expect(isoWeek(new Date(2026, 8, 10))).toEqual({ year: 2026, week: 37 });
  });

  it("ngày đầu năm có thể thuộc tuần cuối của năm trước", () => {
    // 01/01/2027 là thứ Sáu -> vẫn thuộc tuần 53 của 2026.
    expect(isoWeek(new Date(2027, 0, 1))).toEqual({ year: 2026, week: 53 });
  });

  it("ngày cuối năm có thể thuộc tuần 1 của năm sau", () => {
    // 31/12/2024 là thứ Ba -> thuộc tuần 1 của 2025.
    expect(isoWeek(new Date(2024, 11, 31))).toEqual({ year: 2025, week: 1 });
  });

  it("thứ Hai và Chủ nhật cùng tuần cho cùng kết quả", () => {
    const mon = isoWeek(new Date(2026, 8, 7));
    const sun = isoWeek(new Date(2026, 8, 13));
    expect(mon).toEqual(sun);
  });
});

describe("weekRange", () => {
  it("trả về thứ Hai đến Chủ nhật", () => {
    const { start, end } = weekRange(2026, 37);
    expect(start.getUTCDay()).toBe(1);
    expect(end.getUTCDay()).toBe(0);
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(6);
  });

  it("khớp ngược với isoWeek", () => {
    const { start } = weekRange(2026, 37);
    expect(isoWeek(new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())))
      .toEqual({ year: 2026, week: 37 });
  });
});

describe("weekLabel", () => {
  it("có số tuần và khoảng ngày dd/MM", () => {
    expect(weekLabel(2026, 37)).toMatch(/^Tuần 37 \(\d{2}\/\d{2}–\d{2}\/\d{2}\)$/);
  });
});

describe("recentWeeks", () => {
  it("liệt kê giảm dần trong cùng năm", () => {
    expect(recentWeeks(2026, 37, 3)).toEqual([
      { year: 2026, week: 37 },
      { year: 2026, week: 36 },
      { year: 2026, week: 35 },
    ]);
  });

  it("lùi qua đầu năm thì sang năm trước", () => {
    expect(recentWeeks(2026, 2, 3)).toEqual([
      { year: 2026, week: 2 },
      { year: 2026, week: 1 },
      { year: 2025, week: 52 },
    ]);
  });

  it("count = 0 -> danh sách rỗng", () => {
    expect(recentWeeks(2026, 10, 0)).toEqual([]);
  });
});
