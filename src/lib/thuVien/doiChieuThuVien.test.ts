import { describe, expect, it } from "vitest";
import { doiChieuThuVien, type CongTacThuVien, type DongCanDoiChieu } from "./doiChieuThuVien";

const ct: CongTacThuVien[] = [
  { id: "aa120", ma: "AA.120", ten: "Thép tổ hợp cột, kèo, dầm, Q345", tenNgan: "Thép tổ hợp", donVi: "kg", donGia: 24600 },
  { id: "aa110", ma: "AA.110", ten: "Thép tổ hợp cột, kèo, dầm, SS400", tenNgan: "Thép tổ hợp", donVi: "kg", donGia: 23000 },
  { id: "ak610", ma: "AK.610", ten: "Lắp đặt bulong neo", tenNgan: "Lắp đặt", donVi: "bộ", donGia: 80000 },
  { id: "ae910", ma: "AE.910", ten: "Cầu chắn rác", tenNgan: null, donVi: "cái", donGia: 45000 },
];
const dong = (p: Partial<DongCanDoiChieu> & { id: string; ten: string }): DongCanDoiChieu => ({
  donVi: "kg",
  congTacId: null,
  donGia: 1,
  phanMauId: null,
  coMucCon: false,
  ...p,
});

describe("doiChieuThuVien", () => {
  const bo = [
    { phanId: "khung", ten: "Thép tổ hợp", donVi: "kg", congTacId: "aa120" },
    { phanId: "vach", ten: "Thép tổ hợp", donVi: "kg", congTacId: "aa110" },
    { phanId: "khung", ten: "Lắp đặt", donVi: "bộ", congTacId: "ak610" },
  ];

  it("ưu tiên dòng bộ của đúng phần đã áp", () => {
    const kq = doiChieuThuVien([dong({ id: "1", ten: "Thép tổ hợp", phanMauId: "vach", donGia: 20580 })], bo, ct);
    expect(kq).toEqual([{ id: "1", congTacId: "aa110", ma: "AA.110", nguon: "phan_mau", donGiaCu: 20580, donGiaMoi: 23000 }]);
  });

  it("nhiều phần gắn khác nhau và không biết phần nào → không đoán", () => {
    expect(doiChieuThuVien([dong({ id: "1", ten: "Thép tổ hợp" })], bo, ct)).toEqual([]);
  });

  it("theo bộ khi mọi dòng bộ cùng một công tác; theo tên thư viện khi bộ không có", () => {
    const kq = doiChieuThuVien(
      [dong({ id: "1", ten: "lắp  đặt", donVi: "Bộ", donGia: 90000 }), dong({ id: "2", ten: "Cầu chắn rác", donVi: "cái" })],
      bo,
      ct
    );
    expect(kq.map((d) => [d.ma, d.nguon, d.donGiaMoi])).toEqual([
      ["AK.610", "bo", 80000],
      ["AE.910", "ten", 45000],
    ]);
  });

  it("dòng đã có mã: chỉ đề xuất khi giá lệch; mục con thì giữ giá", () => {
    expect(doiChieuThuVien([dong({ id: "1", ten: "x", congTacId: "aa120", donGia: 24600 })], [], ct)).toEqual([]);
    expect(doiChieuThuVien([dong({ id: "1", ten: "x", congTacId: "aa120", donGia: 20000, coMucCon: true })], [], ct)).toEqual([]);
    expect(doiChieuThuVien([dong({ id: "1", ten: "x", congTacId: "aa120", donGia: 20000 })], [], ct)[0].donGiaMoi).toBe(24600);
  });
});
