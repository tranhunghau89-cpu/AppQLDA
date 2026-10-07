import { describe, it, expect } from "vitest";
import { laVatTuChinh } from "./clientQuoteSpecs";

describe("laVatTuChinh", () => {
  it("hiện thép, xà gồ, tôn, vật tư phụ", () => {
    for (const t of ["Thép hình", "Thép tấm tổ hợp", "Xà gồ mái, vách", "Tôn mái sóng CN",
      "Tôn thưng sóng CN", "Ke diềm phụ kiện", "Keo, vít các loại"]) {
      expect(laVatTuChinh(t), t).toBe(true);
    }
  });
  it("ẩn phần còn lại", () => {
    for (const t of ["Ống nước", "Giằng, chống xà gồ", "Sơn phủ", "Máng nước khổ <800mm",
      "Làm sạch bề mặt", "Bu lông liên kết khung chính", "Bulong neo", "Que hàn",
      "Bu lông liên kết giằng, xà gồ"]) {
      expect(laVatTuChinh(t), t).toBe(false);
    }
  });
});
