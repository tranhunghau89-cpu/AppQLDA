import { describe, expect, it } from "vitest";
import {
  deriveLines,
  repriceLines,
  roundUnitPrice,
  unitPriceFromSection,
  type DeriveSpec,
  type SourceSection,
} from "./clientQuoteDerive";
import { lineAmount } from "./clientQuote";

const spec = (over: Partial<DeriveSpec> = {}): DeriveSpec => ({
  partCode: "I",
  partName: "Phần kết cấu thép",
  code: "01",
  name: "Gia công sản xuất, lắp dựng khung nhà thép phần mái",
  detail: null,
  unit: "m2",
  note: null,
  sourceSectionCode: "A",
  defaultUnitPrice: null,
  ...over,
});

const phanA: SourceSection = { id: "sec-a", code: "A", area: 1000 };

describe("unitPriceFromSection", () => {
  it("chia tổng tiền cho diện tích", () => {
    expect(unitPriceFromSection(695_000_000, 1000)).toBe(695_000);
  });

  it("diện tích null / 0 / âm -> null, không bao giờ Infinity hay NaN", () => {
    for (const area of [null, 0, -5]) {
      const v = unitPriceFromSection(695_000_000, area);
      expect(v).toBeNull();
      expect(Number.isFinite(v as unknown as number)).toBe(false);
    }
  });

  it("tổng tiền bằng 0 -> đơn giá 0 (hợp lệ, không phải null)", () => {
    expect(unitPriceFromSection(0, 1000)).toBe(0);
  });
});

describe("roundUnitPrice", () => {
  it("làm tròn về bội số nghìn", () => {
    expect(roundUnitPrice(694_950)).toBe(695_000);
    expect(roundUnitPrice(694_400)).toBe(694_000);
  });

  it("step = 1 là làm tròn về đồng", () => {
    expect(roundUnitPrice(694_400.6, 1)).toBe(694_401);
  });

  it("null vào thì null ra", () => {
    expect(roundUnitPrice(null)).toBeNull();
  });
});

describe("deriveLines", () => {
  it("tái hiện đúng dòng 01 của báo giá mẫu", () => {
    const { lines, warnings } = deriveLines(
      [spec()],
      [phanA],
      new Map([["sec-a", 695_000_000]]),
      null
    );
    expect(warnings).toEqual([]);
    expect(lines[0]).toMatchObject({
      qty: 1000,
      unitPrice: 695_000,
      amount: null,
      sourceSectionId: "sec-a",
    });
    // Thành tiền tự tính lại phải khớp con số trong báo giá gốc.
    expect(lineAmount(lines[0])).toBe(695_000_000);
  });

  it("phần thiếu diện tích thì rơi về diện tích dự án", () => {
    const { lines, warnings } = deriveLines(
      [spec()],
      [{ id: "sec-a", code: "A", area: null }],
      new Map([["sec-a", 695_000_000]]),
      500
    );
    expect(warnings).toEqual([]);
    expect(lines[0].qty).toBe(500);
    expect(lines[0].unitPrice).toBe(1_390_000);
  });

  it("không có diện tích nào -> để trống đơn giá kèm cảnh báo, KHÔNG bỏ dòng", () => {
    const { lines, warnings } = deriveLines(
      [spec()],
      [{ id: "sec-a", code: "A", area: null }],
      new Map([["sec-a", 695_000_000]]),
      null
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].unitPrice).toBeNull();
    expect(warnings[0]).toContain("diện tích");
  });

  it("diện tích bằng 0 cũng cảnh báo chứ không chia cho 0", () => {
    const { lines, warnings } = deriveLines(
      [spec()],
      [{ id: "sec-a", code: "A", area: 0 }],
      new Map([["sec-a", 695_000_000]]),
      null
    );
    expect(lines[0].unitPrice).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it("phần chưa có đơn giá bán -> đơn giá 0 kèm cảnh báo", () => {
    // Rất dễ xảy ra thật: QuoteItem.sellPrice cho phép null và lineSell coi null = 0.
    const { lines, warnings } = deriveLines([spec()], [phanA], new Map(), null);
    expect(lines[0].unitPrice).toBe(0);
    expect(warnings[0]).toContain("chưa có đơn giá bán");
  });

  it("mã phần không khớp -> giữ dòng, để trống, cảnh báo", () => {
    const { lines, warnings } = deriveLines(
      [spec({ sourceSectionCode: "Z" })],
      [phanA],
      new Map([["sec-a", 695_000_000]]),
      null
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].sourceSectionId).toBeNull();
    expect(warnings[0]).toContain("Z");
  });

  it("so mã phần không phân biệt hoa thường và dấu cách", () => {
    const { lines, warnings } = deriveLines(
      [spec({ sourceSectionCode: " a " })],
      [phanA],
      new Map([["sec-a", 695_000_000]]),
      null
    );
    expect(warnings).toEqual([]);
    expect(lines[0].unitPrice).toBe(695_000);
  });

  it("dòng không gắn phần thì dùng đơn giá mặc định của mẫu, không cảnh báo", () => {
    const { lines, warnings } = deriveLines(
      [spec({ sourceSectionCode: null, defaultUnitPrice: 1_104_000, name: "Cửa đẩy chớp" })],
      [phanA],
      new Map([["sec-a", 695_000_000]]),
      null
    );
    expect(warnings).toEqual([]);
    expect(lines[0]).toMatchObject({ qty: null, unitPrice: 1_104_000, sourceSectionId: null });
  });

  it("giữ nguyên thứ tự và nội dung khuôn", () => {
    const { lines } = deriveLines(
      [spec({ code: "01" }), spec({ code: "02", sourceSectionCode: null })],
      [phanA],
      new Map([["sec-a", 1000]]),
      null
    );
    expect(lines.map((l) => l.code)).toEqual(["01", "02"]);
    expect(lines[0].partName).toBe("Phần kết cấu thép");
  });
});

