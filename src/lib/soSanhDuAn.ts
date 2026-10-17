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
  /** Thành tiền ÷ KL — đơn giá bình quân của đầu việc trong dự án. */
  donGia: number | null;
}

export interface ThongKe {
  n: number;
  trungVi: number | null;
  trungBinh: number | null;
  min: number | null;
  max: number | null;
}

export type ChiSo = "klM2" | "tienM2" | "tyTrong" | "donGia";

export interface DongSoSanh {
  key: string;
  /** Khoá đầu việc không kèm hạng mục — thứ được gộp tay. Null với hạng mục / nhóm. */
  khoaDauViec: string | null;
  cap: "hang_muc" | "dau_viec" | "nhom";
  ten: string;
  donVi: string | null;
  /** Đơn vị lẫn lộn giữa các dự án (kg ở dự án này, tấn ở dự án kia) → KL không cộng được. */
  donViLech: boolean;
  /** Nhóm chi phí gặp nhiều nhất — dùng khi đổ tạm tính thành dòng dự toán. */
  groupCode: string;
  congTacId: string | null;
  theoDuAn: Record<string, O>;
  thongKe: Record<ChiSo, ThongKe>;
}

export interface KetQuaSoSanh {
  duAn: { id: string; code: string; name: string; area: number | null; tong: number; tongM2: number | null }[];
  tong: Record<ChiSo, ThongKe>;
  /** Hạng mục, mỗi hạng mục theo sau là các đầu việc của nó. */
  dong: DongSoSanh[];
  /**
   * Đầu việc gộp toàn dự án, bỏ qua hạng mục. Cần vì phần lớn dự án cũ nhập từ Excel không
   * có hạng mục, còn dự án mới chia Khung mái / Vách — xếp theo hạng mục thì cùng một "Thép
   * tổ hợp" bị chẻ làm hai và mỗi bên chỉ còn nửa số dự án.
   */
  dauViec: DongSoSanh[];
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
  nhomMa: DemTen;
  congTacId: string | null;
  donViNorm: Set<string>;
  kl: Map<string, number>;
  tien: Map<string, number>;
  thuTu: number;
}

/**
 * Nối các khoá gộp tay thành ánh xạ phẳng nguồn → đích cuối. A→B, B→C thì A→C; vòng lặp
 * (A→B, B→A) dừng ở chỗ gặp lại, không treo.
 */
export function phangGop(cap: { khoaNguon: string; khoaDich: string }[]): Map<string, string> {
  const m = new Map(cap.map((c) => [c.khoaNguon, c.khoaDich]));
  const out = new Map<string, string>();
  for (const k of m.keys()) {
    let d = k;
    const da = new Set<string>([k]);
    while (m.has(d) && !da.has(m.get(d)!)) {
      d = m.get(d)!;
      da.add(d);
    }
    if (d !== k) out.set(k, d);
  }
  return out;
}

export function soSanhDuAn(
  dsDuAn: DuAnNhap[],
  nguon: NguonSo = "du_toan",
  gop: Map<string, string> = new Map()
): KetQuaSoSanh {
  const gom = new Map<string, Gom>();
  const conCua = new Map<string, string[]>(); // khoá hạng mục → khoá đầu việc theo thứ tự gặp
  const nhomGom = new Map<string, Gom>();
  const dvGom = new Map<string, Gom>(); // đầu việc gộp toàn dự án, bỏ qua hạng mục
  let thuTu = 0;

  const lay = (m: Map<string, Gom>, key: string, cap: Gom["cap"]) => {
    let g = m.get(key);
    if (!g) {
      g = {
        key,
        cap,
        ten: new DemTen(),
        donVi: new DemTen(),
        nhomMa: new DemTen(),
        congTacId: null,
        donViNorm: new Set(),
        kl: new Map(),
        tien: new Map(),
        thuTu: thuTu++,
      };
      m.set(key, g);
    }
    return g;
  };
  const ghiDauViec = (g: Gom, d: DongNhap, pId: string, kl: number, tien: number) => {
    g.ten.them(d.name);
    g.donVi.them(d.unit);
    g.nhomMa.them(d.groupCode);
    g.congTacId ??= d.congTacId;
    g.donViNorm.add(norm(d.unit));
    cong(g.kl, pId, kl);
    cong(g.tien, pId, tien);
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

      const goc = khoaDauViec(d);
      const kItem = gop.get(goc) ?? goc;
      const kDv = `${kHm}/${kItem}`;
      if (!gom.has(kDv)) conCua.set(kHm, [...(conCua.get(kHm) ?? []), kDv]);
      ghiDauViec(lay(gom, kDv, "dau_viec"), d, p.id, kl, tien);
      ghiDauViec(lay(dvGom, kItem, "dau_viec"), d, p.id, kl, tien);

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
        donGia: coKl && kl > 0 && tien > 0 ? tien / kl : null,
      };
    }
    const cot = (k: ChiSo) => thongKe(Object.values(theoDuAn).map((o) => o[k]));
    return {
      key: g.key,
      khoaDauViec: g.cap === "dau_viec" ? g.key.slice(g.key.indexOf("/") + 1) : null,
      cap: g.cap,
      ten: g.ten.nhieuNhat() ?? "—",
      donVi: g.donVi.nhieuNhat(),
      donViLech: g.donViNorm.size > 1,
      groupCode: g.cap === "nhom" ? g.key : g.nhomMa.nhieuNhat() ?? "KHAC",
      congTacId: g.congTacId,
      theoDuAn,
      thongKe: { klM2: cot("klM2"), tienM2: cot("tienM2"), tyTrong: cot("tyTrong"), donGia: cot("donGia") },
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
      donGia: thongKe([]),
    },
    dong,
    dauViec: [...dvGom.values()].map(dien).sort(theoTyTrong),
    nhom: [...nhomGom.values()].map(dien).sort(theoTyTrong),
  };
}

