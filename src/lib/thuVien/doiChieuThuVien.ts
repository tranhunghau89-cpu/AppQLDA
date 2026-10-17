// Đối chiếu dòng dự toán thi công với thư viện công tác — logic THUẦN, không đụng Prisma.
//
// Dòng áp từ bộ hạng mục TRƯỚC khi áp mẫu biết mang mã công việc xuống thì không có
// `congTacId`: bảng hiện số thứ tự thay cho mã, và đơn giá là giá chép vào bộ lúc lập mẫu,
// không theo thư viện. Tìm lại mã theo thứ tự tin cậy giảm dần:
//   1. dòng bộ của ĐÚNG phần đã áp (hạng mục mang templateId) cùng tên + đơn vị;
//   2. dòng bộ bất kỳ cùng tên + đơn vị, khi mọi dòng ấy gắn CÙNG một công tác;
//   3. công tác thư viện có tên gọn (hoặc tên) + đơn vị trùng khớp, duy nhất.
// Mơ hồ (nhiều ứng viên khác nhau) thì không đoán — người dùng gắn tay bằng ô công việc.

import { norm } from "@/lib/text";

export interface DongCanDoiChieu {
  id: string;
  ten: string;
  donVi: string | null;
  congTacId: string | null;
  donGia: number | null;
  /** Bộ hạng mục phần đã áp vào hạng mục chứa dòng (EstimateSection.templateId). */
  phanMauId: string | null;
  /** Đầu việc lấy giá từ mục con dự toán — không thay đơn giá. */
  coMucCon: boolean;
}

export interface DongBo {
  phanId: string | null;
  ten: string;
  donVi: string | null;
  congTacId: string | null;
}

export interface CongTacThuVien {
  id: string;
  ma: string;
  ten: string;
  tenNgan: string | null;
  donVi: string | null;
  donGia: number | null;
}

export interface DeXuatDoiChieu {
  id: string;
  congTacId: string;
  ma: string;
  /** Lấy mã từ đâu — để người dùng biết tin tới mức nào. */
  nguon: "phan_mau" | "bo" | "ten" | "da_co";
  donGiaCu: number | null;
  /** Null = thư viện chưa có giá, hoặc đầu việc tính giá theo mục con: giữ giá cũ. */
  donGiaMoi: number | null;
}

const khoa = (ten: string, dv: string | null) => `${norm(ten)}|${norm(dv)}`;

function duyNhat<T>(ds: T[]): T | null {
  const s = [...new Set(ds)];
  return s.length === 1 ? s[0] : null;
}

export function doiChieuThuVien(
  dong: readonly DongCanDoiChieu[],
  bo: readonly DongBo[],
  congTac: readonly CongTacThuVien[]
): DeXuatDoiChieu[] {
  const theoId = new Map(congTac.map((c) => [c.id, c]));
  const boTheoKhoa = new Map<string, DongBo[]>();
  for (const b of bo) {
    if (!b.congTacId || !theoId.has(b.congTacId)) continue;
    const k = khoa(b.ten, b.donVi);
    boTheoKhoa.set(k, [...(boTheoKhoa.get(k) ?? []), b]);
  }
  const ctTheoKhoa = new Map<string, string[]>();
  for (const c of congTac) {
    for (const ten of new Set([c.tenNgan, c.ten].filter((x): x is string => !!x))) {
      const k = khoa(ten, c.donVi);
      ctTheoKhoa.set(k, [...(ctTheoKhoa.get(k) ?? []), c.id]);
    }
  }

  const out: DeXuatDoiChieu[] = [];
  for (const d of dong) {
    let congTacId = d.congTacId;
    let nguon: DeXuatDoiChieu["nguon"] = "da_co";
    if (!congTacId) {
      const k = khoa(d.ten, d.donVi);
      const ungVien = boTheoKhoa.get(k) ?? [];
      const theoPhan = d.phanMauId ? duyNhat(ungVien.filter((b) => b.phanId === d.phanMauId).map((b) => b.congTacId!)) : null;
      const theoBo = duyNhat(ungVien.map((b) => b.congTacId!));
      const theoTen = duyNhat(ctTheoKhoa.get(k) ?? []);
      if (theoPhan) [congTacId, nguon] = [theoPhan, "phan_mau"];
      else if (theoBo) [congTacId, nguon] = [theoBo, "bo"];
      else if (theoTen) [congTacId, nguon] = [theoTen, "ten"];
    }
    const ct = congTacId ? theoId.get(congTacId) : undefined;
    if (!ct) continue;
    const donGiaMoi = d.coMucCon ? null : ct.donGia;
    const doiGia = donGiaMoi != null && donGiaMoi !== d.donGia;
    // Dòng đã có mã và đúng giá thì không có gì để đề xuất.
    if (nguon === "da_co" && !doiGia) continue;
    out.push({ id: d.id, congTacId: ct.id, ma: ct.ma, nguon, donGiaCu: d.donGia, donGiaMoi: doiGia ? donGiaMoi : null });
  }
  return out;
}
