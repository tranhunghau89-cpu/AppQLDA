import { ESTIMATE_GROUP_MAP } from "./constants";
import { computeActualAmount, computeAmount, type EstimateLine } from "./profit";
import { norm } from "./text";

/**
 * So sánh dự toán giữa các dự án và rút ra CHỈ SỐ CHUẨN (trung vị) theo m².
 *
 * Mỗi dự án đặt tên đầu việc theo kiểu riêng, nên việc khó nhất là biết hai dòng ở hai
 * dự án có phải CÙNG một đầu việc không:
 *  - dòng đổ từ thư viện có `congTacId` → ghép theo đó, chắc chắn nhất;
 *  - còn lại ghép theo tên + đơn vị đã `norm` (bỏ dấu, hoa thường, khoảng trắng).
 * Hạng mục ghép theo mẫu (`templateId`), không có mẫu thì theo tên.
 *
 * Trung vị chứ không phải trung bình: một công trình bất thường (chỉ làm phần mái, giá
 * thép năm sốt) kéo trung bình đi xa, trung vị thì gần như không nhúc nhích.
 */

export type NguonSo = "du_toan" | "thuc_te";

export interface DongNhap extends EstimateLine {
  name: string;
  unit: string | null;
  congTacId: string | null;
  sectionName: string | null;
  sectionTemplateId: string | null;
}

export interface DuAnNhap {
  id: string;
  code: string;
  name: string;
  area: number | null;
  items: DongNhap[];
}

/** Số của một dự án trên một dòng so sánh. */
export interface O {
  kl: number;
  tien: number;
  /** KL ÷ m²; null khi dự án không có diện tích. */
  klM2: number | null;
  /** Thành tiền ÷ m². */
  tienM2: number | null;
  /** Thành tiền ÷ tổng dự toán của dự án (0..1). */
  tyTrong: number | null;
}

export interface ThongKe {
  n: number;
  trungVi: number | null;
  trungBinh: number | null;
  min: number | null;
  max: number | null;
}

export type ChiSo = "klM2" | "tienM2" | "tyTrong";

export interface DongSoSanh {
  key: string;
  cap: "hang_muc" | "dau_viec" | "nhom";
  ten: string;
  donVi: string | null;
  /** Đơn vị lẫn lộn giữa các dự án (kg ở dự án này, tấn ở dự án kia) → KL không cộng được. */
  donViLech: boolean;
  theoDuAn: Record<string, O>;
  thongKe: Record<ChiSo, ThongKe>;
}

export interface KetQuaSoSanh {
  duAn: { id: string; code: string; name: string; area: number | null; tong: number; tongM2: number | null }[];
  tong: Record<ChiSo, ThongKe>;
  /** Hạng mục, mỗi hạng mục theo sau là các đầu việc của nó. */
  dong: DongSoSanh[];
  /** Tổng hợp theo nhóm chi phí (KCT, Xà gồ, Tôn…). */
  nhom: DongSoSanh[];
}

