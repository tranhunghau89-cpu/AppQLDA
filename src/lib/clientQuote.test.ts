import { describe, expect, it } from "vitest";
import {
  computeClientQuoteTotals,
  expiryFrom,
  lineAmount,
  partTotals,
  roundVnd,
  sumStageDays,
  validatePaymentPercents,
} from "./clientQuote";
import { docTienVietNam } from "./money-words";
import { DEFAULT_PAYMENTS, DEFAULT_SPECS, DEFAULT_STAGES } from "./clientQuoteDefaults";

describe("lineAmount", () => {
  it("dòng m²: khối lượng × đơn giá", () => {
    // Đúng dòng 01 của báo giá mẫu: 1.000 m² × 695.000 = 695.000.000
    expect(lineAmount({ qty: 1_000, unitPrice: 695_000, amount: null })).toBe(695_000_000);
  });

  it("dòng khoán: có amount thì amount thắng", () => {
    expect(lineAmount({ qty: 6, unitPrice: 184_000, amount: 1_104_000 })).toBe(1_104_000);
  });

  it("amount = 0 là giá trị thật, không rơi về qty × đơn giá", () => {
    // Chốt lỗi kinh điển dùng `||` thay cho `!= null`.
    expect(lineAmount({ qty: 5, unitPrice: 100, amount: 0 })).toBe(0);
  });

  it("thiếu hết -> 0", () => {
    expect(lineAmount({ qty: null, unitPrice: null, amount: null })).toBe(0);
    expect(lineAmount({})).toBe(0);
  });

  it("chỉ có khối lượng, chưa có đơn giá -> 0", () => {
    expect(lineAmount({ qty: 1_000, unitPrice: null, amount: null })).toBe(0);
  });
});

describe("computeClientQuoteTotals", () => {
  const bg = [
    { qty: 1_000, unitPrice: 695_000, amount: null },
    { qty: 15.6, unitPrice: null, amount: 1_104_000 },
  ];

  it("cộng trước thuế, VAT 10%, tổng sau thuế", () => {
    const t = computeClientQuoteTotals(bg, 10);
    expect(t.beforeVat).toBe(696_104_000);
    expect(t.vat).toBe(69_610_400);
    expect(t.withVat).toBe(765_714_400);
  });

  it("vatPercent = null nghĩa là KHÔNG thuế, không phải mặc định 10", () => {
    const t = computeClientQuoteTotals(bg, null);
    expect(t.vat).toBe(0);
    expect(t.withVat).toBe(t.beforeVat);
  });

  it("vatPercent = 0 cho kết quả như null", () => {
    expect(computeClientQuoteTotals(bg, 0)).toEqual(computeClientQuoteTotals(bg, null));
  });

  it("VAT lẻ được làm tròn xuống đồng", () => {
    // 1.000.005 × 8% = 80.000,4
    const t = computeClientQuoteTotals([{ qty: 1, unitPrice: 1_000_005, amount: null }], 8);
    expect(t.vat).toBe(80_000);
    expect(Number.isInteger(t.vat)).toBe(true);
    expect(Number.isInteger(t.withVat)).toBe(true);
  });

  it("biên .5 làm tròn lên", () => {
    // 1.000.010 × 8% = 80.000,8
    const t = computeClientQuoteTotals([{ qty: 1, unitPrice: 1_000_010, amount: null }], 8);
    expect(t.vat).toBe(80_001);
  });

  it("không có dòng nào -> toàn 0, không NaN", () => {
    const t = computeClientQuoteTotals([], 10);
    expect(t).toEqual({ beforeVat: 0, vat: 0, withVat: 0 });
    expect(Number.isNaN(t.withVat)).toBe(false);
  });
});

describe("bằng chữ", () => {
  // Mẫu Excel của công ty đang in ra "#NAME?" ở dòng này — đây chính là chỗ app
  // phải làm đúng, nên kiểm cả chuỗi kết quả chứ không chỉ kiểm số.
  const motDong = (tien: number) => [{ qty: 1, unitPrice: tien, amount: null }];

  it("đọc TỔNG SAU THUẾ, không phải cộng trước thuế", () => {
    const t = computeClientQuoteTotals(motDong(695_000_000), 10);
    expect(t.withVat).toBe(764_500_000);
    expect(docTienVietNam(t.withVat)).toBe(
      "Bảy trăm sáu mươi tư triệu năm trăm nghìn đồng"
    );
    // Phải KHÁC chuỗi đọc từ cộng trước thuế — nếu bằng nhau là đang đọc nhầm cột.
    expect(docTienVietNam(t.withVat)).not.toBe(docTienVietNam(t.beforeVat));
  });

  it("số có hàng trăm rỗng đọc được chữ linh", () => {
    expect(docTienVietNam(1_000_005)).toBe("Một triệu không trăm linh năm đồng");
  });

  it("tổng bằng 0 vẫn ra chữ, không ra chuỗi rỗng", () => {
    const t = computeClientQuoteTotals([], 10);
    expect(docTienVietNam(t.withVat)).toBe("Không đồng");
  });
});

