import { describe, expect, it } from "vitest";
import {
  dungKhuonGuiKhach,
  dungKhungDuToan,
  locPhanConThieu,
  type DongKhung,
  type KhungDuToan,
  type PhanKhung,
} from "./boHangMuc";

const phan = (p: Partial<PhanKhung> & { id: string; ma: string }): PhanKhung => ({
  ten: "Phần " + p.ma,
  loai: "PHAN",
  parentId: null,
  sortOrder: 0,
  inChoKhach: true,
  partCode: "I",
  partName: "Phần kết cấu thép",
  maKhach: null,
  tenKhachHang: null,
  moTaKhachHang: null,
  donViKhach: "m2",
  donGiaKhach: null,
  ghiChuKhach: null,
  tags: [],
  steelFrameKey: null,
  ...p,
});

const dong = (d: Partial<DongKhung> & { id: string }): DongKhung => ({
  phanId: "pA",
  congTacId: null,
  congTacVatTuId: null,
  maCongTac: null,
  ten: "Dòng " + d.id,
  donVi: "kg",
  donGiaMacDinh: null,
  khoiLuongMacDinh: null,
  sortOrder: 0,
  ...d,
});

describe("dungKhungDuToan", () => {
  it("dựng phần gốc và dòng thuộc phần đó", () => {
    const kq = dungKhungDuToan(
      [phan({ id: "pA", ma: "A", ten: "Khung mái" })],
      [dong({ id: "d1", ten: "Thép tổ hợp", khoiLuongMacDinh: 12, donGiaMacDinh: 25000 })]
    );
    expect(kq.phan).toEqual([
      { ma: "A", ten: "Khung mái", loai: "PHAN", maCha: null, sortOrder: 0 },
    ]);
    expect(kq.dong).toHaveLength(1);
    expect(kq.dong[0]).toMatchObject({
      phanMa: "A",
      ten: "Thép tổ hợp",
      qty: 12,
      donGia: 25000,
    });
    expect(kq.canhBao).toEqual([]);
  });

  it("phần con trỏ về cha bằng MÃ, không phải id", () => {
    // Hành động tạo phần theo thứ tự rồi mới biết id thật; khuôn phải nói bằng mã.
    const kq = dungKhungDuToan(
      [
        phan({ id: "pA", ma: "A" }),
        phan({ id: "pA1", ma: "A1", loai: "SUB", parentId: "pA", sortOrder: 1 }),
      ],
      []
    );
    expect(kq.phan[1]).toMatchObject({ ma: "A1", loai: "SUB", maCha: "A" });
  });

  it("phần con trỏ cha không tồn tại thì thành phần gốc kèm cảnh báo", () => {
    const kq = dungKhungDuToan(
      [phan({ id: "pX", ma: "X", loai: "SUB", parentId: "khong-co" })],
      []
    );
    expect(kq.phan[0]).toMatchObject({ ma: "X", loai: "PHAN", maCha: null });
    expect(kq.canhBao.join(" ")).toContain("X");
  });

  it("dòng không thuộc phần nào bị BỎ QUA kèm cảnh báo", () => {
    // QuoteItem bắt buộc có sectionId; tạo dòng mồ côi là làm vỡ ràng buộc.
    const kq = dungKhungDuToan(
      [phan({ id: "pA", ma: "A" })],
      [dong({ id: "d1", phanId: null, ten: "Mồ côi" })]
    );
    expect(kq.dong).toEqual([]);
    expect(kq.canhBao.join(" ")).toContain("Mồ côi");
  });

  it("dòng trỏ phần không tồn tại cũng bị bỏ qua", () => {
    const kq = dungKhungDuToan(
      [phan({ id: "pA", ma: "A" })],
      [dong({ id: "d1", phanId: "khong-co", ten: "Lạc chỗ" })]
    );
    expect(kq.dong).toEqual([]);
    expect(kq.canhBao.join(" ")).toContain("Lạc chỗ");
  });

  it("giữ thứ tự theo sortOrder, không theo thứ tự mảng", () => {
    const kq = dungKhungDuToan(
      [phan({ id: "pB", ma: "B", sortOrder: 1 }), phan({ id: "pA", ma: "A", sortOrder: 0 })],
      [
        dong({ id: "d2", ten: "Sau", sortOrder: 1 }),
        dong({ id: "d1", ten: "Trước", sortOrder: 0 }),
      ]
    );
    expect(kq.phan.map((p) => p.ma)).toEqual(["A", "B"]);
    expect(kq.dong.map((d) => d.ten)).toEqual(["Trước", "Sau"]);
  });

  it("hai phần trùng mã: giữ cái đầu, cảnh báo, và dòng của cái sau vẫn về đúng mã", () => {
    const kq = dungKhungDuToan(
      [phan({ id: "p1", ma: "A", ten: "Đầu" }), phan({ id: "p2", ma: "A", ten: "Sau" })],
      [dong({ id: "d1", phanId: "p2" })]
    );
    expect(kq.phan).toHaveLength(1);
    expect(kq.phan[0].ten).toBe("Đầu");
    expect(kq.dong[0].phanMa).toBe("A");
    expect(kq.canhBao.join(" ")).toContain("A");
  });

  it("mang theo công tác và biến thể để dòng dự toán tra được về thư viện", () => {
    const kq = dungKhungDuToan(
      [phan({ id: "pA", ma: "A" })],
      [
        dong({
          id: "d1",
          congTacId: "ct1",
          congTacVatTuId: "bt1",
          maCongTac: "AD.210",
        }),
      ]
    );
    expect(kq.dong[0]).toMatchObject({
      congTacId: "ct1",
      congTacVatTuId: "bt1",
      maCongTac: "AD.210",
    });
  });

  it("không làm thay đổi mảng đầu vào", () => {
    const ps = [phan({ id: "pB", ma: "B", sortOrder: 1 }), phan({ id: "pA", ma: "A" })];
    const ds = [dong({ id: "d2", sortOrder: 1 }), dong({ id: "d1" })];
    const psGoc = [...ps];
    const dsGoc = [...ds];
    dungKhungDuToan(ps, ds);
    expect(ps).toEqual(psGoc);
    expect(ds).toEqual(dsGoc);
  });

  it("bộ rỗng ra khung rỗng, không nổ", () => {
    expect(dungKhungDuToan([], [])).toEqual({ phan: [], dong: [], canhBao: [] });
  });
});

