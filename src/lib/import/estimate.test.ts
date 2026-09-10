import { describe, expect, it } from "vitest";
import { bocTachDuToan, phanNhom, type SheetLike } from "./estimate-parse";

/** Dựng một worksheet giả từ lưới [dòng][cột] 1-based, để test không cần file Excel. */
function sheet(grid: Record<number, Record<number, unknown>>, rowCount: number): SheetLike {
  return {
    rowCount,
    getCell: (r, c) => ({ value: (grid[r]?.[c] ?? null) as never }),
  };
}

describe("phanNhom", () => {
  it("nhận diện nhóm theo từ khóa, không phụ thuộc dấu", () => {
    expect(phanNhom("Thép hình H350", "")).toBe("KCT");
    expect(phanNhom("Tôn mạ màu 0.45", "")).toBe("TON");
    expect(phanNhom("Xà gồ C200", "")).toBe("XA_GO");
    expect(phanNhom("Bu lông neo M24", "")).toBe("BL_NEO");
    expect(phanNhom("Vận chuyển", "")).toBe("VAN_CHUYEN");
  });

  it("dùng cả tên mục cha để phân nhóm", () => {
    expect(phanNhom("Chi phí", "Lắp dựng")).toBe("NHAN_CONG");
  });

  it("không khớp gì -> KHAC", () => {
    expect(phanNhom("Mục lạ", "")).toBe("KHAC");
  });

  it("bu lông neo được ưu tiên trước bu lông liên kết", () => {
    expect(phanNhom("Bu lông neo", "")).toBe("BL_NEO");
    expect(phanNhom("Bu lông liên kết", "")).toBe("BLLK");
  });

  // "lợp" và "lắp" đều chuẩn hóa gần nhau; nhánh nhân công được kiểm TRƯỚC nhóm tôn.
  // Đã đối chiếu dữ liệu thật: cả 26 dòng chứa "lợp" đều là "Lợp tôn" — công lắp đặt,
  // nên NHAN_CONG là đúng. Ghi lại đây để lần sau không ai "sửa" nhầm.
  it("'Lợp tôn' là công lắp đặt -> NHAN_CONG, không phải vật tư TON", () => {
    expect(phanNhom("Lợp tôn", "")).toBe("NHAN_CONG");
  });
});

