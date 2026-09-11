import { describe, expect, it } from "vitest";
import {
  doanNhan,
  moTaHangMuc,
  specsCuaHangMuc,
  specsHienThi,
  tagsDangDung,
} from "./clientQuoteSpecs";

const SPECS = [
  { tag: "KHUNG_THEP", name: "Thép tấm tổ hợp", spec: "fy = 2.450 kG/cm2" },
  { tag: null, name: "Que hàn", spec: "E42" },
  { tag: "TON_MAI", name: "Tôn mái sóng CN", spec: "0.45mm, AZ50G550" },
  { tag: "TON_THUNG", name: "Tôn thưng sóng CN", spec: "0.40mm, AZ50G550" },
  { tag: null, name: "Keo, vít các loại", spec: null },
];

describe("tagsDangDung", () => {
  it("gộp nhãn của mọi hạng mục", () => {
    const s = tagsDangDung([{ tags: ["KHUNG_THEP", "TON_MAI"] }, { tags: ["TON_MAI"] }]);
    expect([...s].sort()).toEqual(["KHUNG_THEP", "TON_MAI"]);
  });

  it("bỏ qua nhãn rỗng và khoảng trắng", () => {
    expect([...tagsDangDung([{ tags: ["  TON_MAI  ", "", "   "] }])]).toEqual(["TON_MAI"]);
  });

  it("không có hạng mục nào -> tập rỗng", () => {
    expect(tagsDangDung([]).size).toBe(0);
    expect(tagsDangDung([{ tags: null }, {}]).size).toBe(0);
  });
});

describe("specsHienThi", () => {
  it("báo giá chỉ có mái thì KHÔNG in tôn thưng", () => {
    const ra = specsHienThi(SPECS, new Set(["KHUNG_THEP", "TON_MAI"]));
    expect(ra.map((s) => s.name)).toEqual([
      "Thép tấm tổ hợp",
      "Que hàn",
      "Tôn mái sóng CN",
      "Keo, vít các loại",
    ]);
  });

  it("có thêm hạng mục thưng thì tôn thưng xuất hiện", () => {
    const ra = specsHienThi(SPECS, new Set(["TON_MAI", "TON_THUNG"]));
    expect(ra.map((s) => s.name)).toContain("Tôn thưng sóng CN");
  });

  it("vật tư dùng chung luôn in kể cả khi chưa khai hạng mục nào", () => {
    const ra = specsHienThi(SPECS, new Set());
    expect(ra.map((s) => s.name)).toEqual(["Que hàn", "Keo, vít các loại"]);
  });

  it("giữ nguyên thứ tự đầu vào", () => {
    const ra = specsHienThi(SPECS, new Set(["TON_THUNG", "KHUNG_THEP"]));
    expect(ra.map((s) => s.name)).toEqual([
      "Thép tấm tổ hợp",
      "Que hàn",
      "Tôn thưng sóng CN",
      "Keo, vít các loại",
    ]);
  });

  it("nhãn chỉ toàn khoảng trắng coi như không có nhãn", () => {
    const ra = specsHienThi([{ tag: "   ", name: "X" }], new Set());
    expect(ra).toHaveLength(1);
  });
});

describe("specsCuaHangMuc", () => {
  it("lấy đúng vật tư của hạng mục", () => {
    expect(specsCuaHangMuc(SPECS, ["TON_MAI"]).map((s) => s.name)).toEqual(["Tôn mái sóng CN"]);
  });

  it("KHÔNG lấy vật tư dùng chung — chúng thuộc về cả báo giá, không thuộc hạng mục nào", () => {
    expect(specsCuaHangMuc(SPECS, ["TON_MAI"]).map((s) => s.name)).not.toContain("Que hàn");
  });

  it("hạng mục chưa khai nhãn -> không có vật tư nào", () => {
    expect(specsCuaHangMuc(SPECS, [])).toEqual([]);
    expect(specsCuaHangMuc(SPECS, null)).toEqual([]);
  });
});

describe("moTaHangMuc", () => {
  const CHUNG = "- Gia công sản xuất theo bản vẽ thiết kế.";

  it("ghép câu chung rồi tới vật tư đã gắn — đúng như báo giá mẫu", () => {
    expect(moTaHangMuc(null, CHUNG, SPECS, ["TON_MAI"])).toBe(
      `${CHUNG}\n- Tôn mái sóng CN — 0.45mm, AZ50G550`
    );
  });

  it("hạng mục thưng ra đúng tôn 0.40, không lẫn tôn mái 0.45", () => {
    const ra = moTaHangMuc(null, CHUNG, SPECS, ["TON_THUNG"]);
    expect(ra).toContain("0.40mm");
    expect(ra).not.toContain("0.45mm");
  });

  it("nhiều nhãn thì liệt kê theo thứ tự bảng vật liệu", () => {
    const ra = moTaHangMuc(null, null, SPECS, ["TON_THUNG", "KHUNG_THEP"]);
    expect(ra).toBe(
      "- Thép tấm tổ hợp — fy = 2.450 kG/cm2\n- Tôn thưng sóng CN — 0.40mm, AZ50G550"
    );
  });

  it("mô tả riêng của dòng ĐÈ hoàn toàn", () => {
    expect(moTaHangMuc("- Viết tay", CHUNG, SPECS, ["TON_MAI"])).toBe("- Viết tay");
  });

  it("mô tả riêng chỉ toàn khoảng trắng thì coi như không có", () => {
    expect(moTaHangMuc("   ", CHUNG, SPECS, [])).toBe(CHUNG);
  });

  it("không có gì để nói -> null, không phải chuỗi rỗng", () => {
    expect(moTaHangMuc(null, null, SPECS, [])).toBeNull();
    expect(moTaHangMuc(null, "  ", [], null)).toBeNull();
  });

  it("vật tư không có thông số thì chỉ in tên", () => {
    expect(moTaHangMuc(null, null, [{ tag: "SAN", name: "Tôn sàn" }], ["SAN"])).toBe(
      "- Tôn sàn"
    );
  });
});

describe("doanNhan", () => {
  it("đúng các phần trong báo giá mẫu", () => {
    expect(doanNhan("Khung thép và tôn phần mái").sort()).toEqual(["KHUNG_THEP", "TON_MAI"]);
    expect(doanNhan("Phần thưng")).toEqual(["TON_THUNG"]);
    expect(doanNhan("Khung nhà thép và cửa trời (nóc gió)").sort()).toEqual([
      "CUA_TROI",
      "KHUNG_THEP",
    ]);
  });

  it("mái hiên KHÔNG bị hiểu thành mái chính", () => {
    const ra = doanNhan("Phần mái hiên 3m");
    expect(ra).toContain("MAI_HIEN");
    expect(ra).not.toContain("TON_MAI");
  });

  it("không phân biệt hoa thường và dấu", () => {
    expect(doanNhan("PHAN VACH")).toEqual(["TON_THUNG"]);
  });

  it("không đoán ra gì thì trả mảng rỗng, không đoán bừa", () => {
    // Gắn nhầm nhãn sẽ in thừa cả một nhóm vật liệu vào báo giá gửi khách.
    expect(doanNhan("Hạng mục khác")).toEqual([]);
    expect(doanNhan("")).toEqual([]);
  });

  it("không trả nhãn trùng", () => {
    const ra = doanNhan("Khung thép, kết cấu thép, thép hình");
    expect(ra.filter((x) => x === "KHUNG_THEP")).toHaveLength(1);
  });
});
