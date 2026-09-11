import { describe, expect, it } from "vitest";
import { docYeuCau, tieuDeCuoi, type OForm } from "./lapBaoGiaNhanh";

function o(p: Partial<OForm> = {}): OForm {
  return {
    khachMode: "CO_SAN",
    khachHangId: "kh1",
    khachTen: "",
    khachNguoiLienHe: "",
    khachPhone: "",
    coHoiMode: "CO_SAN",
    coHoiId: "ch1",
    coHoiTen: "",
    coHoiDiaDiem: "",
    coHoiBuildingType: "",
    coHoiArea: "",
    title: "",
    templateId: "",
    ...p,
  };
}

describe("docYeuCau — khách", () => {
  it("khách có sẵn", () => {
    const r = docYeuCau(o());
    expect(r.ok && r.yeuCau.khach).toEqual({ loai: "CO_SAN", id: "kh1" });
  });

  it("khách có sẵn mà chưa chọn ai -> lỗi", () => {
    const r = docYeuCau(o({ khachHangId: "" }));
    expect(r).toEqual({ ok: false, loi: "Hãy chọn khách hàng." });
  });

  it("khách mới, đủ tên", () => {
    const r = docYeuCau(
      o({
        khachMode: "MOI",
        khachTen: "  Công ty CP ABC  ",
        khachPhone: "0901234567",
        coHoiMode: "MOI",
        coHoiTen: "Nhà xưởng Hồng Ngự",
      })
    );
    expect(r.ok && r.yeuCau.khach).toEqual({
      loai: "MOI",
      tenCty: "Công ty CP ABC",
      nguoiLienHe: null,
      phone: "0901234567",
    });
  });

  it("khách mới mà tên rỗng hoặc chỉ khoảng trắng -> lỗi", () => {
    for (const ten of ["", "   "]) {
      const r = docYeuCau(o({ khachMode: "MOI", khachTen: ten }));
      expect(r).toEqual({ ok: false, loi: "Tên khách hàng không được để trống." });
    }
  });

  it("chế độ lạ -> lỗi rõ ràng, không đoán bừa", () => {
    const r = docYeuCau(o({ khachMode: "LUNG_TUNG" }));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.loi).toContain("khách hàng có sẵn hay khách mới");
  });
});

describe("docYeuCau — công trình", () => {
  it("công trình có sẵn", () => {
    const r = docYeuCau(o());
    expect(r.ok && r.yeuCau.coHoi).toEqual({ loai: "CO_SAN", id: "ch1" });
  });

  it("KHÁCH MỚI + công trình có sẵn là vô lý -> chặn", () => {
    // Khách vừa dựng thì chưa có công trình nào. Nếu để lọt, truy vấn sau đó sẽ trả
    // "không tìm thấy công trình" — đúng nhưng người dùng không hiểu vì sao.
    const r = docYeuCau(o({ khachMode: "MOI", khachTen: "Công ty mới", coHoiMode: "CO_SAN" }));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.loi).toContain("Khách mới thì chưa có công trình");
  });

  it("công trình có sẵn mà chưa chọn -> lỗi", () => {
    const r = docYeuCau(o({ coHoiId: "" }));
    expect(r).toEqual({ ok: false, loi: "Hãy chọn công trình." });
  });

  it("công trình mới, đủ tên", () => {
    const r = docYeuCau(
      o({ coHoiMode: "MOI", coHoiTen: "Nhà xưởng Hồng Ngự", coHoiArea: "1000" })
    );
    expect(r.ok && r.yeuCau.coHoi).toEqual({
      loai: "MOI",
      tenCongTrinh: "Nhà xưởng Hồng Ngự",
      diaDiem: null,
      buildingType: null,
      area: 1000,
    });
  });

  it("công trình mới mà tên rỗng -> lỗi", () => {
    const r = docYeuCau(o({ coHoiMode: "MOI", coHoiTen: "" }));
    expect(r).toEqual({ ok: false, loi: "Tên công trình không được để trống." });
  });

  it("diện tích để trống là hợp lệ — điền sau cũng được", () => {
    const r = docYeuCau(o({ coHoiMode: "MOI", coHoiTen: "X", coHoiArea: "  " }));
    expect(r.ok && r.yeuCau.coHoi).toMatchObject({ area: null });
  });

  it("diện tích không phải số, âm, hay 0 -> lỗi", () => {
    // Diện tích là MẪU SỐ khi suy đơn giá m². Số 0 lọt vào là chia cho 0.
    for (const v of ["abc", "-5", "0"]) {
      const r = docYeuCau(o({ coHoiMode: "MOI", coHoiTen: "X", coHoiArea: v }));
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.loi).toContain("lớn hơn 0");
    }
  });
});

describe("docYeuCau — tiêu đề & mẫu", () => {
  it("để trống thì đặt hộ theo tên công trình mới", () => {
    const r = docYeuCau(o({ coHoiMode: "MOI", coHoiTen: "Nhà xưởng Hồng Ngự" }));
    expect(r.ok && r.yeuCau.title).toBe("Báo giá Nhà xưởng Hồng Ngự");
  });

  it("gõ tiêu đề riêng thì giữ nguyên", () => {
    const r = docYeuCau(o({ title: "  BG K6L120  " }));
    expect(r.ok && r.yeuCau.title).toBe("BG K6L120");
  });

  it("công trình có sẵn + tiêu đề trống -> để rỗng, nơi gọi đặt sau khi biết tên", () => {
    const r = docYeuCau(o());
    expect(r.ok && r.yeuCau.title).toBe("");
  });

  it("mẫu để trống là null chứ không phải chuỗi rỗng", () => {
    expect(docYeuCau(o()).ok && docYeuCau(o()).ok).toBe(true);
    const r = docYeuCau(o({ templateId: "" }));
    expect(r.ok && r.yeuCau.templateId).toBeNull();
    const r2 = docYeuCau(o({ templateId: "t1" }));
    expect(r2.ok && r2.yeuCau.templateId).toBe("t1");
  });
});

describe("tieuDeCuoi", () => {
  it("trống thì lấy tên công trình", () => {
    expect(tieuDeCuoi("", "Nhà xưởng Hồng Ngự")).toBe("Báo giá Nhà xưởng Hồng Ngự");
    expect(tieuDeCuoi("   ", "Nhà xưởng Hồng Ngự")).toBe("Báo giá Nhà xưởng Hồng Ngự");
  });

  it("có thì giữ nguyên, đã cắt khoảng trắng", () => {
    expect(tieuDeCuoi(" BG-01 ", "Nhà xưởng")).toBe("BG-01");
  });
});