/**
 * Dự án có dự toán gần như trống (đ/m² dưới `tiLe` × trung vị) — mặc định bỏ khỏi tham
 * chiếu, vì vài dự án mới nhập một dòng 1 triệu kéo min và trung bình xuống vô nghĩa.
 */
export function duAnGanTrong(
  dsDuAn: Pick<DuAnNhap, "id" | "area" | "items">[],
  tiLe = 0.2
): Set<string> {
  const m2 = dsDuAn.map((p) => {
    const tong = p.items.reduce((s, d) => s + computeAmount(d), 0);
    return { id: p.id, v: p.area && p.area > 0 ? tong / p.area : null, tong };
  });
  const tv = trungVi(m2.flatMap((x) => (x.v != null && x.v > 0 ? [x.v] : [])));
  return new Set(m2.filter((x) => x.tong <= 0 || (tv != null && x.v != null && x.v < tv * tiLe)).map((x) => x.id));
}

export interface DongTamTinh {
  khoaDauViec: string;
  ten: string;
  donVi: string | null;
  groupCode: string;
  congTacId: string | null;
  /** Số dự án tham chiếu có đầu việc này. */
  n: number;
  kl: number | null;
  donGia: number | null;
  tien: number;
}

/**
 * Tạm tính dự toán cho dự án `m2` mét vuông từ trung vị các dự án tham chiếu.
 *
 * Chỉ lấy đầu việc xuất hiện ở ít nhất `tiLeCoMat` số dự án — đầu việc chỉ một công trình
 * có (canopy, sàn lửng) không phải phần "thường có" của dự án mới.
 *
 * KL = KL/m² trung vị × m²; đơn giá = đơn giá trung vị; thành tiền = KL × đơn giá. Đầu
 * việc không có KL so được (đơn vị lệch) thì thành tiền lấy đ/m² trung vị × m².
 */
export function tamTinh(kq: KetQuaSoSanh, m2: number, tiLeCoMat = 0.5): DongTamTinh[] {
  const soDuAn = kq.duAn.length;
  const out: DongTamTinh[] = [];
  for (const d of kq.dauViec) {
    const n = Object.keys(d.theoDuAn).length;
    if (n === 0 || n < soDuAn * tiLeCoMat) continue;
    const klM2 = d.donViLech ? null : d.thongKe.klM2.trungVi;
    const donGia = d.donViLech ? null : d.thongKe.donGia.trungVi;
    const kl = klM2 != null ? klM2 * m2 : null;
    const tien = kl != null && donGia != null ? kl * donGia : (d.thongKe.tienM2.trungVi ?? 0) * m2;
    out.push({
      khoaDauViec: d.khoaDauViec ?? d.key,
      ten: d.ten,
      donVi: d.donVi,
      groupCode: d.groupCode,
      congTacId: d.congTacId,
      n,
      kl,
      donGia: kl != null && donGia != null ? donGia : null,
      tien,
    });
  }
  return out;
}
