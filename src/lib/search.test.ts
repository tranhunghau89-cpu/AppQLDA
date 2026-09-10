import { describe, expect, it } from "vitest";
import { chamDiem, gomTheoLoai, timKiem, type SearchDoc } from "./search";

function doc(p: Partial<SearchDoc> & { id: string; title: string; terms: string[] }): SearchDoc {
  return { kind: "project", subtitle: null, href: `/x/${p.id}`, ...p } as SearchDoc;
}

const DS: SearchDoc[] = [
  doc({ id: "1", title: "K20L50_HN", terms: ["K20L50_HN", "N057", "Hà Nội"] }),
  doc({ id: "2", title: "K19L42_HN", terms: ["K19L42_HN", "N039", "Hà Nam"] }),
  doc({ id: "3", kind: "customer", title: "Công ty Sơn Việt", terms: ["Công ty Sơn Việt"] }),
  doc({ id: "4", kind: "supplier", title: "Hòa Phát", terms: ["Hòa Phát"] }),
  doc({ id: "5", kind: "workPrice", title: "Lợp tôn mái", terms: ["NC-TON-01", "Lợp tôn mái"] }),
];

describe("chamDiem", () => {
  it("khớp trọn vẹn ăn điểm cao nhất", () => {
    const d = doc({ id: "a", title: "K20L50", terms: ["K20L50"] });
    expect(chamDiem(d, "k20l50")).toBeGreaterThan(chamDiem(d, "k20"));
  });

  it("khớp đầu chuỗi hơn khớp giữa chuỗi", () => {
    const dau = doc({ id: "a", title: "x", terms: ["Hà Nội mới"] });
    const giua = doc({ id: "b", title: "y", terms: ["Nhà máy Hà Nội"] });
    expect(chamDiem(dau, "hanoi")).toBeGreaterThan(chamDiem(giua, "hanoi"));
  });

  it("khớp ở trường phụ được ít điểm hơn trường chính", () => {
    const chinh = doc({ id: "a", title: "x", terms: ["Hà Nam", "khác"] });
    const phu = doc({ id: "b", title: "y", terms: ["khác", "khác nữa", "Hà Nam"] });
    expect(chamDiem(chinh, "hanam")).toBeGreaterThan(chamDiem(phu, "hanam"));
  });

  it("không khớp thì 0", () => {
    expect(chamDiem(DS[0], "xyz")).toBe(0);
    expect(chamDiem(DS[0], "")).toBe(0);
  });
});

describe("timKiem", () => {
  // Lý do chính khiến việc lọc phải làm trong bộ nhớ chứ không đẩy cho SQL.
  it("gõ KHÔNG DẤU vẫn tìm ra chữ có dấu", () => {
    expect(timKiem(DS, "ha nam").map((h) => h.id)).toEqual(["2"]);
    expect(timKiem(DS, "hoa phat").map((h) => h.id)).toEqual(["4"]);
    expect(timKiem(DS, "son viet").map((h) => h.id)).toEqual(["3"]);
  });

  it("không phân biệt hoa thường và dấu cách", () => {
    expect(timKiem(DS, "K20L50").map((h) => h.id)).toEqual(["1"]);
    expect(timKiem(DS, "  k20 l50  ").map((h) => h.id)).toEqual(["1"]);
  });

  it("tìm được theo trường không hiện ra (mã dự án, tên tỉnh)", () => {
    expect(timKiem(DS, "N039").map((h) => h.id)).toEqual(["2"]);
    expect(timKiem(DS, "nc-ton").map((h) => h.id)).toEqual(["5"]);
  });

  it("truy vấn rỗng trả mảng rỗng, không trả tất cả", () => {
    expect(timKiem(DS, "")).toEqual([]);
    expect(timKiem(DS, "   ")).toEqual([]);
  });

  it("tôn trọng giới hạn", () => {
    const nhieu = Array.from({ length: 50 }, (_, i) =>
      doc({ id: String(i), title: `Dự án ${i}`, terms: [`Dự án ${i}`] })
    );
    expect(timKiem(nhieu, "du an", 5)).toHaveLength(5);
  });

  // Kết quả nhảy lung tung giữa các lần gõ là lỗi khó chịu nhất của hộp tìm kiếm.
  it("thứ tự ổn định khi đồng điểm", () => {
    const a = timKiem(DS, "h").map((h) => h.id);
    const b = timKiem(DS, "h").map((h) => h.id);
    expect(a).toEqual(b);
  });

  it("dự án xếp trước mã đơn giá khi cùng điểm", () => {
    const ds: SearchDoc[] = [
      doc({ id: "wp", kind: "workPrice", title: "Tôn", terms: ["Tôn"] }),
      doc({ id: "pj", kind: "project", title: "Tôn", terms: ["Tôn"] }),
    ];
    expect(timKiem(ds, "ton").map((h) => h.id)).toEqual(["pj", "wp"]);
  });
});

describe("gomTheoLoai", () => {
  it("gom theo loại và giữ thứ tự loại đã định", () => {
    const nhom = gomTheoLoai(timKiem(DS, "h"));
    const loai = nhom.map((n) => n.kind);
    expect(loai.indexOf("project")).toBeLessThan(loai.indexOf("supplier"));
  });

  it("không tạo nhóm rỗng", () => {
    expect(gomTheoLoai([])).toEqual([]);
    expect(gomTheoLoai(timKiem(DS, "hoa phat")).map((n) => n.kind)).toEqual(["supplier"]);
  });
});
