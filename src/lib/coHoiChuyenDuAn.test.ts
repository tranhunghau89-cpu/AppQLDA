import { describe, expect, it } from "vitest";
import {
  duLieuDuAnTuCoHoi,
  goiYChuDauTu,
  kiemDieuKienChuyen,
  type ChuDauTuCoSan,
  type CoHoiChuyenSang,
} from "./coHoiChuyenDuAn";

describe("kiemDieuKienChuyen", () => {
  const moi = { trangThai: "DANG_CHAO", projectId: null };

  it("có báo giá đã chốt thì chuyển được", () => {
    expect(kiemDieuKienChuyen(moi, [{ status: "CHOT" }])).toEqual({ duoc: true });
  });

  it("chỉ cần MỘT bản chốt, những bản khác ở trạng thái nào cũng được", () => {
    expect(
      kiemDieuKienChuyen(moi, [{ status: "HUY" }, { status: "NHAP" }, { status: "CHOT" }])
    ).toEqual({ duoc: true });
  });

  it("chưa có bản nào chốt thì chưa được — mã dự án không sinh khi chưa có bằng chứng", () => {
    const r = kiemDieuKienChuyen(moi, [{ status: "DA_GUI" }, { status: "DAM_PHAN" }]);
    expect(r.duoc).toBe(false);
    expect(r.duoc === false && r.lyDo).toContain("Đã chốt");
  });

  it("không có báo giá nào thì cũng không được", () => {
    expect(kiemDieuKienChuyen(moi, []).duoc).toBe(false);
  });

  it("đã thành dự án rồi thì không chuyển lần hai", () => {
    // Chuyển hai lần là hai mã dự án cho cùng một hợp đồng.
    const r = kiemDieuKienChuyen({ trangThai: "KY_HD", projectId: "p1" }, [{ status: "CHOT" }]);
    expect(r.duoc).toBe(false);
    expect(r.duoc === false && r.lyDo).toContain("đã thành dự án");
  });

  it("mất khách thì phải đổi trạng thái trước", () => {
    const r = kiemDieuKienChuyen({ trangThai: "MAT", projectId: null }, [{ status: "CHOT" }]);
    expect(r.duoc).toBe(false);
    expect(r.duoc === false && r.lyDo).toContain("Mất khách");
  });

  it("đã có dự án thì chặn trước cả khi xét báo giá", () => {
    // Thứ tự phép kiểm có nghĩa: dòng đã có dự án luôn phải ra đúng một lý do.
    const r = kiemDieuKienChuyen({ trangThai: "DANG_CHAO", projectId: "p1" }, []);
    expect(r.duoc === false && r.lyDo).toContain("đã thành dự án");
  });
});

