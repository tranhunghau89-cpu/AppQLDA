import { describe, expect, it } from "vitest";
import {
  chonGiaMua,
  nhaCungCapTheoKhuVuc,
  type LienKetKhuVuc,
  type GiaMuaUngVien,
} from "./nhaCungCap";

const lk = (supplierId: string, khuVucId: string, uuTien = 0): LienKetKhuVuc => ({
  supplierId,
  khuVucId,
  uuTien,
});

describe("nhaCungCapTheoKhuVuc", () => {
  const links = [
    lk("hoasen", "mb", 1),
    lk("hoasen", "mn", 1),
    lk("dongA", "mb", 0),
    lk("phuongNam", "mn", 0),
  ];

  it("lọc đúng nhà cung cấp phục vụ khu vực", () => {
    expect(nhaCungCapTheoKhuVuc(links, "mb")).toEqual(["dongA", "hoasen"]);
    expect(nhaCungCapTheoKhuVuc(links, "mn")).toEqual(["phuongNam", "hoasen"]);
  });

  it("xếp theo ưu tiên, nhỏ hơn đứng trước", () => {
    const ds = nhaCungCapTheoKhuVuc([lk("b", "mb", 5), lk("a", "mb", 1)], "mb");
    expect(ds).toEqual(["a", "b"]);
  });

  it("cùng ưu tiên thì xếp theo id để kết quả tất định", () => {
    const ds = [lk("z", "mb", 0), lk("a", "mb", 0), lk("m", "mb", 0)];
    for (let i = 0; i < 50; i++) {
      const xao = [...ds].sort(() => Math.random() - 0.5);
      expect(nhaCungCapTheoKhuVuc(xao, "mb")).toEqual(["a", "m", "z"]);
    }
  });

  it("chưa chọn khu vực thì trả về TẤT CẢ, không phải rỗng", () => {
    // Chưa khai khu vực cho dự án là chuyện thường; lúc đó thu hẹp danh sách xuống
    // rỗng là làm người dùng không chọn được nhà cung cấp nào.
    const ds = nhaCungCapTheoKhuVuc(links, null);
    expect(new Set(ds)).toEqual(new Set(["hoasen", "dongA", "phuongNam"]));
  });

  it("khu vực chưa gán nhà cung cấp nào thì trả rỗng", () => {
    expect(nhaCungCapTheoKhuVuc(links, "mt")).toEqual([]);
  });

  it("không làm thay đổi mảng đầu vào", () => {
    const goc = [...links];
    nhaCungCapTheoKhuVuc(links, "mb");
    expect(links).toEqual(goc);
  });
});

const NGAY = new Date("2026-06-01T00:00:00Z");

const gm = (p: Partial<GiaMuaUngVien> & { id: string }): GiaMuaUngVien => ({
  vatTuId: "vt1",
  supplierId: "ncc1",
  khuVucId: null,
  donGia: 100,
  hieuLucTu: new Date("2026-01-01T00:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...p,
});

describe("chonGiaMua", () => {
  it("lấy bản mới nhất còn hiệu lực của đúng vật tư", () => {
    const ds = [
      gm({ id: "cu", donGia: 100 }),
      gm({ id: "moi", donGia: 120, hieuLucTu: new Date("2026-05-01T00:00:00Z") }),
      gm({ id: "khac", vatTuId: "vt2", donGia: 999 }),
    ];
    const kq = chonGiaMua(ds, { vatTuId: "vt1", ngay: NGAY });
    expect(kq?.id).toBe("moi");
    expect(kq?.donGia).toBe(120);
  });

  it("bỏ qua bản chưa tới ngày hiệu lực", () => {
    const ds = [
      gm({ id: "nay", donGia: 100 }),
      gm({ id: "sau", donGia: 200, hieuLucTu: new Date("2026-12-01T00:00:00Z") }),
    ];
    expect(chonGiaMua(ds, { vatTuId: "vt1", ngay: NGAY })?.id).toBe("nay");
  });

  it("lọc theo nhà cung cấp khi có yêu cầu", () => {
    const ds = [
      gm({ id: "a", supplierId: "ncc1", donGia: 100 }),
      gm({ id: "b", supplierId: "ncc2", donGia: 90 }),
    ];
    expect(chonGiaMua(ds, { vatTuId: "vt1", supplierId: "ncc2", ngay: NGAY })?.id).toBe("b");
  });

  it("CÙNG nhà cung cấp: bản mới thắng kể cả khi đắt hơn", () => {
    // Ho vừa báo giá lại — giá cũ không còn mua được nữa, nên rẻ hơn cũng vô nghĩa.
    const ds = [
      gm({ id: "cu", supplierId: "ncc1", donGia: 90 }),
      gm({
        id: "moi",
        supplierId: "ncc1",
        donGia: 140,
        hieuLucTu: new Date("2026-05-01T00:00:00Z"),
      }),
    ];
    expect(chonGiaMua(ds, { vatTuId: "vt1", ngay: NGAY })?.id).toBe("moi");
  });

  it("thu gọn theo NCC rồi mới so rẻ, không so thẳng toàn bộ", () => {
    // ncc1 vừa tăng lên 140 (bản cũ 90 hết hiệu lực), ncc2 đang bán 120.
    // So thẳng cả ba dòng sẽ ra 90 — một con số không mua được ở đâu cả.
    const ds = [
      gm({ id: "ncc1-cu", supplierId: "ncc1", donGia: 90 }),
      gm({
        id: "ncc1-moi",
        supplierId: "ncc1",
        donGia: 140,
        hieuLucTu: new Date("2026-05-01T00:00:00Z"),
      }),
      gm({ id: "ncc2", supplierId: "ncc2", donGia: 120 }),
    ];
    expect(chonGiaMua(ds, { vatTuId: "vt1", ngay: NGAY })?.id).toBe("ncc2");
  });

  it("nhiều nhà cung cấp cùng có giá thì lấy RẺ NHẤT", () => {
    // Khác hẳn đơn giá công tác: ở đó "mới nhất thắng" vì đó là quyết định thay thế
    // quyết định cũ. Ở đây mỗi nhà cung cấp là một lựa chọn song song đang cùng có
    // hiệu lực, nên câu hỏi đúng là "mua chỗ nào rẻ nhất".
    const ds = [
      gm({ id: "dat", supplierId: "ncc1", donGia: 120 }),
      gm({ id: "re", supplierId: "ncc2", donGia: 95 }),
    ];
    expect(chonGiaMua(ds, { vatTuId: "vt1", ngay: NGAY })?.id).toBe("re");
  });

  it("cùng giá thì lấy bản hiệu lực muộn hơn, rồi tới id nhỏ hơn", () => {
    const ds = [
      gm({ id: "b", supplierId: "n1", donGia: 100 }),
      gm({ id: "a", supplierId: "n2", donGia: 100 }),
    ];
    for (let i = 0; i < 50; i++) {
      const xao = [...ds].sort(() => Math.random() - 0.5);
      expect(chonGiaMua(xao, { vatTuId: "vt1", ngay: NGAY })?.id).toBe("a");
    }
  });

  it("không có ứng viên thì trả null, không phải NaN", () => {
    expect(chonGiaMua([], { vatTuId: "vt1", ngay: NGAY })).toBeNull();
  });
});