describe("dungKhuonGuiKhach", () => {
  it("chỉ lấy phần được đánh dấu in cho khách", () => {
    const ds = dungKhuonGuiKhach([
      phan({ id: "pA", ma: "A", tenKhachHang: "Khung thép và tôn mái", maKhach: "01" }),
      phan({ id: "pC", ma: "C", ten: "Canopy", inChoKhach: false }),
    ]);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ code: "01", name: "Khung thép và tôn mái" });
  });

  it("thiếu tên gửi khách thì dùng tên nội bộ", () => {
    const ds = dungKhuonGuiKhach([phan({ id: "pA", ma: "A", ten: "Khung mái" })]);
    expect(ds[0].name).toBe("Khung mái");
  });

  it("mã phần nội bộ đi kèm để suy đơn giá m² từ đúng phần", () => {
    const ds = dungKhuonGuiKhach([phan({ id: "pA", ma: "A" })]);
    expect(ds[0].sourceSectionCode).toBe("A");
  });

  it("giữ nguyên nhãn vật tư và khóa SteelFrame", () => {
    const ds = dungKhuonGuiKhach([
      phan({ id: "pA", ma: "A", tags: ["KHUNG_THEP", "TON_MAI"], steelFrameKey: "khung" }),
    ]);
    expect(ds[0].tags).toEqual(["KHUNG_THEP", "TON_MAI"]);
    expect(ds[0].steelFrameKey).toBe("khung");
  });

  it("xếp theo sortOrder và không sửa mảng đầu vào", () => {
    const ps = [phan({ id: "pB", ma: "B", sortOrder: 1 }), phan({ id: "pA", ma: "A" })];
    const goc = [...ps];
    const ds = dungKhuonGuiKhach(ps);
    expect(ds.map((d) => d.sourceSectionCode)).toEqual(["A", "B"]);
    expect(ps).toEqual(goc);
  });
});

