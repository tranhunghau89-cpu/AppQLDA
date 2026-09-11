import { describe, expect, it } from "vitest";
import {
  duocDungKhachHang,
  whereBaoGiaTrongPhamVi,
  whereKhachHangTrongPhamVi,
  type AiDo,
} from "./crmScope";

const admin: AiDo = { userId: "u-admin", role: "ADMIN" };
const sales: AiDo = { userId: "u-sales", role: "SALES" };
const salesKhac: AiDo = { userId: "u-khac", role: "SALES" };

describe("whereKhachHangTrongPhamVi", () => {
  it("quản trị viên thấy tất cả", () => {
    expect(whereKhachHangTrongPhamVi(admin)).toEqual({});
  });

  it("người thường chỉ thấy khách mình phụ trách và khách chưa phân công", () => {
    expect(whereKhachHangTrongPhamVi(sales)).toEqual({
      OR: [{ ownerId: "u-sales" }, { ownerId: null }],
    });
  });

  it("hai người khác nhau ra hai mệnh đề khác nhau", () => {
    expect(whereKhachHangTrongPhamVi(sales)).not.toEqual(
      whereKhachHangTrongPhamVi(salesKhac)
    );
  });

  it("người thường KHÔNG bao giờ nhận mệnh đề rỗng", () => {
    // Mệnh đề rỗng = thấy toàn bộ bảng. Đây là lỗi nguy hiểm nhất của cả khối này.
    for (const vai of ["SALES", "ENGINEERING", "PROCUREMENT", "ACCOUNTING", "LA_GI"]) {
      expect(whereKhachHangTrongPhamVi({ userId: "u", role: vai })).not.toEqual({});
    }
  });
});

describe("duocDungKhachHang", () => {
  it("quản trị viên đụng được mọi khách", () => {
    expect(duocDungKhachHang(admin, "u-khac")).toBe(true);
  });

  it("đụng được khách của chính mình", () => {
    expect(duocDungKhachHang(sales, "u-sales")).toBe(true);
  });

  it("KHÔNG đụng được khách của người khác", () => {
    expect(duocDungKhachHang(sales, "u-khac")).toBe(false);
  });

  it("khách chưa phân công thì ai cũng nhận được", () => {
    expect(duocDungKhachHang(sales, null)).toBe(true);
  });
});

describe("whereBaoGiaTrongPhamVi", () => {
  it("quản trị viên thấy tất cả", () => {
    expect(whereBaoGiaTrongPhamVi(admin, "ALL")).toEqual({});
    expect(whereBaoGiaTrongPhamVi(admin, [])).toEqual({});
  });

  it("người thường gộp hai nguồn: dự án được gán và khách mình phụ trách", () => {
    const w = whereBaoGiaTrongPhamVi(sales, ["p1", "p2"]);
    expect(w).toEqual({
      OR: [
        { projectId: { in: ["p1", "p2"] } },
        { coHoi: { khachHang: { OR: [{ ownerId: "u-sales" }, { ownerId: null }] } } },
      ],
    });
  });

  it("không dự án nào, không khách nào -> vẫn là mệnh đề LỌC, không phải rỗng", () => {
    // Ca dễ sai nhất: người mới, chưa được gán gì. Nếu ra {} thì họ thấy báo giá của
    // cả công ty ngay ngày đầu.
    const w = whereBaoGiaTrongPhamVi(sales, []);
    expect(w).not.toEqual({});
    expect((w.OR as unknown[])[0]).toEqual({ projectId: { in: [] } });
  });

  it("mệnh đề OR không bao giờ chứa nhánh rỗng", () => {
    // { OR: [{}, ...] } khớp MỌI dòng — đúng cái bẫy đã ghi trong plan/31.
    const w = whereBaoGiaTrongPhamVi(sales, ["p1"]);
    for (const nhanh of w.OR as Record<string, unknown>[]) {
      expect(Object.keys(nhanh).length).toBeGreaterThan(0);
    }
  });

  it('duAnTrongPhamVi = "ALL" cũng cho mệnh đề rỗng, kể cả khi vai không phải ADMIN', () => {
    // myProjectIds chỉ trả "ALL" cho ADMIN, nhưng nếu sau này có vai khác được như
    // vậy thì hàm này phải xử lý nhất quán chứ không ghép "ALL" vào mảng.
    expect(whereBaoGiaTrongPhamVi(sales, "ALL")).toEqual({});
  });
});
