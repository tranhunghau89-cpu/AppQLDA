import { describe, expect, it } from "vitest";
import { contractData, contractSchema, itemData, itemSchema, loiDongHangMuc } from "./hopDongDuLieu";

describe("contractSchema + contractData", () => {
  const form = {
    contractNo: " 0704/2026 ",
    signDate: "2026-04-07",
    effectiveDate: "",
    durationDays: "90",
    subject: "Nhà thép",
    partyAName: "ABC",
    partyAInfo: "",
    status: "SIGNED",
    vatPercent: "8",
    paymentTerms: "",
    filePath: "",
    note: "",
  };

  it("form tay (chuỗi) và bản nháp AI (số) ra cùng một dữ liệu ghi", () => {
    const tuForm = contractData(contractSchema.parse(form));
    const tuAi = contractData(contractSchema.parse({ ...form, durationDays: 90, vatPercent: 8 }));
    expect(tuAi).toEqual(tuForm);
    expect(tuForm).toMatchObject({
      contractNo: "0704/2026",
      signDate: new Date("2026-04-07"),
      effectiveDate: null,
      durationDays: 90,
      vatPercent: 8,
      partyAInfo: null,
    });
  });

  it("chặn thiếu số HĐ, trạng thái lạ, thời hạn lẻ", () => {
    expect(contractSchema.safeParse({ ...form, contractNo: " " }).success).toBe(false);
    expect(contractSchema.safeParse({ ...form, status: "XYZ" }).success).toBe(false);
    expect(contractSchema.safeParse({ ...form, durationDays: 1.5 }).success).toBe(false);
  });
});

describe("hạng mục", () => {
  const dong = (v: Record<string, unknown>) => itemSchema.parse({ name: "Khung", unit: "", qty: "", unitPrice: "", amount: "", ...v });

  it("dòng khoán chỉ cần thành tiền", () => {
    expect(loiDongHangMuc(dong({ amount: 1_000 }))).toBeNull();
  });

  it("không có thành tiền thì phải đủ KL và đơn giá", () => {
    expect(loiDongHangMuc(dong({ unitPrice: 5 }))).toBe("Chưa nhập khối lượng");
    expect(loiDongHangMuc(dong({ qty: 5 }))).toBe("Chưa nhập đơn giá");
    expect(loiDongHangMuc(dong({ qty: 5, unitPrice: 2 }))).toBeNull();
  });

  it("đơn vị trống thành null", () => {
    expect(itemData(dong({ qty: 5, unitPrice: 2 }))).toEqual({
      name: "Khung", unit: null, qty: 5, unitPrice: 2, amount: null,
    });
  });
});
