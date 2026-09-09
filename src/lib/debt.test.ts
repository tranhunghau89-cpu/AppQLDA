import { describe, expect, it } from "vitest";
import {
  buildPayables,
  buildReceivables,
  norm,
  pickContractValue,
  type PayableCategoryInput,
  type PayableOrderInput,
  type ReceivableProjectInput,
  type SupplierInput,
} from "./debt";

const CUSTOMER = { id: "c1", name: "CĐT Alpha" };

function project(p: Partial<ReceivableProjectInput> = {}): ReceivableProjectInput {
  return {
    id: "p1",
    code: "N001",
    name: "K20L60",
    salePrice: null,
    customerId: CUSTOMER.id,
    customer: CUSTOMER,
    costSummary: null,
    contracts: [],
    ...p,
  };
}

describe("norm", () => {
  it("bỏ dấu, đ→d, chỉ giữ chữ và số", () => {
    expect(norm("Công ty Thép Đại Việt")).toBe("congtythepdaiviet");
  });

  it("khớp được hai cách viết khác nhau của cùng một NCC", () => {
    expect(norm("CTY TNHH Hòa Phát")).toBe(norm("cty tnhh  hoa-phat"));
  });

  it("giá trị không phải chuỗi trả về rỗng", () => {
    expect(norm(null)).toBe("");
    expect(norm(123)).toBe("");
  });
});

describe("pickContractValue", () => {
  const d = (s: string) => new Date(s);

  it("không có hợp đồng -> null", () => {
    expect(pickContractValue([])).toBeNull();
  });

  it("ưu tiên hợp đồng đã ký hơn báo giá, kể cả khi báo giá mới hơn", () => {
    const v = pickContractValue([
      { valueWithVat: 900, status: "QUOTE", signDate: d("2026-05-01") },
      { valueWithVat: 800, status: "SIGNED", signDate: d("2026-01-01") },
    ]);
    expect(v).toBe(800);
  });

  it("trong các hợp đồng đã ký thì lấy bản mới nhất", () => {
    const v = pickContractValue([
      { valueWithVat: 800, status: "SIGNED", signDate: d("2026-01-01") },
      { valueWithVat: 850, status: "LIQUIDATED", signDate: d("2026-06-01") },
    ]);
    expect(v).toBe(850);
  });

  it("hợp đồng chưa có ngày ký vẫn dùng được", () => {
    expect(
      pickContractValue([{ valueWithVat: 700, status: "SIGNED", signDate: null }])
    ).toBe(700);
  });
});

