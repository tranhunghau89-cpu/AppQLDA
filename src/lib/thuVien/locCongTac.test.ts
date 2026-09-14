import { describe, expect, it } from "vitest";
import { locCongTac } from "./locCongTac";

const DS = [
  { code: "AA.110", name: "Thép tổ hợp cột, kèo, dầm, Q345", tenNgan: "Thép tổ hợp" },
  { code: "AA.120", name: "Thép hình gia công, td<300mm, thép SS400", tenNgan: "Thép hình" },
  { code: "AB.110", name: "Bulong neo M22 dày 650, CT34, xi kẽm ren", tenNgan: "Bulong neo" },
  { code: "AG.110", name: "Vận chuyển bulong neo", tenNgan: null },
];

const ma = (xs: { code: string }[]) => xs.map((x) => x.code);

describe("locCongTac", () => {
  it("chuỗi rỗng hoặc chỉ khoảng trắng trả cả danh sách theo thứ tự thư viện", () => {
    expect(ma(locCongTac(DS, ""))).toEqual(["AA.110", "AA.120", "AB.110", "AG.110"]);
    expect(ma(locCongTac(DS, "   "))).toEqual(["AA.110", "AA.120", "AB.110", "AG.110"]);
  });

  it("gõ không dấu vẫn khớp tên có dấu", () => {
    expect(ma(locCongTac(DS, "thep to hop"))).toEqual(["AA.110"]);
  });

  it("các từ không cần đúng thứ tự, nhưng từ nào cũng phải có mặt", () => {
    expect(ma(locCongTac(DS, "Q345 tổ hợp"))).toEqual(["AA.110"]);
    expect(ma(locCongTac(DS, "bulong"))).toEqual(["AB.110", "AG.110"]);
    expect(ma(locCongTac(DS, "bulong vận"))).toEqual(["AG.110"]);
    expect(locCongTac(DS, "bulong thép")).toEqual([]);
  });

  it("khớp theo mã, kể cả gõ thiếu dấu chấm", () => {
    expect(ma(locCongTac(DS, "AB.110"))).toEqual(["AB.110"]);
    expect(ma(locCongTac(DS, "aa1"))).toEqual(["AA.110", "AA.120"]);
  });

  it("khớp theo tên ngắn", () => {
    expect(ma(locCongTac(DS, "thép hình"))).toEqual(["AA.120"]);
  });

  it("dừng ở giới hạn", () => {
    expect(ma(locCongTac(DS, "", 2))).toEqual(["AA.110", "AA.120"]);
    expect(ma(locCongTac(DS, "thep", 1))).toEqual(["AA.110"]);
  });
});
