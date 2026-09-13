import { describe, expect, it } from "vitest";
import { chiSoNhom, gomNhomTheoThuTu, nhanNhomDongBaoGia } from "./nhomDong";

describe("nhanNhomDongBaoGia", () => {
  it("nhóm ghi trên dòng thắng tên mục con và nhóm chi phí", () => {
    expect(
      nhanNhomDongBaoGia({ groupLabel: "Bulong neo", tenMucCon: "Phần KCT", nhomChiPhi: "KCT" })
    ).toBe("Bulong neo");
  });

  it("không có nhóm trên dòng thì lấy tên mục con", () => {
    expect(
      nhanNhomDongBaoGia({ groupLabel: "  ", tenMucCon: "Phần kết cấu thép", nhomChiPhi: "KCT" })
    ).toBe("Phần kết cấu thép");
  });

  it("cuối cùng lùi về nhãn nhóm chi phí của công tác", () => {
    expect(nhanNhomDongBaoGia({ groupLabel: null, tenMucCon: null, nhomChiPhi: "KCT" })).toBe(
      "Kết cấu thép"
    );
  });

  it("mã nhóm chi phí lạ hoặc không có gì thì null, không trả chuỗi mã", () => {
    expect(nhanNhomDongBaoGia({ groupLabel: null, tenMucCon: null, nhomChiPhi: "LA" })).toBeNull();
    expect(nhanNhomDongBaoGia({ groupLabel: null, tenMucCon: null, nhomChiPhi: null })).toBeNull();
  });
});

describe("gomNhomTheoThuTu", () => {
  const d = (ten: string, nhom: string | null) => ({ ten, nhom });
  const gom = (ds: ReturnType<typeof d>[]) =>
    gomNhomTheoThuTu(ds, (x) => x.nhom).map((g) => [g.nhan, g.dong.map((x) => x.ten)]);

  it("giữ thứ tự xuất hiện đầu tiên của nhóm, không xếp theo chữ cái", () => {
    expect(
      gom([
        d("Vật tư", "Bulong neo"),
        d("Thép tổ hợp", "Kết cấu thép"),
        d("Vận chuyển", "Bulong neo"),
        d("Xà gồ", "Kết cấu thép"),
      ])
    ).toEqual([
      ["Bulong neo", ["Vật tư", "Vận chuyển"]],
      ["Kết cấu thép", ["Thép tổ hợp", "Xà gồ"]],
    ]);
  });

  it("dòng thiếu nhóm vào nhóm Khác, gộp với nhóm Khác sẵn có", () => {
    expect(gom([d("Keo", null), d("Thép", "Kết cấu thép"), d("Cáp", "Khác")])).toEqual([
      ["Khác", ["Keo", "Cáp"]],
      ["Kết cấu thép", ["Thép"]],
    ]);
  });

  it("không dòng nào có nhóm thì một nhóm nhãn null — bảng hiện phẳng", () => {
    expect(gom([d("A", null), d("B", " ")])).toEqual([[null, ["A", "B"]]]);
  });

  it("nhãn khác nhau chỉ ở dấu cách hai đầu là cùng một nhóm", () => {
    expect(gom([d("A", "Bulong neo"), d("B", " Bulong neo ")])).toEqual([
      ["Bulong neo", ["A", "B"]],
    ]);
  });

  it("danh sách rỗng thì không có nhóm nào", () => {
    expect(gomNhomTheoThuTu([], () => "x")).toEqual([]);
  });
});

describe("chiSoNhom", () => {
  it("tỉ trọng trên tổng hạng mục, đơn giá trên diện tích hạng mục", () => {
    expect(chiSoNhom(25_000_000, 100_000_000, 1_000)).toEqual({ tyLe: 0.25, moiM2: 25_000 });
  });

  it("hạng mục chưa có tiền thì không có tỉ trọng", () => {
    expect(chiSoNhom(0, 0, 1_000).tyLe).toBeNull();
  });

  it("thiếu diện tích hoặc diện tích ≤ 0 thì không suy đơn giá m²", () => {
    expect(chiSoNhom(1_000, 2_000, null).moiM2).toBeNull();
    expect(chiSoNhom(1_000, 2_000, 0).moiM2).toBeNull();
    expect(chiSoNhom(1_000, 2_000, -5).moiM2).toBeNull();
  });
});