describe("partTotals", () => {
  it("gom tiền theo từng phần", () => {
    const m = partTotals([
      { partCode: "I", qty: 2, unitPrice: 100, amount: null },
      { partCode: "I", qty: null, unitPrice: null, amount: 50 },
      { partCode: "II", qty: 1, unitPrice: 700, amount: null },
    ]);
    expect(m.get("I")).toBe(250);
    expect(m.get("II")).toBe(700);
  });

  it("dòng không khai phần thì gom vào khóa rỗng, không mất tiền", () => {
    const m = partTotals([{ qty: 1, unitPrice: 900, amount: null }]);
    expect(m.get("")).toBe(900);
  });
});

describe("validatePaymentPercents", () => {
  const p = (...xs: (number | null)[]) => xs.map((percent) => ({ percent }));

  it("30 / 40 / 20 / 10 là hợp lệ", () => {
    expect(validatePaymentPercents(p(30, 40, 20, 10))).toMatchObject({ ok: true, sum: 100 });
  });

  it("thiếu 5% thì báo lỗi và nói rõ đang là bao nhiêu", () => {
    const r = validatePaymentPercents(p(30, 40, 20, 5));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("95");
  });

  it("thừa thì cũng báo lỗi", () => {
    const r = validatePaymentPercents(p(60, 60));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("120");
  });

  it("sai số số thực vẫn được chấp nhận", () => {
    expect(validatePaymentPercents(p(33.33, 33.33, 33.34)).ok).toBe(true);
  });

  it("ô để trống tính là 0", () => {
    expect(validatePaymentPercents(p(50, null, 50)).ok).toBe(true);
  });

  it("chưa nhập gì thì không chặn lưu", () => {
    expect(validatePaymentPercents([])).toMatchObject({ ok: true, error: null });
  });
});

describe("sumStageDays", () => {
  it("tổng các chặng mặc định đúng 55 ngày như mẫu", () => {
    expect(sumStageDays(DEFAULT_STAGES)).toBe(55);
  });

  it("không có chặng nào -> 0", () => {
    expect(sumStageDays([])).toBe(0);
  });

  it("chặng chưa điền số ngày thì bỏ qua", () => {
    expect(sumStageDays([{ days: 3 }, { days: null }, { days: 2 }])).toBe(5);
  });
});

describe("expiryFrom", () => {
  const ngay = new Date("2026-09-11T00:00:00.000Z");

  it("cộng đúng số ngày hiệu lực", () => {
    expect(expiryFrom(ngay, 7)?.toISOString().slice(0, 10)).toBe("2026-09-18");
  });

  it("thiếu ngày báo giá -> null", () => {
    expect(expiryFrom(null, 7)).toBeNull();
  });

  it("thiếu số ngày hiệu lực -> null", () => {
    expect(expiryFrom(ngay, null)).toBeNull();
  });

  it("hiệu lực 0 ngày là giá trị thật (hết hạn ngay), không phải null", () => {
    expect(expiryFrom(ngay, 0)?.toISOString().slice(0, 10)).toBe("2026-09-11");
  });

  it("không sửa vào đối tượng Date được truyền vào", () => {
    const goc = new Date("2026-09-11T00:00:00.000Z");
    expiryFrom(goc, 30);
    expect(goc.toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });
});

describe("roundVnd", () => {
  it("làm tròn về đồng", () => {
    expect(roundVnd(1.4)).toBe(1);
    expect(roundVnd(1.5)).toBe(2);
    expect(roundVnd(-1.5)).toBe(-1);
  });
});

describe("dữ liệu mặc định đã ship", () => {
  // Các mặc định này in thẳng ra báo giá gửi khách — một lỗi gõ là sai văn bản
  // gửi ra ngoài, nên chốt luôn bằng test.
  it("tiến độ thanh toán mặc định cộng đủ 100%", () => {
    expect(validatePaymentPercents(DEFAULT_PAYMENTS).ok).toBe(true);
  });

  it("bảng vật liệu có 10 dòng nhóm A và 6 dòng nhóm B", () => {
    expect(DEFAULT_SPECS.filter((s) => s.groupCode === "A")).toHaveLength(10);
    expect(DEFAULT_SPECS.filter((s) => s.groupCode === "B")).toHaveLength(6);
  });

  it("mọi dòng vật liệu đều có tên", () => {
    expect(DEFAULT_SPECS.every((s) => s.name.trim().length > 0)).toBe(true);
  });
});
