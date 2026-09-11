import { describe, it, expect } from "vitest";
import { matchTemplate, apDungMau, mauMacDinh, type MauNguon } from "./quoteTemplate";
import {
  DEFAULT_PAYMENTS,
  DEFAULT_SPECS,
  DEFAULT_STAGES,
  DEFAULT_VAT_PERCENT,
  DEFAULT_LINE_DETAIL,
} from "./clientQuoteDefaults";

const t = (buildingType: string | null, sortOrder: number, ten = "") => ({
  buildingType,
  sortOrder,
  ten: ten || `${buildingType ?? "chung"}#${sortOrder}`,
});

describe("matchTemplate", () => {
  it("khớp nguyên văn", () => {
    const ds = [t("Nhà kho", 0), t("Nhà xưởng", 1)];
    expect(matchTemplate(ds, "Nhà xưởng")?.ten).toBe("Nhà xưởng#1");
  });

  it("khớp sau khi bỏ dấu và hoa thường", () => {
    const ds = [t("Nhà xưởng", 0)];
    expect(matchTemplate(ds, "nha xuong")?.ten).toBe("Nhà xưởng#0");
    expect(matchTemplate(ds, "NHÀ XƯỞNG")?.ten).toBe("Nhà xưởng#0");
  });

  it("bỏ khoảng trắng thừa hai đầu", () => {
    expect(matchTemplate([t("Nhà xưởng", 0)], "  Nhà xưởng  ")?.ten).toBe("Nhà xưởng#0");
  });

  it("khớp nguyên văn thắng khớp bỏ dấu, dù sortOrder lớn hơn", () => {
    const ds = [t("nha xuong", 0), t("Nhà xưởng", 9)];
    expect(matchTemplate(ds, "Nhà xưởng")?.ten).toBe("Nhà xưởng#9");
  });

  it("hòa nhau thì sortOrder nhỏ hơn thắng", () => {
    const ds = [t("Nhà xưởng", 5), t("Nhà xưởng", 2)];
    expect(matchTemplate(ds, "Nhà xưởng")?.ten).toBe("Nhà xưởng#2");
  });

  it("không loại nào khớp thì rơi về mẫu dùng chung", () => {
    const ds = [t("Nhà kho", 0), t(null, 3)];
    expect(matchTemplate(ds, "Nhà xưởng")?.ten).toBe("chung#3");
  });

  it("mẫu riêng thắng mẫu dùng chung", () => {
    const ds = [t(null, 0), t("Nhà xưởng", 9)];
    expect(matchTemplate(ds, "Nhà xưởng")?.ten).toBe("Nhà xưởng#9");
  });

  it("buildingType để trống thì lấy mẫu dùng chung", () => {
    const ds = [t("Nhà xưởng", 0), t(null, 1)];
    for (const v of [null, undefined, "", "   "]) {
      expect(matchTemplate(ds, v)?.ten).toBe("chung#1");
    }
  });

  it("không khớp và cũng không có mẫu dùng chung thì trả null", () => {
    expect(matchTemplate([t("Nhà kho", 0)], "Nhà xưởng")).toBeNull();
  });

  it("danh sách rỗng trả null", () => {
    expect(matchTemplate([], "Nhà xưởng")).toBeNull();
  });

  it("KHÔNG khớp một phần — tên gần giống là loại công trình khác", () => {
    expect(matchTemplate([t("Nhà xưởng 2 tầng", 0)], "Nhà xưởng")).toBeNull();
  });

  it("mẫu buildingType chỉ có khoảng trắng được coi là mẫu dùng chung", () => {
    expect(matchTemplate([t("   ", 0)], "Nhà xưởng")?.ten).toBe("   #0");
  });

  it("không sửa mảng đầu vào", () => {
    const ds = [t("B", 5), t("A", 1)];
    matchTemplate(ds, "A");
    expect(ds[0].ten).toBe("B#5");
  });
});

const mau = (p: Partial<MauNguon> = {}): MauNguon => ({
  vatPercent: null,
  validDays: null,
  warrantyMonths: null,
  maintenanceMonths: null,
  loadRoof: null,
  loadHanging: null,
  loadFloor: null,
  lineDetail: null,
  greeting: null,
  closing: null,
  colorNote: null,
  volumeNote: null,
  excludeNote: null,
  lines: [],
  specs: [],
  stages: [],
  payments: [],
  ...p,
});

