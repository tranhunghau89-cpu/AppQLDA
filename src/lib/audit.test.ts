import { describe, expect, it } from "vitest";
import { AUDIT_ENTITY, diffFields, FIELD_LABEL } from "./audit";

const F = ["salePrice", "status", "note", "signDate"] as const;

describe("diffFields", () => {
  it("chỉ giữ trường thực sự đổi", () => {
    const d = diffFields(
      { salePrice: 1000, status: "CHO", note: "x" },
      { salePrice: 1200, status: "CHO", note: "x" },
      F
    );
    expect(d).toEqual({ salePrice: { truoc: 1000, sau: 1200 } });
  });

  it("không đổi gì -> null (không ghi nhật ký thừa)", () => {
    expect(diffFields({ salePrice: 1000 }, { salePrice: 1000 }, F)).toBeNull();
  });

  it("null và undefined coi như cùng nghĩa 'chưa có'", () => {
    expect(diffFields({ note: null }, { note: undefined }, F)).toBeNull();
    expect(diffFields({}, { note: null }, F)).toBeNull();
  });

  it("từ chưa có sang có giá trị vẫn được ghi", () => {
    expect(diffFields({ salePrice: null }, { salePrice: 500 }, F)).toEqual({
      salePrice: { truoc: null, sau: 500 },
    });
  });

  it("xóa giá trị (có -> null) cũng được ghi", () => {
    expect(diffFields({ salePrice: 500 }, { salePrice: null }, F)).toEqual({
      salePrice: { truoc: 500, sau: null },
    });
  });

  it("0 khác null — không nhầm 0 thành 'chưa có'", () => {
    expect(diffFields({ salePrice: null }, { salePrice: 0 }, F)).toEqual({
      salePrice: { truoc: null, sau: 0 },
    });
  });

  it("Date bằng nhau thì không tính là đổi", () => {
    const a = new Date("2026-05-01T00:00:00Z");
    const b = new Date("2026-05-01T00:00:00Z");
    expect(diffFields({ signDate: a }, { signDate: b }, F)).toBeNull();
  });

  it("Date so được với chuỗi ISO cùng thời điểm", () => {
    const a = new Date("2026-05-01T00:00:00Z");
    expect(diffFields({ signDate: a }, { signDate: "2026-05-01T00:00:00.000Z" }, F)).toBeNull();
  });

  it("Date khác nhau -> ghi dạng chuỗi ISO (JSON lưu được)", () => {
    const d = diffFields(
      { signDate: new Date("2026-05-01T00:00:00Z") },
      { signDate: new Date("2026-06-01T00:00:00Z") },
      F
    );
    expect(d?.signDate.truoc).toBe("2026-05-01T00:00:00.000Z");
    expect(d?.signDate.sau).toBe("2026-06-01T00:00:00.000Z");
  });

  it("bỏ qua trường không nằm trong danh sách theo dõi", () => {
    expect(diffFields({ khac: 1 }, { khac: 2 }, F)).toBeNull();
  });

  it("bản ghi mới (trước = null) ghi mọi trường có giá trị", () => {
    const d = diffFields(null, { salePrice: 100, status: "CHO", note: null }, F);
    expect(d).toEqual({
      salePrice: { truoc: null, sau: 100 },
      status: { truoc: null, sau: "CHO" },
    });
  });

  it("undefined thành null khi lưu (JSON không có undefined)", () => {
    const d = diffFields({ salePrice: 1 }, {}, F);
    expect(d).toEqual({ salePrice: { truoc: 1, sau: null } });
  });
});

describe("nhãn hiển thị", () => {
  it("mọi thực thể theo dõi đều có nhãn tiếng Việt", () => {
    for (const [k, v] of Object.entries(AUDIT_ENTITY)) {
      expect(v, k).toBeTruthy();
    }
  });

  it("các trường tiền quan trọng đều có nhãn", () => {
    for (const f of ["salePrice", "valueWithVat", "amount", "paidAmount", "unitPrice"]) {
      expect(FIELD_LABEL[f], f).toBeTruthy();
    }
  });
});
