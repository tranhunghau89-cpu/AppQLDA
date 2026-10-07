import { describe, it, expect } from "vitest";
import { buocDaXong, buocToiDa, chonBuoc, timQuyTrinh } from "./quyTrinhBaoGia";

const chiTiet = timQuyTrinh("chi-tiet")!;
const nhanh = timQuyTrinh("nhanh")!;
const trong = { soDuToanCoDong: 0, soBaoGiaCoDong: 0, soBaoGiaDaGui: 0 };

describe("quy trình báo giá", () => {
  it("bước khách hàng luôn xong khi đã có cơ hội", () => {
    expect(buocDaXong("KHACH_HANG", trong)).toBe(true);
  });

  it("dừng ở bước chưa xong đầu tiên", () => {
    expect(buocToiDa(chiTiet, trong)).toBe(2);
    expect(buocToiDa(nhanh, trong)).toBe(2);
    expect(buocToiDa(chiTiet, { ...trong, soDuToanCoDong: 1 })).toBe(3);
  });

  it("không cho nhảy qua dự toán dù đã có báo giá", () => {
    expect(buocToiDa(chiTiet, { ...trong, soBaoGiaCoDong: 1 })).toBe(2);
    expect(buocToiDa(nhanh, { ...trong, soBaoGiaCoDong: 1 })).toBe(3);
  });

  it("xong hết thì ở bước cuối", () => {
    const xong = { soDuToanCoDong: 1, soBaoGiaCoDong: 1, soBaoGiaDaGui: 1 };
    expect(buocToiDa(chiTiet, xong)).toBe(4);
  });

  it("đọc ?buoc= và kẹp lại", () => {
    expect(chonBuoc(chiTiet, trong, undefined)).toBe(2);
    expect(chonBuoc(chiTiet, trong, "1")).toBe(1);
    expect(chonBuoc(chiTiet, trong, "4")).toBe(2);
    expect(chonBuoc(chiTiet, trong, "abc")).toBe(2);
    expect(chonBuoc(chiTiet, trong, "0")).toBe(2);
  });
});