describe("apDungMau", () => {
  it("không có mẫu thì lấy trọn bộ mặc định", () => {
    const k = apDungMau(null);
    expect(k.vatPercent).toBe(DEFAULT_VAT_PERCENT);
    expect(k.lineDetail).toBe(DEFAULT_LINE_DETAIL);
    expect(k.specs).toHaveLength(DEFAULT_SPECS.length);
    expect(k.stages).toHaveLength(DEFAULT_STAGES.length);
    expect(k.payments).toHaveLength(DEFAULT_PAYMENTS.length);
    expect(k.lines).toEqual([]);
  });

  it("mẫu đè lên mặc định", () => {
    const k = apDungMau(mau({ vatPercent: 8, validDays: 30, greeting: "Xin chào." }));
    expect(k.vatPercent).toBe(8);
    expect(k.validDays).toBe(30);
    expect(k.greeting).toBe("Xin chào.");
  });

  it("trường mẫu để trống thì rơi về mặc định", () => {
    const k = apDungMau(mau({ vatPercent: null }));
    expect(k.vatPercent).toBe(DEFAULT_VAT_PERCENT);
  });

  it("vatPercent = 0 được tôn trọng, không bị hiểu là chưa khai", () => {
    expect(apDungMau(mau({ vatPercent: 0 })).vatPercent).toBe(0);
  });

  it("validDays = 0 được tôn trọng", () => {
    expect(apDungMau(mau({ validDays: 0 })).validDays).toBe(0);
  });

  it("tải trọng = 0 được tôn trọng", () => {
    const k = apDungMau(mau({ loadRoof: 0, loadHanging: 0, loadFloor: 0 }));
    expect([k.loadRoof, k.loadHanging, k.loadFloor]).toEqual([0, 0, 0]);
  });

  it("chuỗi rỗng trong mẫu được giữ nguyên (cố ý bỏ đoạn chữ đó)", () => {
    expect(apDungMau(mau({ closing: "" })).closing).toBe("");
  });

  it("có mẫu thì bảng con lấy của mẫu, KHÔNG trộn với mặc định", () => {
    const k = apDungMau(
      mau({
        specs: [
          { groupCode: "B", tag: null, name: "Tôn X", spec: null, origin: null, inDescription: false },
        ],
      })
    );
    expect(k.specs).toHaveLength(1);
    expect(k.specs[0].name).toBe("Tôn X");
  });

  it("mẫu xóa hết vật liệu thì giữ rỗng, không làm sống lại mặc định", () => {
    const k = apDungMau(mau({ specs: [], stages: [], payments: [] }));
    expect(k.specs).toEqual([]);
    expect(k.stages).toEqual([]);
    expect(k.payments).toEqual([]);
  });

  it("dòng hạng mục của mẫu đi thẳng ra ngoài", () => {
    const k = apDungMau(
      mau({
        lines: [
          {
            partCode: "I",
            partName: "Phần kết cấu thép",
            code: "01",
            name: "Khung thép và tôn phần mái",
            detail: null,
            unit: "m2",
            note: null,
            defaultUnitPrice: 695000,
            tags: ["KHUNG_THEP", "TON_MAI"],
            sourceSectionCode: "A",
            steelFrameKey: "MAI",
          },
        ],
      })
    );
    expect(k.lines).toHaveLength(1);
    expect(k.lines[0].tags).toEqual(["KHUNG_THEP", "TON_MAI"]);
    expect(k.lines[0].sourceSectionCode).toBe("A");
  });
});

describe("mauMacDinh", () => {
  it("dựng ra đúng bộ mặc định để soạn mẫu mới", () => {
    const k = mauMacDinh();
    expect(k.specs).toHaveLength(DEFAULT_SPECS.length);
    expect(k.stages).toHaveLength(DEFAULT_STAGES.length);
    expect(k.payments).toHaveLength(DEFAULT_PAYMENTS.length);
    expect(k.payments.reduce((s, p) => s + p.percent, 0)).toBe(100);
  });
});