describe("goiYChuDauTu", () => {
  const ds: ChuDauTuCoSan[] = [
    { id: "c1", name: "Công ty CP Thép Đại Việt" },
    { id: "c2", name: "Công ty TNHH Hoàng Long" },
    { id: "c3", name: "Thép Đại Việt" },
    { id: "c4", name: "Công ty CP Xi măng Bỉm Sơn" },
  ];

  it("trùng sau khi bỏ dấu đứng đầu", () => {
    const r = goiYChuDauTu(ds, "cong ty cp thep dai viet");
    expect(r[0].id).toBe("c1");
  });

  it("bên này chứa bên kia cũng là gợi ý tốt", () => {
    const r = goiYChuDauTu(ds, "Thép Đại Việt");
    expect(r.map((x) => x.id)).toContain("c3");
    expect(r.map((x) => x.id)).toContain("c1");
    expect(r[0].id).toBe("c3"); // trùng hẳn thì xếp trên
  });

  it("không liên quan thì không gợi ý gì — thà im còn hơn gợi ý bậy", () => {
    expect(goiYChuDauTu(ds, "Xây dựng Minh Phát")).toEqual([]);
  });

  it('"Công ty CP" chung không làm hai bên khác hẳn khớp nhau', () => {
    // Nếu đếm cả từ ai cũng có thì mọi công ty cổ phần đều là gợi ý của nhau, và danh
    // sách gợi ý trở thành vô dụng đúng lúc cần nó nhất.
    const r = goiYChuDauTu([{ id: "x", name: "Công ty CP Alpha" }], "Công ty CP Beta");
    expect(r).toEqual([]);
  });

  it("chung một từ riêng đủ dài thì vẫn đáng nhắc", () => {
    const r = goiYChuDauTu([{ id: "x", name: "Công ty TNHH Hoàng Long" }], "Hoàng Long Group");
    expect(r.map((c) => c.id)).toEqual(["x"]);
  });

  it("tên rỗng thì không gợi ý, không throw", () => {
    expect(goiYChuDauTu(ds, "")).toEqual([]);
    expect(goiYChuDauTu(ds, "   ")).toEqual([]);
  });

  it("danh sách rỗng thì trả rỗng", () => {
    expect(goiYChuDauTu([], "Thép Đại Việt")).toEqual([]);
  });

  it("cắt theo số lượng tối đa", () => {
    const nhieu = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      name: "Thép Đại Việt",
    }));
    expect(goiYChuDauTu(nhieu, "Thép Đại Việt", 3).length).toBe(3);
  });
});

describe("duLieuDuAnTuCoHoi", () => {
  const ch: CoHoiChuyenSang = {
    tenCongTrinh: "Nhà xưởng Hồng Ngự",
    diaDiem: "Đồng Tháp",
    buildingType: "Nhà xưởng",
    area: 1000,
    kK: 6,
    kL: 120,
    kH: 9,
  };

  it("chép nguyên thông số hình học — không gõ lại", () => {
    // Chúng đã dùng để tính giá; gõ lại là mở đường cho dự án và báo giá của chính nó
    // nói hai con số khác nhau.
    const d = duLieuDuAnTuCoHoi(ch, "N037", "cus1", 764_500_000);
    expect(d).toMatchObject({
      code: "N037",
      name: "Nhà xưởng Hồng Ngự",
      buildingType: "Nhà xưởng",
      location: "Đồng Tháp",
      area: 1000,
      kK: 6,
      kL: 120,
      kH: 9,
      customerId: "cus1",
      salePrice: 764_500_000,
    });
  });

  it("hợp đồng vừa ký thì chưa khởi công", () => {
    expect(duLieuDuAnTuCoHoi(ch, "N037", "cus1", null).status).toBe("CHO");
  });

  it("đặt được tên dự án khác tên công trình", () => {
    expect(duLieuDuAnTuCoHoi(ch, "N037", "cus1", null, "K6L120 Hồng Ngự").name).toBe(
      "K6L120 Hồng Ngự"
    );
  });

  it("tên để trống thì rơi về tên công trình, không ra chuỗi rỗng", () => {
    expect(duLieuDuAnTuCoHoi(ch, "N037", "cus1", null, "   ").name).toBe("Nhà xưởng Hồng Ngự");
    expect(duLieuDuAnTuCoHoi(ch, "N037", "cus1", null, null).name).toBe("Nhà xưởng Hồng Ngự");
  });

  it("mã dự án được cắt khoảng trắng", () => {
    expect(duLieuDuAnTuCoHoi(ch, "  N037 ", "cus1", null).code).toBe("N037");
  });

  it("thông số để trống vẫn là trống, không hóa thành 0", () => {
    const trong: CoHoiChuyenSang = {
      tenCongTrinh: "Chưa rõ",
      diaDiem: null,
      buildingType: null,
      area: null,
      kK: null,
      kL: null,
      kH: null,
    };
    const d = duLieuDuAnTuCoHoi(trong, "N038", "cus1", null);
    expect(d.area).toBeNull();
    expect(d.kK).toBeNull();
    expect(d.location).toBeNull();
  });
});