describe("buildReceivables — thứ tự ưu tiên nguồn số liệu", () => {
  it("có quyết toán -> lấy doanh thu quyết toán", () => {
    const [g] = buildReceivables([
      project({
        salePrice: 500,
        contracts: [{ valueWithVat: 800, status: "SIGNED", signDate: null }],
        costSummary: { revenue: 1_000, collectedWithVat: 400, receivable: 600 },
      }),
    ]);
    expect(g.projects[0].source).toBe("QUYETTOAN");
    expect(g.projects[0].value).toBe(1_000);
    expect(g.projects[0].receivable).toBe(600);
  });

  it("không có quyết toán -> lấy giá trị hợp đồng", () => {
    const [g] = buildReceivables([
      project({
        salePrice: 500,
        contracts: [{ valueWithVat: 800, status: "SIGNED", signDate: null }],
      }),
    ]);
    expect(g.projects[0].source).toBe("HOPDONG");
    expect(g.projects[0].value).toBe(800);
  });

  it("không có quyết toán lẫn hợp đồng -> lấy giá bán dự án", () => {
    const [g] = buildReceivables([project({ salePrice: 500 })]);
    expect(g.projects[0].source).toBe("GIABAN");
    expect(g.projects[0].value).toBe(500);
  });

  it("dùng receivable của quyết toán thay vì tự trừ, khi có", () => {
    // receivable trong THCP đã tính cả VAT/điều chỉnh nên phải ưu tiên.
    const [g] = buildReceivables([
      project({ costSummary: { revenue: 1_000, collectedWithVat: 400, receivable: 550 } }),
    ]);
    expect(g.projects[0].receivable).toBe(550);
  });

  it("quyết toán thiếu receivable -> tự tính = giá trị − đã thu", () => {
    const [g] = buildReceivables([
      project({ costSummary: { revenue: 1_000, collectedWithVat: 400, receivable: null } }),
    ]);
    expect(g.projects[0].receivable).toBe(600);
  });

  it("bỏ qua dự án không có số liệu nào", () => {
    expect(buildReceivables([project()])).toEqual([]);
  });

  it("giữ lại dự án không có giá trị nhưng đã thu tiền (dữ liệu cần soi)", () => {
    const [g] = buildReceivables([
      project({ costSummary: { revenue: null, collectedWithVat: 300, receivable: null } }),
    ]);
    expect(g.projects[0].source).toBe("NONE");
    expect(g.projects[0].collected).toBe(300);
    expect(g.projects[0].receivable).toBe(-300);
  });

  it("gom nhiều dự án về cùng một chủ đầu tư và cộng tổng", () => {
    const [g] = buildReceivables([
      project({ id: "p1", salePrice: 500 }),
      project({ id: "p2", code: "N002", salePrice: 300 }),
    ]);
    expect(g.projects).toHaveLength(2);
    expect(g.totalValue).toBe(800);
    expect(g.totalReceivable).toBe(800);
  });

  it("dự án chưa gán CĐT gom vào nhóm riêng", () => {
    const [g] = buildReceivables([
      project({ customerId: null, customer: null, salePrice: 100 }),
    ]);
    expect(g.customerId).toBeNull();
    expect(g.name).toBe("Chưa gán CĐT");
  });

  it("xếp chủ đầu tư nợ nhiều lên trước", () => {
    const other = { id: "c2", name: "CĐT Beta" };
    const rows = buildReceivables([
      project({ id: "p1", salePrice: 100 }),
      project({ id: "p2", customerId: other.id, customer: other, salePrice: 900 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["CĐT Beta", "CĐT Alpha"]);
  });
});

describe("buildPayables", () => {
  const suppliers: SupplierInput[] = [
    { id: "s1", name: "Thép Hòa Phát", category: "KCT" },
    { id: "s2", name: "Tôn Đông Á", category: "TON" },
  ];
  const proj = { id: "p1", code: "N001", name: "K20L60" };

  function order(p: Partial<PayableOrderInput> = {}): PayableOrderInput {
    return { supplierId: "s1", value: 0, project: proj, ...p };
  }
  function category(p: Partial<PayableCategoryInput> = {}): PayableCategoryInput {
    return { supplier: "Thép Hòa Phát", value: 0, payment: 0, summary: { project: proj }, ...p };
  }

  it("chỉ có đơn hàng -> base lấy từ giá trị đơn", () => {
    const [g] = buildPayables(suppliers, [order({ value: 500 })], []);
    expect(g.supplierId).toBe("s1");
    expect(g.totalOrdered).toBe(500);
    expect(g.totalBase).toBe(500);
    expect(g.totalPayable).toBe(500);
  });

  it("có quyết toán thì base lấy quyết toán, không lấy đơn hàng", () => {
    const [g] = buildPayables(
      suppliers,
      [order({ value: 500 })],
      [category({ value: 700, payment: 200 })]
    );
    expect(g.totalOrdered).toBe(500);
    expect(g.totalQtValue).toBe(700);
    expect(g.totalBase).toBe(700);
    expect(g.totalPayable).toBe(500);
  });

  it("khớp NCC theo tên đã chuẩn hóa (khác dấu/hoa thường vẫn cùng một nhóm)", () => {
    const [g] = buildPayables(
      suppliers,
      [order({ value: 100 })],
      [category({ supplier: "thep hoa phat", value: 400, payment: 0 })]
    );
    expect(g.matched).toBe(true);
    expect(g.supplierId).toBe("s1");
    expect(g.projects).toHaveLength(1);
  });

  it("NCC trong quyết toán không khớp danh mục -> nhóm riêng, matched=false", () => {
    const rows = buildPayables(
      suppliers,
      [],
      [category({ supplier: "Xưởng cơ khí Bảy Nổ", value: 300, payment: 0 })]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].matched).toBe(false);
    expect(rows[0].supplierId).toBeNull();
    expect(rows[0].name).toBe("Xưởng cơ khí Bảy Nổ");
  });

  it("đã trả vượt giá trị (do VAT) coi như tất toán, không ra số âm", () => {
    const [g] = buildPayables(suppliers, [], [category({ value: 1_000, payment: 1_080 })]);
    expect(g.totalPaid).toBe(1_080);
    expect(g.totalPayable).toBe(0);
  });

  it("bỏ qua đơn hàng chưa gán NCC", () => {
    expect(buildPayables(suppliers, [order({ supplierId: null, value: 999 })], [])).toEqual([]);
  });

  it("bỏ qua đơn hàng trỏ tới NCC đã bị xóa", () => {
    expect(buildPayables(suppliers, [order({ supplierId: "khong-ton-tai" })], [])).toEqual([]);
  });

  it("bỏ qua dòng quyết toán không ghi NCC", () => {
    expect(buildPayables(suppliers, [], [category({ supplier: null, value: 500 })])).toEqual([]);
  });

  it("cộng dồn nhiều đơn hàng của cùng NCC trên cùng dự án thành 1 dòng", () => {
    const [g] = buildPayables(
      suppliers,
      [order({ value: 100 }), order({ value: 250 })],
      []
    );
    expect(g.projects).toHaveLength(1);
    expect(g.projects[0].ordered).toBe(350);
  });

  it("tách theo dự án trong cùng một NCC", () => {
    const other = { id: "p2", code: "N002", name: "K25L40" };
    const [g] = buildPayables(
      suppliers,
      [order({ value: 100 }), order({ value: 400, project: other })],
      []
    );
    expect(g.projects).toHaveLength(2);
    expect(g.totalOrdered).toBe(500);
  });

  it("xếp NCC còn nợ lên trước NCC đã tất toán", () => {
    const rows = buildPayables(
      suppliers,
      [],
      [
        category({ supplier: "Thép Hòa Phát", value: 1_000, payment: 1_000 }),
        category({ supplier: "Tôn Đông Á", value: 200, payment: 0 }),
      ]
    );
    expect(rows.map((r) => r.name)).toEqual(["Tôn Đông Á", "Thép Hòa Phát"]);
  });
});
