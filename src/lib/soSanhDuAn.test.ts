import { describe, expect, it } from "vitest";
import { doLech, khoaDauViec, soSanhDuAn, thongKe, trungVi, type DongNhap, type DuAnNhap } from "./soSanhDuAn";

function dong(p: Partial<DongNhap> = {}): DongNhap {
  return {
    groupCode: "KCT",
    name: "Thép tổ hợp",
    unit: "kg",
    congTacId: null,
    sectionName: "Khung mái",
    sectionTemplateId: null,
    designQty: null,
    actualQty: null,
    unitPrice: null,
    amount: null,
    ...p,
  };
}

function duAn(id: string, area: number | null, items: DongNhap[]): DuAnNhap {
  return { id, code: id, name: id, area, items };
}

describe("trungVi / thongKe", () => {
  it("trung vị số lẻ và chẵn phần tử", () => {
    expect(trungVi([3, 1, 2])).toBe(2);
    expect(trungVi([4, 1, 3, 2])).toBe(2.5);
    expect(trungVi([])).toBeNull();
  });

  it("bỏ null khi thống kê", () => {
    expect(thongKe([1, null, 3])).toEqual({ n: 2, trungVi: 2, trungBinh: 2, min: 1, max: 3 });
  });

  it("độ lệch cần ít nhất 2 dự án", () => {
    expect(doLech(12, thongKe([10, 10]))).toBeCloseTo(0.2);
    expect(doLech(12, thongKe([10]))).toBeNull();
  });
});

describe("khoaDauViec", () => {
  it("ghép tên khác dấu/hoa thường/khoảng trắng", () => {
    expect(khoaDauViec({ name: "Thép tổ hợp", unit: "Kg", congTacId: null })).toBe(
      khoaDauViec({ name: "THEP  TO HOP", unit: "kg", congTacId: null })
    );
  });

  it("có công tác thư viện thì ghép theo công tác, bỏ qua tên", () => {
    expect(khoaDauViec({ name: "A", unit: "kg", congTacId: "ct1" })).toBe(
      khoaDauViec({ name: "B", unit: "tấn", congTacId: "ct1" })
    );
  });
});

describe("soSanhDuAn", () => {
  const ds = [
    duAn("P1", 1000, [
      dong({ designQty: 30000, unitPrice: 20000 }), // 600tr, 30 kg/m²
      dong({ name: "Tôn mái", unit: "m2", groupCode: "TON", designQty: 1100, unitPrice: 100000 }), // 110tr
    ]),
    duAn("P2", 2000, [
      dong({ name: "THÉP TỔ HỢP", designQty: 50000, unitPrice: 20000 }), // 1 tỷ, 25 kg/m²
    ]),
  ];

  it("tính KL/m², đ/m², tỷ trọng và trung vị cho đầu việc ghép được", () => {
    const kq = soSanhDuAn(ds);
    const thep = kq.dong.find((d) => d.cap === "dau_viec" && d.ten === "Thép tổ hợp")!;
    expect(thep.theoDuAn.P1.klM2).toBe(30);
    expect(thep.theoDuAn.P2.klM2).toBe(25);
    expect(thep.thongKe.klM2.trungVi).toBe(27.5);
    expect(thep.theoDuAn.P1.tyTrong).toBeCloseTo(600 / 710);
    expect(thep.theoDuAn.P2.tyTrong).toBe(1);
    expect(thep.theoDuAn.P2.tienM2).toBe(500000);
  });

  it("đầu việc nằm ngay sau hạng mục của nó", () => {
    const kq = soSanhDuAn(ds);
    expect(kq.dong[0].cap).toBe("hang_muc");
    expect(kq.dong.slice(1).every((d) => d.cap === "dau_viec")).toBe(true);
  });

  it("hạng mục không có KL/m² (đơn vị khác nhau không cộng được)", () => {
    const hm = soSanhDuAn(ds).dong[0];
    expect(hm.theoDuAn.P1.klM2).toBeNull();
    expect(hm.theoDuAn.P1.tien).toBe(710_000_000);
  });

  it("dự án không có diện tích vẫn có tỷ trọng nhưng không có số/m²", () => {
    const kq = soSanhDuAn([duAn("P3", null, [dong({ designQty: 10, unitPrice: 1 })])]);
    const o = kq.dong[1].theoDuAn.P3;
    expect(o.klM2).toBeNull();
    expect(o.tienM2).toBeNull();
    expect(o.tyTrong).toBe(1);
  });

  it("thực tế dùng KL/giá thực, dòng chưa có giá thực lấy số dự toán", () => {
    const kq = soSanhDuAn(
      [
        duAn("P1", 100, [
          dong({ designQty: 10, unitPrice: 10, actualQty: 12, actualUnitPrice: 10 }),
          dong({ name: "Khác", designQty: 1, unitPrice: 50 }),
        ]),
      ],
      "thuc_te"
    );
    expect(kq.duAn[0].tong).toBe(170);
    const thep = kq.dong.find((d) => d.ten === "Thép tổ hợp")!;
    expect(thep.theoDuAn.P1.kl).toBe(12);
  });

  it("gom theo nhóm chi phí", () => {
    const kq = soSanhDuAn(ds);
    const kct = kq.nhom.find((n) => n.key === "KCT")!;
    expect(kct.ten).toBe("Kết cấu thép");
    expect(kct.thongKe.tienM2.trungVi).toBe((600000 + 500000) / 2);
  });

  it("đánh dấu đơn vị lệch giữa các dự án", () => {
    const kq = soSanhDuAn([
      duAn("A", 1, [dong({ congTacId: "c", unit: "kg", designQty: 1 })]),
      duAn("B", 1, [dong({ congTacId: "c", unit: "tấn", designQty: 1 })]),
    ]);
    expect(kq.dong[1].donViLech).toBe(true);
  });
});
