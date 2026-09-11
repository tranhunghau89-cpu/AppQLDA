import { describe, expect, it } from "vitest";
import {
  chuCuaQuote,
  chuHopLe,
  duLieuChu,
  duongDanChu,
  duongDanIn,
  laCungChu,
  whereCuaChu,
  type ChuBaoGia,
} from "./quoteOwner";

const duAn: ChuBaoGia = { loai: "DU_AN", id: "p1" };
const coHoi: ChuBaoGia = { loai: "CO_HOI", id: "c1" };

describe("chuCuaQuote", () => {
  it("đọc được chủ là dự án", () => {
    expect(chuCuaQuote({ projectId: "p1", coHoiId: null })).toEqual(duAn);
  });

  it("đọc được chủ là cơ hội", () => {
    expect(chuCuaQuote({ projectId: null, coHoiId: "c1" })).toEqual(coHoi);
  });

  it("không chủ nào -> null, không throw", () => {
    expect(chuCuaQuote({ projectId: null, coHoiId: null })).toBeNull();
  });

  it("dữ liệu hỏng (cả hai) thì dự án thắng — bên chặt hơn thắng", () => {
    expect(chuCuaQuote({ projectId: "p1", coHoiId: "c1" })).toEqual(duAn);
  });
});

describe("chuHopLe", () => {
  it("đúng một trong hai là hợp lệ", () => {
    expect(chuHopLe({ projectId: "p1", coHoiId: null })).toBe(true);
    expect(chuHopLe({ projectId: null, coHoiId: "c1" })).toBe(true);
  });

  it("cả hai hoặc không cái nào đều KHÔNG hợp lệ", () => {
    expect(chuHopLe({ projectId: "p1", coHoiId: "c1" })).toBe(false);
    expect(chuHopLe({ projectId: null, coHoiId: null })).toBe(false);
  });
});

describe("duLieuChu", () => {
  it("luôn ghi cả hai cột, cột kia là null chứ không bỏ trống", () => {
    // Bỏ trống khi cập nhật sẽ giữ nguyên giá trị cũ — đúng cách sinh ra dòng hai chủ.
    expect(duLieuChu(duAn)).toEqual({ projectId: "p1", coHoiId: null });
    expect(duLieuChu(coHoi)).toEqual({ projectId: null, coHoiId: "c1" });
  });

  it("dữ liệu sinh ra luôn thỏa bất biến một chủ", () => {
    expect(chuHopLe(duLieuChu(duAn))).toBe(true);
    expect(chuHopLe(duLieuChu(coHoi))).toBe(true);
  });
});

describe("laCungChu", () => {
  it("khớp đúng chủ của mình", () => {
    expect(laCungChu(duAn, { projectId: "p1", coHoiId: null })).toBe(true);
    expect(laCungChu(coHoi, { projectId: null, coHoiId: "c1" })).toBe(true);
  });

  it("KHÔNG khớp dự toán của chủ khác cùng loại", () => {
    expect(laCungChu(duAn, { projectId: "p2", coHoiId: null })).toBe(false);
    expect(laCungChu(coHoi, { projectId: null, coHoiId: "c2" })).toBe(false);
  });

  it("chủ loại này không bao giờ khớp cột của loại kia", () => {
    // Trùng id giữa hai bảng là chuyện hiếm nhưng không cấm được. Nếu hàm này so id
    // mà không so loại thì mượn một id cơ hội là mở được dự toán của dự án.
    expect(laCungChu({ loai: "DU_AN", id: "x" }, { projectId: null, coHoiId: "x" })).toBe(false);
    expect(laCungChu({ loai: "CO_HOI", id: "x" }, { projectId: "x", coHoiId: null })).toBe(false);
  });

  it("id rỗng không khớp gì cả, kể cả dòng mồ côi", () => {
    // Nếu thiếu phép kiểm này thì `"" === ""`... nhưng nguy hơn là chuỗi rỗng lọt vào
    // từ URL rồi khớp với dòng chưa có chủ.
    expect(laCungChu({ loai: "DU_AN", id: "" }, { projectId: null, coHoiId: null })).toBe(false);
    expect(laCungChu({ loai: "CO_HOI", id: "" }, { projectId: null, coHoiId: null })).toBe(false);
  });

  it("dòng mồ côi không thuộc về ai", () => {
    expect(laCungChu(duAn, { projectId: null, coHoiId: null })).toBe(false);
    expect(laCungChu(coHoi, { projectId: null, coHoiId: null })).toBe(false);
  });
});

describe("whereCuaChu", () => {
  it("lọc đúng một cột, không bao giờ ra mệnh đề rỗng", () => {
    expect(whereCuaChu(duAn)).toEqual({ projectId: "p1" });
    expect(whereCuaChu(coHoi)).toEqual({ coHoiId: "c1" });
    for (const chu of [duAn, coHoi]) {
      expect(Object.keys(whereCuaChu(chu)).length).toBe(1);
    }
  });
});

describe("đường dẫn", () => {
  it("mỗi loại chủ có trang riêng", () => {
    expect(duongDanChu(duAn)).toBe("/projects/p1/quote");
    expect(duongDanChu(coHoi)).toBe("/co-hoi/c1/quote");
  });

  it("trang in nằm dưới trang dự toán của chính chủ đó", () => {
    expect(duongDanIn(duAn, "q9")).toBe("/projects/p1/quote/q9/print");
    expect(duongDanIn(coHoi, "q9")).toBe("/co-hoi/c1/quote/q9/print");
  });
});
