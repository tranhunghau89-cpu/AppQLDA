// Tính tuần ISO + nhãn tuần.

export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: d.getUTCFullYear(), week };
}

/** Khoảng ngày (thứ 2 - chủ nhật) của tuần ISO. */
export function weekRange(year: number, week: number): { start: Date; end: Date } {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayNum = (simple.getUTCDay() + 6) % 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - dayNum);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday, end: sunday };
}

function dm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function weekLabel(year: number, week: number): string {
  const { start, end } = weekRange(year, week);
  return `Tuần ${week} (${dm(start)}–${dm(end)})`;
}

/** Danh sách n tuần gần nhất (giảm dần) kể từ tuần cho trước. */
export function recentWeeks(
  year: number,
  week: number,
  count: number
): { year: number; week: number }[] {
  const out: { year: number; week: number }[] = [];
  let y = year;
  let w = week;
  for (let i = 0; i < count; i++) {
    out.push({ year: y, week: w });
    w -= 1;
    if (w < 1) {
      y -= 1;
      w = 52;
    }
  }
  return out;
}