describe("repriceLines", () => {
  const secs = [phanA];
  const subs = new Map([["sec-a", 700_000_000]]);

  it("tính lại dòng được sinh tự động", () => {
    const r = repriceLines(
      [{ id: "l1", sourceSectionId: "sec-a", priceOverridden: false }],
      secs,
      subs,
      null
    );
    expect(r.updates).toEqual([{ id: "l1", qty: 1000, unitPrice: 700_000 }]);
    expect(r.skipped).toBe(0);
  });

  it("BỎ QUA dòng đã đè giá — không ghi đè công sức người dùng", () => {
    const r = repriceLines(
      [{ id: "l1", sourceSectionId: "sec-a", priceOverridden: true }],
      secs,
      subs,
      null
    );
    expect(r.updates).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it("bỏ qua dòng nhập tay (không gắn phần), không tính là đã bỏ qua", () => {
    const r = repriceLines(
      [{ id: "l1", sourceSectionId: null, priceOverridden: false }],
      secs,
      subs,
      null
    );
    expect(r.updates).toEqual([]);
    expect(r.skipped).toBe(0);
  });

  it("phần đã bị xóa khỏi báo giá chi tiết -> cảnh báo, không sửa gì", () => {
    const r = repriceLines(
      [{ id: "l1", sourceSectionId: "da-xoa", priceOverridden: false }],
      secs,
      subs,
      null
    );
    expect(r.updates).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it("phần mất diện tích -> cảnh báo, giữ nguyên đơn giá cũ", () => {
    const r = repriceLines(
      [{ id: "l1", sourceSectionId: "sec-a", priceOverridden: false }],
      [{ id: "sec-a", code: "A", area: null }],
      subs,
      null
    );
    expect(r.updates).toEqual([]);
    expect(r.warnings[0]).toContain("diện tích");
  });

  it("hỗn hợp: cập nhật dòng thường, giữ dòng đã đè", () => {
    const r = repriceLines(
      [
        { id: "l1", sourceSectionId: "sec-a", priceOverridden: false },
        { id: "l2", sourceSectionId: "sec-a", priceOverridden: true },
      ],
      secs,
      subs,
      null
    );
    expect(r.updates.map((u) => u.id)).toEqual(["l1"]);
    expect(r.skipped).toBe(1);
  });
});
