import { describe, expect, it } from "vitest";
import {
  danhGiaThoiHan,
  danhSachMoc,
  hanTheoMoc,
  lapKeHoach,
  laMaMocHopLe,
  tenMoc,
  type MocDauVao,
} from "./tienDo";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);
const moc = (type: string, p: Partial<MocDauVao> = {}): MocDauVao => ({
  type,
  durationDays: null,
  overlapDays: null,
  planDate: null,
  actualDate: null,
  done: false,
  ...p,
});

describe("lapKeHoach", () => {
  it("nối tiếp từ ngày hiệu lực", () => {
    const kh = lapKeHoach(d("2026-01-01"), [
      moc("BV_KT", { durationDays: 10 }),
      moc("SHOP", { durationDays: 5 }),
    ]);
    expect(kh.map((k) => [iso(k.batDau), iso(k.ketThuc)])).toEqual([
      ["2026-01-01", "2026-01-11"],
      ["2026-01-11", "2026-01-16"],
    ]);
  });

  it("gối đầu bắt đầu sớm, không sớm hơn ngày hiệu lực", () => {
    const kh = lapKeHoach(d("2026-01-01"), [
      moc("BV_KT", { durationDays: 10, overlapDays: 5 }),
      moc("SHOP", { durationDays: 10, overlapDays: 3 }),
    ]);
    expect(iso(kh[0].batDau)).toBe("2026-01-01");
    expect(iso(kh[1].batDau)).toBe("2026-01-08");
    expect(iso(kh[1].ketThuc)).toBe("2026-01-18");
  });

  it("mốc nhập tay giữ nguyên và làm neo cho mốc sau", () => {
    const kh = lapKeHoach(d("2026-01-01"), [
      moc("BV_KT", { durationDays: 10 }),
      moc("SHOP", { planDate: d("2026-02-01") }),
      moc("MUA_HANG", { durationDays: 7 }),
    ]);
    expect(kh[1]).toMatchObject({ tuTinh: false, batDau: null });
    expect(iso(kh[1].ketThuc)).toBe("2026-02-01");
    expect(iso(kh[2].batDau)).toBe("2026-02-01");
    expect(iso(kh[2].ketThuc)).toBe("2026-02-08");
  });

  it("chưa có ngày hiệu lực: giữ ngày tay, không tính được mốc có số ngày", () => {
    const kh = lapKeHoach(null, [
      moc("BV_KT", { durationDays: 10, planDate: d("2026-03-03") }),
    ]);
    expect(kh[0].tuTinh).toBe(false);
    expect(iso(kh[0].ketThuc)).toBe("2026-03-03");
  });
});

describe("danhGiaThoiHan", () => {
  const now = d("2026-01-20").getTime();

  it("kế hoạch vượt thời hạn, bỏ qua HS quyết toán", () => {
    const mocs = [
      moc("BV_KT", { durationDays: 20 }),
      moc("HS_NT", { durationDays: 15 }),
      moc("HS_QT", { durationDays: 100 }),
    ];
    const kh = lapKeHoach(d("2026-01-01"), mocs);
    const r = danhGiaThoiHan(d("2026-01-01"), 30, mocs, kh, now);
    expect(iso(r.hanHD)).toBe("2026-01-31");
    expect(iso(r.ketThucKH)).toBe("2026-02-05");
    expect(r.vuotKH).toBe(5);
  });

  it("kế hoạch trong hạn cho số âm", () => {
    const mocs = [moc("BV_KT", { durationDays: 20 })];
    const r = danhGiaThoiHan(d("2026-01-01"), 30, mocs, lapKeHoach(d("2026-01-01"), mocs), now);
    expect(r.vuotKH).toBe(-10);
  });

  it("thực tế xong hết sau hạn", () => {
    const mocs = [
      moc("BV_KT", { done: true, actualDate: d("2026-01-10") }),
      moc("HS_NT", { done: true, actualDate: d("2026-02-03") }),
      moc("HS_QT"),
    ];
    const r = danhGiaThoiHan(d("2026-01-01"), 30, mocs, lapKeHoach(d("2026-01-01"), mocs), now);
    expect(r.xongHet).toBe(true);
    expect(r.vuotTT).toBe(3);
  });

  it("chưa xong: quá hạn tính đến hôm nay, chưa quá hạn thì null", () => {
    const mocs = [moc("BV_KT")];
    const kh = lapKeHoach(d("2026-01-01"), mocs);
    expect(danhGiaThoiHan(d("2026-01-01"), 10, mocs, kh, now).vuotTT).toBe(9);
    expect(danhGiaThoiHan(d("2026-01-01"), 30, mocs, kh, now).vuotTT).toBeNull();
  });

  it("thiếu ngày hiệu lực hoặc thời hạn thì không đánh giá", () => {
    const mocs = [moc("BV_KT", { planDate: d("2026-05-01") })];
    const r = danhGiaThoiHan(null, 30, mocs, lapKeHoach(null, mocs), now);
    expect(r.hanHD).toBeNull();
    expect(r.vuotKH).toBeNull();
  });
});

describe("danhSachMoc / tenMoc / hanTheoMoc", () => {
  it("dự án cũ không có dòng nào vẫn đủ 8 mốc chuẩn theo thứ tự", () => {
    expect(danhSachMoc([]).map((m) => m.type)).toEqual([
      "BV_KT", "SHOP", "MUA_HANG", "GIA_CONG", "LAP_DUNG", "LOP_TON", "HS_NT", "HS_QT",
    ]);
  });

  it("ẩn mốc chuẩn, thêm mốc riêng, sắp lại thứ tự", () => {
    const ds = danhSachMoc([
      { type: "SHOP", hidden: true },
      { type: "KHAC_abc123", name: "Đổ móng", sortOrder: 15 },
      { type: "HS_QT", sortOrder: 5 },
    ]);
    expect(ds.map((m) => m.type)).toEqual([
      "BV_KT", "HS_QT", "KHAC_abc123", "MUA_HANG", "GIA_CONG", "LAP_DUNG", "LOP_TON", "HS_NT",
    ]);
  });

  it("tên riêng ưu tiên tên chuẩn", () => {
    expect(tenMoc({ type: "SHOP" })).toBe("Shop");
    expect(tenMoc({ type: "SHOP", name: "Bản vẽ shop" })).toBe("Bản vẽ shop");
    expect(tenMoc({ type: "KHAC_abc123", name: "Đổ móng" })).toBe("Đổ móng");
  });

  it("mã mốc hợp lệ", () => {
    expect(laMaMocHopLe("LAP_DUNG")).toBe(true);
    expect(laMaMocHopLe("KHAC_abc123")).toBe(true);
    expect(laMaMocHopLe("KHAC_")).toBe(false);
    expect(laMaMocHopLe("XYZ")).toBe(false);
  });

  it("hạn thanh toán: thực tế nếu xong, không thì kế hoạch, + N ngày", () => {
    const m = { planDate: d("2026-11-01"), actualDate: d("2026-11-05"), done: false };
    expect(iso(hanTheoMoc(m, 7))).toBe("2026-11-08");
    expect(iso(hanTheoMoc({ ...m, done: true }, 7))).toBe("2026-11-12");
    expect(iso(hanTheoMoc({ ...m, done: true, actualDate: null }, 0))).toBe("2026-11-01");
    expect(hanTheoMoc({ planDate: null, actualDate: null, done: false }, 7)).toBeNull();
    expect(hanTheoMoc(null, 7)).toBeNull();
  });
});
