// Gộp món đơn hàng cùng mã (quy cách) qua nhiều hạng mục — như cột "Mã bulong / Tổng SL /
// Tổng trọng lượng" bên phải sheet BLLK. Bóc tách nhập riêng từng hạng mục (khung mái,
// cột, giằng…), đặt hàng thì nhà cung cấp chỉ cần tổng mỗi mã. Hàm THUẦN.

import { norm } from "@/lib/text";

export interface MonGop {
  name: string;
  unit: string | null;
  qty: number | null;
  weight: number | null;
  /** Hạng mục món nằm dưới (HM khung mái…) — để biết tổng gồm những phần nào. */
  groupName: string | null;
}

export interface DongGop {
  name: string;
  unit: string | null;
  qty: number;
  weight: number;
  /** SL theo từng hạng mục, theo thứ tự xuất hiện. */
  chiTiet: { hangMuc: string; qty: number }[];
}

/** Khoá gộp: tên + ĐV, bỏ dấu/khoảng trắng/hoa thường — "M20×70" và "M20x70" là một mã. */
const khoa = (m: MonGop) => `${norm(m.name.replace(/[×*]/g, "x"))}|${norm(m.unit ?? "")}`;

export function gopTheoMa(ds: readonly MonGop[]): DongGop[] {
  const m = new Map<string, DongGop>();
  for (const x of ds) {
    const k = khoa(x);
    const g = m.get(k) ?? { name: x.name, unit: x.unit, qty: 0, weight: 0, chiTiet: [] };
    g.qty += x.qty ?? 0;
    g.weight += x.weight ?? 0;
    const hm = x.groupName?.trim() || "—";
    const ct = g.chiTiet.find((c) => c.hangMuc === hm);
    if (ct) ct.qty += x.qty ?? 0;
    else g.chiTiet.push({ hangMuc: hm, qty: x.qty ?? 0 });
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, weight: Math.round(g.weight * 1000) / 1000 }));
}
