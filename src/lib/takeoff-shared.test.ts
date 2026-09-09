import { describe, expect, it } from "vitest";
import { BT_GROUP_MAP, computeBuiltUp, computeConcrete, computePlate } from "./takeoff-shared";

describe("computeConcrete", () => {
  it("móng: BT = L×B×H, VK = 2(L+B)×H", () => {
    expect(computeConcrete("FD", 2, 1.5, 0.5)).toEqual({ concrete: 1.5, formwork: 3.5 });
  });

  it("sàn: VK chỉ tính mặt đáy", () => {
    expect(computeConcrete("FL", 6, 4, 0.12)).toEqual({ concrete: 2.88, formwork: 24 });
  });

  it("dầm: VK = (b + 2h) × L", () => {
    const r = computeConcrete("FR", 0.2, 0.4, 5);
    expect(r.concrete).toBeCloseTo(0.4);
    expect(r.formwork).toBeCloseTo(5);
  });

  it("vách: VK = 2 × L × H (không tính bề dày)", () => {
    const r = computeConcrete("WA", 5, 0.2, 3);
    expect(r.concrete).toBeCloseTo(3);
    expect(r.formwork).toBe(30);
  });

  it("nhóm không hợp lệ -> 0, không ném lỗi", () => {
    expect(computeConcrete("XX", 1, 2, 3)).toEqual({ concrete: 0, formwork: 0 });
  });

  it("mọi nhóm khai báo trong BT_GROUPS đều tính được", () => {
    for (const g of Object.keys(BT_GROUP_MAP)) {
      const r = computeConcrete(g, 1, 1, 1);
      expect(r.concrete).toBeGreaterThan(0);
      expect(r.formwork).toBeGreaterThan(0);
    }
  });
});

describe("computeBuiltUp — thép tổ hợp I hàn", () => {
  it("tính theo 2 bản cánh + bụng, γ = 7850 kg/m³", () => {
    // cánh 200×8 ×2, bụng 384×6, dài 6m
    const expected = ((2 * 200 * 8 + 384 * 6) * 6 * 7850) / 1e6;
    expect(computeBuiltUp(200, 8, 384, 6, 6)).toBeCloseTo(expected);
    expect(computeBuiltUp(200, 8, 384, 6, 6)).toBeCloseTo(259.24, 2);
  });

  it("chiều dài 0 -> 0 kg", () => {
    expect(computeBuiltUp(200, 8, 384, 6, 0)).toBe(0);
  });

  it("tuyến tính theo chiều dài", () => {
    expect(computeBuiltUp(200, 8, 384, 6, 12)).toBeCloseTo(
      computeBuiltUp(200, 8, 384, 6, 6) * 2
    );
  });
});

describe("computePlate — bản mã", () => {
  it("tấm 200×300×10 mm ≈ 4,71 kg", () => {
    expect(computePlate(200, 300, 10)).toBeCloseTo(4.71, 2);
  });

  it("bề dày 0 -> 0 kg", () => {
    expect(computePlate(200, 300, 0)).toBe(0);
  });
});
