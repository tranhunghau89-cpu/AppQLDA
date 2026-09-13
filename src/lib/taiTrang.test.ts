import { describe, expect, it } from "vitest";
import { laBamChuyenTrang, laYeuCauCanCho, type CuBamLienKet } from "./taiTrang";

const bam = (o: Partial<CuBamLienKet>): CuBamLienKet => ({
  href: "/quotes",
  target: null,
  coDownload: false,
  nut: 0,
  coPhimBoTro: false,
  hienTai: "https://app.vn/projects?giai-doan=DU_AN",
  ...o,
});

describe("laBamChuyenTrang", () => {
  it("liên kết nội bộ sang trang khác thì chạy thanh", () => {
    expect(laBamChuyenTrang(bam({}))).toBe(true);
    expect(laBamChuyenTrang(bam({ href: "https://app.vn/quotes" }))).toBe(true);
  });

  it("chỉ đổi tham số lọc cũng là chuyển trang — server phải tải lại dữ liệu", () => {
    expect(laBamChuyenTrang(bam({ href: "/projects?giai-doan=CHAO_GIA" }))).toBe(true);
  });

  it("bấm lại đúng trang đang mở, hoặc chỉ đổi # thì không", () => {
    expect(laBamChuyenTrang(bam({ href: "/projects?giai-doan=DU_AN" }))).toBe(false);
    expect(laBamChuyenTrang(bam({ href: "/projects?giai-doan=DU_AN#bang" }))).toBe(false);
  });

  it("mở tab mới, bấm chuột giữa, giữ phím Ctrl thì không", () => {
    expect(laBamChuyenTrang(bam({ target: "_blank" }))).toBe(false);
    expect(laBamChuyenTrang(bam({ nut: 1 }))).toBe(false);
    expect(laBamChuyenTrang(bam({ coPhimBoTro: true }))).toBe(false);
    expect(laBamChuyenTrang(bam({ target: "_self" }))).toBe(true);
  });

  it("tải file, gọi API, liên kết ra ngoài, mailto thì không", () => {
    expect(laBamChuyenTrang(bam({ coDownload: true }))).toBe(false);
    expect(laBamChuyenTrang(bam({ href: "/api/export/estimate/1" }))).toBe(false);
    expect(laBamChuyenTrang(bam({ href: "https://www.bca-bim.com" }))).toBe(false);
    expect(laBamChuyenTrang(bam({ href: "mailto:a@b.vn" }))).toBe(false);
    expect(laBamChuyenTrang(bam({ href: null }))).toBe(false);
  });
});

describe("laYeuCauCanCho", () => {
  it("tải dữ liệu trang và server action thì chờ", () => {
    expect(laYeuCauCanCho({ rsc: "1", "next-router-state-tree": "x" })).toBe(true);
    expect(laYeuCauCanCho({ Accept: "text/x-component", "Next-Action": "abc" })).toBe(true);
  });

  it("tải trước ngầm thì không", () => {
    expect(laYeuCauCanCho({ rsc: "1", "next-router-prefetch": "1" })).toBe(false);
    expect(laYeuCauCanCho({ rsc: "1", "next-router-segment-prefetch": "/_tree" })).toBe(false);
  });

  it("yêu cầu thường của trang (không phải của Next) thì không", () => {
    expect(laYeuCauCanCho({ "content-type": "application/json" })).toBe(false);
    expect(laYeuCauCanCho(undefined)).toBe(false);
  });
});