describe("bocTachDuToan", () => {
  it("cộng diện tích từ D3:D7 và bóc đúng dòng vật tư", () => {
    const ws = sheet(
      {
        3: { 4: 300 },
        4: { 4: 200 },
        9: { 1: "A" },
        10: { 1: "1", 2: "Kết cấu chính" },
        11: { 2: "Thép hình H350", 3: "kg", 4: 5000, 5: 22000, 6: 110_000_000 },
        12: { 2: "Tôn mạ màu 0.45", 3: "m2", 4: 500, 5: 120000, 6: 60_000_000 },
      },
      12
    );
    const r = bocTachDuToan(ws);
    expect(r.area).toBe(500);
    expect(r.dong).toHaveLength(2);
    expect(r.total).toBe(170_000_000);
    expect(r.dong[0].groupCode).toBe("KCT");
    expect(r.dong[1].groupCode).toBe("TON");
  });

  it("dòng tiêu đề mục (cột A có số) bị bỏ qua — nếu không sẽ cộng trùng subtotal", () => {
    const ws = sheet(
      {
        9: { 1: "A" },
        10: { 1: "1", 2: "Kết cấu chính", 6: 999_999_999 },
        11: { 2: "Thép hình", 6: 100 },
      },
      11
    );
    const r = bocTachDuToan(ws);
    expect(r.dong).toHaveLength(1);
    expect(r.total).toBe(100);
  });

  it("ghi ngữ cảnh nhóm và mục vào ghi chú", () => {
    const ws = sheet(
      { 9: { 1: "B" }, 10: { 1: "1", 2: "Tôn vách" }, 11: { 2: "Tôn 0.45", 6: 50 } },
      11
    );
    expect(bocTachDuToan(ws).dong[0].note).toContain("Vách › Tôn vách");
  });

  it("đọc được ô CÔNG THỨC (file dự toán thật đầy công thức)", () => {
    const ws = sheet(
      {
        3: { 4: { formula: "SUM(X)", result: 250 } },
        9: { 1: "A" },
        11: { 2: "Thép", 6: { formula: "D11*E11", result: 700 } },
      },
      11
    );
    const r = bocTachDuToan(ws);
    expect(r.area).toBe(250);
    expect(r.total).toBe(700);
  });

  it("bỏ dòng có thành tiền bằng 0 hoặc trống", () => {
    const ws = sheet(
      { 9: { 1: "A" }, 10: { 2: "Không tiền", 6: 0 }, 11: { 2: "Có tiền", 6: 5 } },
      11
    );
    expect(bocTachDuToan(ws).dong).toHaveLength(1);
  });

  it("dòng trước khi có chữ cái nhóm thì bỏ qua", () => {
    const ws = sheet({ 9: { 2: "Mồ côi", 6: 100 }, 10: { 1: "A" }, 11: { 2: "Thép", 6: 50 } }, 11);
    expect(bocTachDuToan(ws).dong).toHaveLength(1);
  });

  it("giá bán ở J1 được nhận khi hợp lý", () => {
    const ws = sheet({ 1: { 10: 200 }, 9: { 1: "A" }, 10: { 2: "Thép", 6: 100 } }, 10);
    expect(bocTachDuToan(ws).sale).toBe(200);
  });

  it("giá bán ở J1 lớn bất thường bị loại kèm cảnh báo — tránh nhập số rác", () => {
    const ws = sheet({ 1: { 10: 999_999_999 }, 9: { 1: "A" }, 10: { 2: "Thép", 6: 100 } }, 10);
    const r = bocTachDuToan(ws);
    expect(r.sale).toBeNull();
    expect(r.canhBao.join(" ")).toContain("J1");
  });

  it("sheet rỗng -> cảnh báo rõ ràng chứ không im lặng nhập 0 dòng", () => {
    const r = bocTachDuToan(sheet({}, 5));
    expect(r.dong).toHaveLength(0);
    expect(r.canhBao.join(" ")).toContain("Không tìm thấy dòng vật tư");
  });

  it("thiếu diện tích thì cảnh báo và giữ null", () => {
    const ws = sheet({ 9: { 1: "A" }, 10: { 2: "Thép", 6: 100 } }, 10);
    const r = bocTachDuToan(ws);
    expect(r.area).toBeNull();
    expect(r.canhBao.join(" ")).toContain("diện tích");
  });

  it("sortOrder tăng dần theo thứ tự trong file", () => {
    const ws = sheet(
      { 9: { 1: "A" }, 10: { 2: "X", 6: 1 }, 11: { 2: "Y", 6: 2 }, 12: { 2: "Z", 6: 3 } },
      12
    );
    expect(bocTachDuToan(ws).dong.map((d) => d.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe("cảnh báo phải đọc được, không nhiễu", () => {
  it("gộp mọi dòng thiếu thành tiền thành MỘT cảnh báo", () => {
    const grid: Record<number, Record<number, unknown>> = { 9: { 1: "A" } };
    for (let r = 10; r < 40; r++) grid[r] = { 2: `Hạng mục trống ${r}` };
    grid[40] = { 2: "Thép hình", 6: 100 };
    const r = bocTachDuToan(sheet(grid, 40));
    const veThieuTien = r.canhBao.filter((c) => c.includes("không có thành tiền"));
    expect(veThieuTien).toHaveLength(1);
    expect(veThieuTien[0]).toContain("30 dòng");
  });

  it("tổng số cảnh báo giữ ở mức đọc được", () => {
    const grid: Record<number, Record<number, unknown>> = { 9: { 1: "A" } };
    for (let r = 10; r < 60; r++) grid[r] = { 2: `Trống ${r}` };
    expect(bocTachDuToan(sheet(grid, 60)).canhBao.length).toBeLessThanOrEqual(5);
  });
});
