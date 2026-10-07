import { describe, expect, it } from "vitest";
import { baoGiaGiaiDoan, loiNhuanGiaiDoan } from "./giaTriGiaiDoan";
import { computeActualCost } from "./profit";
import { settlementFromContracts } from "./contract";

const g = { baoGia: 600, duToan: 400, muaHang: 450, soDongCoGiaThuc: 1, soDong: 2, hopDong: 573, quyetToan: null };

describe("loiNhuanGiaiDoan", () => {
  it("chưa QT → tạm tính theo HĐ", () => {
    expect(loiNhuanGiaiDoan(g)).toMatchObject({ duKien: 173, thucTe: 123, tamTinh: true });
  });
  it("có QT → dùng QT", () => {
    expect(loiNhuanGiaiDoan({ ...g, quyetToan: 600 })).toMatchObject({ thucTe: 150, tamTinh: false });
  });
  it("chưa có HĐ lẫn QT → không tính", () => {
    expect(loiNhuanGiaiDoan({ ...g, hopDong: null })).toMatchObject({ duKien: null, thucTe: null });
  });
});

describe("baoGiaGiaiDoan", () => {
  const d = (n: number) => new Date(2026, 0, n);
  it("ưu tiên bản đã chốt", () => {
    expect(
      baoGiaGiaiDoan([
        { status: "CHOT", createdAt: d(1), beforeVat: 100 },
        { status: "DA_GUI", createdAt: d(5), beforeVat: 200 },
      ])
    ).toBe(100);
  });
  it("không có chốt → bản mới nhất, bỏ huỷ", () => {
    expect(
      baoGiaGiaiDoan([
        { status: "DA_GUI", createdAt: d(1), beforeVat: 100 },
        { status: "HUY", createdAt: d(9), beforeVat: 999 },
        { status: "NHAP", createdAt: d(5), beforeVat: 200 },
      ])
    ).toBe(200);
  });
  it("không có bản nào → null", () => expect(baoGiaGiaiDoan([])).toBeNull());
});

describe("computeActualCost", () => {
  it("dòng chưa có giá thực tạm lấy dự toán; KL thực trống dùng KL dự toán", () => {
    const base = { groupCode: "KCT", actualQty: null, amount: null };
    expect(
      computeActualCost([
        { ...base, designQty: 10, unitPrice: 5, actualUnitPrice: 6 },
        { ...base, designQty: 2, unitPrice: 100 },
        { ...base, designQty: 1, actualQty: 3, unitPrice: 1, actualUnitPrice: 2 },
      ])
    ).toEqual({ total: 60 + 200 + 6, soDongCoGia: 2, soDong: 3 });
  });
});

describe("settlementFromContracts", () => {
  it("chưa dòng nào QT → null", () => {
    expect(settlementFromContracts([{ status: "SIGNED", items: [{ qty: 1, unitPrice: 5 }] }])).toBeNull();
  });
  it("dòng chưa QT giữ giá HĐ, bỏ HĐ nháp", () => {
    expect(
      settlementFromContracts([
        { status: "SIGNED", items: [{ qty: 180, unitPrice: 10, settleQty: 185 }, { qty: 1, unitPrice: 7 }] },
        { status: "QUOTE", items: [{ qty: 1, unitPrice: 999, settleQty: 1 }] },
      ])
    ).toBe(1850 + 7);
  });
});