describe("locPhanConThieu", () => {
  const khung = (
    phan: { ma: string; ten?: string; maCha?: string | null; sortOrder?: number }[],
    dongMa: string[] = []
  ): KhungDuToan => ({
    phan: phan.map((p, i) => ({
      ma: p.ma,
      ten: p.ten ?? "Phần " + p.ma,
      loai: p.maCha ? "SUB" : "PHAN",
      maCha: p.maCha ?? null,
      sortOrder: p.sortOrder ?? i,
    })),
    dong: dongMa.map((ma, i) => ({
      phanMa: ma,
      congTacId: null,
      congTacVatTuId: null,
      maCongTac: null,
      ten: `Dòng ${i} của ${ma}`,
      donVi: "kg",
      qty: null,
      donGia: null,
      sortOrder: i,
    })),
    canhBao: [],
  });

  it("bản dự toán rỗng thì giữ nguyên cả bộ", () => {
    const kq = locPhanConThieu(khung([{ ma: "A" }, { ma: "B" }], ["A", "B"]), []);
    expect(kq.khung.phan.map((p) => p.ma)).toEqual(["A", "B"]);
    expect(kq.khung.dong).toHaveLength(2);
    expect(kq.boQua).toEqual([]);
  });

  it("bỏ phần đã có, giữ phần còn thiếu", () => {
    const kq = locPhanConThieu(khung([{ ma: "A" }, { ma: "B" }, { ma: "C" }], ["A", "B", "C"]), ["B"]);
    expect(kq.khung.phan.map((p) => p.ma)).toEqual(["A", "C"]);
    expect(kq.boQua).toEqual(["B"]);
  });

  it("dòng của phần bị bỏ cũng bị bỏ theo", () => {
    const kq = locPhanConThieu(khung([{ ma: "A" }, { ma: "B" }], ["A", "A", "B"]), ["A"]);
    expect(kq.khung.dong.map((d) => d.phanMa)).toEqual(["B"]);
  });

  it("so mã không phân biệt hoa thường và dấu cách", () => {
    const kq = locPhanConThieu(khung([{ ma: "A" }, { ma: "B" }]), [" a "]);
    expect(kq.khung.phan.map((p) => p.ma)).toEqual(["B"]);
  });

  it("phần con của phần bị bỏ cũng bị bỏ, không gắn vào phần cùng mã của người dùng", () => {
    const kq = locPhanConThieu(
      khung([{ ma: "A" }, { ma: "I", maCha: "A" }, { ma: "B" }], ["I", "B"]),
      ["A"]
    );
    expect(kq.khung.phan.map((p) => p.ma)).toEqual(["B"]);
    expect(kq.khung.dong.map((d) => d.phanMa)).toEqual(["B"]);
    expect(kq.boQua.sort()).toEqual(["A", "I"]);
  });

  it("phần con vẫn được giữ khi cha của nó được giữ", () => {
    const kq = locPhanConThieu(
      khung([{ ma: "A" }, { ma: "I", maCha: "A" }, { ma: "B" }], ["I"]),
      ["B"]
    );
    expect(kq.khung.phan.map((p) => p.ma)).toEqual(["A", "I"]);
    expect(kq.khung.dong).toHaveLength(1);
  });

  it("bộ trùng hoàn toàn thì không còn gì để thêm", () => {
    const kq = locPhanConThieu(khung([{ ma: "A" }, { ma: "B" }], ["A", "B"]), ["A", "B"]);
    expect(kq.khung.phan).toEqual([]);
    expect(kq.khung.dong).toEqual([]);
    expect(kq.khung.canhBao.some((c) => c.includes("đã có sẵn"))).toBe(true);
  });

  it("không sửa khung đầu vào", () => {
    const k = khung([{ ma: "A" }, { ma: "B" }], ["A", "B"]);
    const soPhan = k.phan.length;
    const soDong = k.dong.length;
    const soCanhBao = k.canhBao.length;
    locPhanConThieu(k, ["A"]);
    expect(k.phan).toHaveLength(soPhan);
    expect(k.dong).toHaveLength(soDong);
    expect(k.canhBao).toHaveLength(soCanhBao);
  });
});
