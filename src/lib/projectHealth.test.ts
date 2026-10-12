import { describe, expect, it } from "vitest";
import {
  dauNgayVN,
  soNgay,
  soSanhCo,
  tinhChiSo,
  tinhCo,
  trangThaiMoc,
  type HealthInput,
} from "./projectHealth";

// 12/10/2026 09:00 giờ VN
const NOW = Date.parse("2026-10-12T02:00:00Z");
const vn = (s: string) => new Date(`${s}T00:00:00+07:00`);

function input(p: Partial<HealthInput> = {}): HealthInput {
  return { milestones: [], payments: [], purchaseOrders: [], contracts: [], salePrice: null, ...p };
}

describe("ngày VN", () => {
  it("đầu ngày theo UTC+7", () => {
    expect(dauNgayVN(NOW)).toBe(vn("2026-10-12").getTime());
    // 18:00Z ngày 11 = 01:00 ngày 12 giờ VN
    expect(dauNgayVN(Date.parse("2026-10-11T18:00:00Z"))).toBe(vn("2026-10-12").getTime());
  });
  it("soNgay có dấu", () => {
    expect(soNgay(NOW, vn("2026-10-15").getTime())).toBe(3);
    expect(soNgay(NOW, vn("2026-10-10").getTime())).toBe(-2);
  });
});

describe("trangThaiMoc", () => {
  it("xong thắng mọi thứ", () => {
    expect(trangThaiMoc({ planDate: vn("2026-01-01"), done: true }, NOW)).toBe("XONG");
  });
  it("không ngày → CHUA_CO", () => {
    expect(trangThaiMoc({ planDate: null, done: false }, NOW)).toBe("CHUA_CO");
  });
  it("hôm qua TRE, hôm nay & +7 SAP_DEN, +8 DUNG_HAN", () => {
    expect(trangThaiMoc({ planDate: vn("2026-10-11"), done: false }, NOW)).toBe("TRE");
    expect(trangThaiMoc({ planDate: vn("2026-10-12"), done: false }, NOW)).toBe("SAP_DEN");
    expect(trangThaiMoc({ planDate: vn("2026-10-19"), done: false }, NOW)).toBe("SAP_DEN");
    expect(trangThaiMoc({ planDate: vn("2026-10-20"), done: false }, NOW)).toBe("DUNG_HAN");
  });
});

describe("tinhCo", () => {
  it("dự án trống → không cờ", () => {
    expect(tinhCo(input(), NOW)).toEqual({ muc: null, lyDo: [] });
  });

  it("mốc quá hạn → ĐỎ có tên mốc và số ngày", () => {
    const r = tinhCo(input({ milestones: [{ type: "LAP_DUNG", planDate: vn("2026-10-07"), done: false }] }), NOW);
    expect(r.muc).toBe("DO");
    expect(r.lyDo[0]).toMatchObject({ muc: "DO", loai: "TIEN_DO", soNgay: 5 });
    expect(r.lyDo[0].text).toBe("Quá hạn Lắp dựng 5 ngày");
  });

  it("mốc đến hạn hôm nay → VÀNG còn 0 ngày", () => {
    const r = tinhCo(input({ milestones: [{ type: "SHOP", planDate: vn("2026-10-12"), done: false }] }), NOW);
    expect(r.muc).toBe("VANG");
    expect(r.lyDo[0].text).toBe("Shop còn 0 ngày");
  });

  it("đợt thu quá hạn chưa đủ → ĐỎ; null paid = 0", () => {
    const r = tinhCo(
      input({ payments: [{ direction: "THU", name: "Đợt 2", amount: 120_000_000, paidAmount: null, dueDate: vn("2026-10-01") }] }),
      NOW
    );
    expect(r.muc).toBe("DO");
    expect(r.lyDo[0].loai).toBe("THU_TIEN");
    expect(r.lyDo[0].text).toContain("Đợt 2");
    expect(r.lyDo[0].text).toContain("120");
    expect(r.lyDo[0].text).toContain("11 ngày");
  });

  it("đợt thu đã đủ / amount null / chiều CHI → không cờ", () => {
    const r = tinhCo(
      input({
        payments: [
          { direction: "THU", name: "Đợt 1", amount: 100, paidAmount: 100, dueDate: vn("2026-10-01") },
          { direction: "THU", name: "Đợt X", amount: null, paidAmount: null, dueDate: vn("2026-10-01") },
          { direction: "CHI", name: "NCC", amount: 100, paidAmount: 0, dueDate: vn("2026-10-01") },
        ],
      }),
      NOW
    );
    expect(r).toEqual({ muc: null, lyDo: [] });
  });

  it("anTien → không có lý do thu tiền (vai không xem tiền không biết tình hình thu)", () => {
    const r = tinhCo(
      input({ payments: [{ direction: "THU", name: "Đợt 2", amount: 120_000_000, paidAmount: 0, dueDate: vn("2026-10-01") }] }),
      NOW,
      { anTien: true }
    );
    expect(r).toEqual({ muc: null, lyDo: [] });
  });

  it("đơn mua trễ giao chưa nhận → ĐỎ; đã nhận → không", () => {
    const r = tinhCo(
      input({
        purchaseOrders: [
          { category: "TON", status: "ORDERED", expectedDate: vn("2026-10-09") },
          { category: "KCT", status: "RECEIVED", expectedDate: vn("2026-10-01") },
        ],
      }),
      NOW
    );
    expect(r.lyDo).toHaveLength(1);
    expect(r.lyDo[0]).toMatchObject({ loai: "VAT_TU", soNgay: 3 });
  });

  it("ĐỎ đứng trước VÀNG, trong cùng mức trễ nhiều đứng trước", () => {
    const r = tinhCo(
      input({
        milestones: [
          { type: "SHOP", planDate: vn("2026-10-14"), done: false },
          { type: "BV_KT", planDate: vn("2026-10-10"), done: false },
          { type: "LAP_DUNG", planDate: vn("2026-10-01"), done: false },
        ],
      }),
      NOW
    );
    expect(r.muc).toBe("DO");
    expect(r.lyDo.map((l) => l.muc)).toEqual(["DO", "DO", "VANG"]);
    expect(r.lyDo[0].soNgay).toBe(11);
  });
});

