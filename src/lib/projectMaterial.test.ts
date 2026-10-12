import { describe, expect, it } from "vitest";
import { chonBaoGiaNguon, specTuBaoGia, type QuoteSrc } from "./projectMaterial";

const q = (id: string, status: string, ngay: string, specs: QuoteSrc["specs"] = []): QuoteSrc => ({
  id,
  status,
  createdAt: new Date(ngay),
  specs,
});
const s = (name: string, an = false, sortOrder = 0) => ({
  tag: null,
  name,
  spec: null,
  origin: null,
  an,
  sortOrder,
});

describe("chonBaoGiaNguon", () => {
  it("không có báo giá → null", () => expect(chonBaoGiaNguon([])).toBeNull());
  it("ưu tiên CHOT, kể cả khi bản khác mới hơn", () => {
    expect(chonBaoGiaNguon([q("a", "DA_GUI", "2026-09-01"), q("b", "CHOT", "2026-01-01")])?.id).toBe("b");
  });
  it("nhiều CHOT → mới nhất", () => {
    expect(chonBaoGiaNguon([q("a", "CHOT", "2026-01-01"), q("b", "CHOT", "2026-05-01")])?.id).toBe("b");
  });
  it("không có CHOT → mới nhất, bỏ HUY nếu còn bản khác", () => {
    expect(chonBaoGiaNguon([q("a", "NHAP", "2026-01-01"), q("b", "HUY", "2026-05-01")])?.id).toBe("a");
    expect(chonBaoGiaNguon([q("b", "HUY", "2026-05-01")])?.id).toBe("b");
  });
});

describe("specTuBaoGia", () => {
  it("bỏ dòng ẩn, giữ thứ tự, đánh lại sortOrder", () => {
    const r = specTuBaoGia(
      q("a", "CHOT", "2026-01-01", [s("Tôn", false, 5), s("Ẩn", true, 1), s("Thép", false, 2)])
    );
    expect(r.map((x) => [x.name, x.sortOrder])).toEqual([
      ["Thép", 0],
      ["Tôn", 1],
    ]);
  });
});
