import { describe, expect, it } from "vitest";
import { docGiaiDoan, ghepLoc, whereGiaiDoan, GIAI_DOAN } from "./giaiDoan";

describe("docGiaiDoan", () => {
  it("đọc đúng hai giá trị thật", () => {
    expect(docGiaiDoan("CHAO_GIA")).toBe("CHAO_GIA");
    expect(docGiaiDoan("DU_AN")).toBe("DU_AN");
  });

  it("thiếu hoặc lạ thì rơi về Tất cả, không throw", () => {
    // Tham số URL ai gõ cũng được; hiện thừa vẫn tốt hơn hiện trang trắng.
    expect(docGiaiDoan(undefined)).toBe("TAT_CA");
    expect(docGiaiDoan("")).toBe("TAT_CA");
    expect(docGiaiDoan("lung-tung")).toBe("TAT_CA");
    expect(docGiaiDoan("chao_gia")).toBe("TAT_CA"); // phân biệt hoa thường
  });

  it("tham số lặp thì lấy cái đầu", () => {
    expect(docGiaiDoan(["DU_AN", "CHAO_GIA"])).toBe("DU_AN");
    expect(docGiaiDoan([])).toBe("TAT_CA");
  });

  it("mọi lựa chọn trên giao diện đều đọc lại được", () => {
    for (const g of GIAI_DOAN) expect(docGiaiDoan(g.value)).toBe(g.value);
  });
});

describe("whereGiaiDoan", () => {
  it("đang chào giá = có cơ hội", () => {
    expect(whereGiaiDoan("CHAO_GIA")).toEqual({ coHoiId: { not: null } });
  });

  it("đã ký = có dự án", () => {
    expect(whereGiaiDoan("DU_AN")).toEqual({ projectId: { not: null } });
  });

  it("tất cả = mệnh đề rỗng", () => {
    expect(whereGiaiDoan("TAT_CA")).toEqual({});
  });
});

describe("ghepLoc", () => {
  const pham = { OR: [{ projectId: { in: ["p1"] } }, { coHoi: { khachHang: {} } }] };

  it('"Tất cả" trả nguyên mệnh đề phạm vi, không bọc thêm', () => {
    expect(ghepLoc(pham, "TAT_CA")).toBe(pham);
  });

  it("quản trị viên (phạm vi rỗng) + lọc giai đoạn = chỉ còn giai đoạn", () => {
    expect(ghepLoc({}, "CHAO_GIA")).toEqual({ coHoiId: { not: null } });
  });

  it("quản trị viên + Tất cả = vẫn rỗng", () => {
    expect(ghepLoc({}, "TAT_CA")).toEqual({});
  });

  it("ghép bằng AND, KHÔNG nuốt mệnh đề phạm vi", () => {
    // Đây là cái phải chốt: lọc giai đoạn là tiện nghi hiển thị, tuyệt đối không được
    // nới rộng những gì người dùng được nhìn thấy.
    const w = ghepLoc(pham, "DU_AN");
    expect(w).toEqual({ AND: [pham, { projectId: { not: null } }] });
    expect((w.AND as unknown[])[0]).toBe(pham);
  });

  it("không bao giờ sinh mệnh đề rỗng từ một phạm vi khác rỗng", () => {
    // Mệnh đề rỗng = thấy toàn bộ bảng.
    for (const g of GIAI_DOAN) {
      const w = ghepLoc(pham, g.value);
      expect(Object.keys(w).length).toBeGreaterThan(0);
    }
  });

  it("không sửa đối tượng đầu vào", () => {
    const goc = { OR: [{ projectId: { in: ["p1"] } }] };
    const truoc = JSON.stringify(goc);
    ghepLoc(goc, "CHAO_GIA");
    expect(JSON.stringify(goc)).toBe(truoc);
  });
});