describe("tinhCo — QC", () => {
  it("mục QC không đạt → ĐỎ loại QC, kể cả khi ẩn tiền", () => {
    const r = tinhCo(input({ qc: [{ giaiDoan: "SHOP", ketQua: "KHONG_DAT" }] }), NOW, { anTien: true });
    expect(r.muc).toBe("DO");
    expect(r.lyDo).toEqual([{ muc: "DO", loai: "QC", soNgay: 1, text: "QC Shop: 1 mục không đạt" }]);
  });
  it("không có dữ liệu QC → như cũ", () => {
    expect(tinhCo(input(), NOW)).toEqual({ muc: null, lyDo: [] });
  });
});

describe("tinhChiSo", () => {
  it("không dữ liệu → tiến độ 0, đã thu null, giá trị HĐ = salePrice", () => {
    // Chưa lập đợt thu nào: "còn phải thu" là chưa biết, không phải 0 (0 đọc thành "thu đủ").
    expect(tinhChiSo(input({ salePrice: 500 }))).toEqual({ tienDo: 0, daThu: null, giaTriHD: 500, conPhaiThu: null });
  });
  it("tính % và còn phải thu, ưu tiên HĐ đã ký", () => {
    const r = tinhChiSo(
      input({
        salePrice: 1,
        milestones: [
          { type: "BV_KT", planDate: null, done: true },
          { type: "SHOP", planDate: null, done: true },
        ],
        payments: [
          { direction: "THU", name: "1", amount: 300, paidAmount: 300, dueDate: null },
          { direction: "THU", name: "2", amount: 700, paidAmount: null, dueDate: null },
          { direction: "CHI", name: "x", amount: 999, paidAmount: 999, dueDate: null },
        ],
        contracts: [{ valueWithVat: 1000, status: "SIGNED", signDate: vn("2026-01-01") }],
      })
    );
    expect(r).toEqual({ tienDo: 2 / 8, daThu: 0.3, giaTriHD: 1000, conPhaiThu: 700 });
  });
});

describe("tinhChiSo — trả dư", () => {
  it("còn phải thu không âm", () => {
    const r = tinhChiSo(
      input({ payments: [{ direction: "THU", name: "1", amount: 100, paidAmount: 150, dueDate: null }] })
    );
    expect(r.conPhaiThu).toBe(0);
  });
});

describe("soSanhCo", () => {
  it("DO < VANG < null", () => {
    expect((["VANG", null, "DO"] as const).slice().sort(soSanhCo)).toEqual(["DO", "VANG", null]);
  });
});