export function trungVi(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function thongKe(xs: (number | null | undefined)[]): ThongKe {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  if (v.length === 0) return { n: 0, trungVi: null, trungBinh: null, min: null, max: null };
  return {
    n: v.length,
    trungVi: trungVi(v),
    trungBinh: v.reduce((a, b) => a + b, 0) / v.length,
    min: Math.min(...v),
    max: Math.max(...v),
  };
}

/** Độ lệch so với trung vị (0.2 = cao hơn 20%). Null khi không so được. */
export function doLech(giaTri: number | null | undefined, tk: ThongKe): number | null {
  if (giaTri == null || tk.trungVi == null || tk.trungVi === 0 || tk.n < 2) return null;
  return giaTri / tk.trungVi - 1;
}

export function khoaHangMuc(d: Pick<DongNhap, "sectionName" | "sectionTemplateId">): string {
  if (d.sectionTemplateId) return `t:${d.sectionTemplateId}`;
  const n = norm(d.sectionName);
  return n ? `n:${n}` : "_";
}

export function khoaDauViec(d: Pick<DongNhap, "name" | "unit" | "congTacId">): string {
  if (d.congTacId) return `c:${d.congTacId}`;
  return `n:${norm(d.name)}|${norm(d.unit)}`;
}

function tienDong(d: DongNhap, nguon: NguonSo): number {
  // Dòng chưa có giá thực tạm lấy số dự toán — giống computeActualCost, để tổng thực tế
  // của dự án mới mua được một nửa không tụt xuống một nửa.
  return nguon === "thuc_te" ? computeActualAmount(d) ?? computeAmount(d) : computeAmount(d);
}

function klDong(d: DongNhap, nguon: NguonSo): number {
  return (nguon === "thuc_te" ? d.actualQty ?? d.designQty : d.designQty) ?? 0;
}

/** Tên/đơn vị gặp nhiều nhất — để hiện, vì cùng một khoá có thể mang nhiều cách viết. */
class DemTen {
  private m = new Map<string, number>();
  them(s: string | null) {
    if (!s) return;
    this.m.set(s, (this.m.get(s) ?? 0) + 1);
  }
  nhieuNhat(): string | null {
    let best: string | null = null;
    let c = 0;
    for (const [k, v] of this.m) if (v > c) [best, c] = [k, v];
    return best;
  }
  get soLoai() {
    return this.m.size;
  }
}

interface Gom {
  key: string;
  cap: DongSoSanh["cap"];
  ten: DemTen;
  donVi: DemTen;
  donViNorm: Set<string>;
  kl: Map<string, number>;
  tien: Map<string, number>;
  thuTu: number;
}

export function soSanhDuAn(dsDuAn: DuAnNhap[], nguon: NguonSo = "du_toan"): KetQuaSoSanh {
  const gom = new Map<string, Gom>();
  const conCua = new Map<string, string[]>(); // khoá hạng mục → khoá đầu việc theo thứ tự gặp
  const nhomGom = new Map<string, Gom>();
  let thuTu = 0;

  const lay = (m: Map<string, Gom>, key: string, cap: Gom["cap"]) => {
    let g = m.get(key);
    if (!g) {
      g = { key, cap, ten: new DemTen(), donVi: new DemTen(), donViNorm: new Set(), kl: new Map(), tien: new Map(), thuTu: thuTu++ };
      m.set(key, g);
    }
    return g;
  };
  const cong = (m: Map<string, number>, id: string, v: number) => m.set(id, (m.get(id) ?? 0) + v);

  const tongDuAn = new Map<string, number>();

  for (const p of dsDuAn) {
    let tong = 0;
    for (const d of p.items) {
      const tien = tienDong(d, nguon);
      const kl = klDong(d, nguon);
      tong += tien;

      const kHm = khoaHangMuc(d);
      const hm = lay(gom, kHm, "hang_muc");
      hm.ten.them(d.sectionName ?? "Chưa phân hạng mục");
      cong(hm.tien, p.id, tien);

      const kDv = `${kHm}/${khoaDauViec(d)}`;
      if (!gom.has(kDv)) conCua.set(kHm, [...(conCua.get(kHm) ?? []), kDv]);
      const dv = lay(gom, kDv, "dau_viec");
      dv.ten.them(d.name);
      dv.donVi.them(d.unit);
      dv.donViNorm.add(norm(d.unit));
      cong(dv.kl, p.id, kl);
      cong(dv.tien, p.id, tien);

      const nh = lay(nhomGom, d.groupCode, "nhom");
      nh.ten.them(ESTIMATE_GROUP_MAP[d.groupCode]?.label ?? d.groupCode);
      cong(nh.tien, p.id, tien);
    }
    tongDuAn.set(p.id, tong);
  }

  const dien = (g: Gom): DongSoSanh => {
    const theoDuAn: Record<string, O> = {};
    const coKl = g.cap === "dau_viec";
    for (const p of dsDuAn) {
      if (!g.tien.has(p.id) && !g.kl.has(p.id)) continue;
      const kl = g.kl.get(p.id) ?? 0;
      const tien = g.tien.get(p.id) ?? 0;
      const m2 = p.area && p.area > 0 ? p.area : null;
      const tong = tongDuAn.get(p.id) ?? 0;
      theoDuAn[p.id] = {
        kl,
        tien,
        klM2: coKl && m2 ? kl / m2 : null,
        tienM2: m2 ? tien / m2 : null,
        tyTrong: tong > 0 ? tien / tong : null,
      };
    }
    const cot = (k: ChiSo) => thongKe(Object.values(theoDuAn).map((o) => o[k]));
    return {
      key: g.key,
      cap: g.cap,
      ten: g.ten.nhieuNhat() ?? "—",
      donVi: g.donVi.nhieuNhat(),
      donViLech: g.donViNorm.size > 1,
      theoDuAn,
      thongKe: { klM2: cot("klM2"), tienM2: cot("tienM2"), tyTrong: cot("tyTrong") },
    };
  };

  // Hạng mục xếp theo tỷ trọng trung vị giảm dần; đầu việc trong hạng mục cũng vậy, để
  // phần nặng tiền nằm trên cùng.
  const theoTyTrong = (a: DongSoSanh, b: DongSoSanh) =>
    (b.thongKe.tyTrong.trungVi ?? -1) - (a.thongKe.tyTrong.trungVi ?? -1);

  const hangMuc = [...gom.values()].filter((g) => g.cap === "hang_muc").map(dien).sort(theoTyTrong);
  const dong: DongSoSanh[] = [];
  for (const hm of hangMuc) {
    dong.push(hm);
    const con = (conCua.get(hm.key) ?? []).map((k) => dien(gom.get(k)!)).sort(theoTyTrong);
    dong.push(...con);
  }

  const duAn = dsDuAn.map((p) => {
    const tong = tongDuAn.get(p.id) ?? 0;
    return { id: p.id, code: p.code, name: p.name, area: p.area, tong, tongM2: p.area && p.area > 0 ? tong / p.area : null };
  });

  return {
    duAn,
    tong: {
      klM2: thongKe([]),
      tienM2: thongKe(duAn.map((d) => d.tongM2)),
      tyTrong: thongKe([]),
    },
    dong,
    nhom: [...nhomGom.values()].map(dien).sort(theoTyTrong),
  };
}
