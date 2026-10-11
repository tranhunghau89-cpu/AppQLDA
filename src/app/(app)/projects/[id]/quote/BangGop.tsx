"use client";

import { Table, THead, Th } from "@/components/ui/table";
import { formatNumber, formatQty, formatVND } from "@/lib/utils";
import type { ItemView, SectionView } from "./types";

export interface DongGop {
  khoa: string;
  workCode: string | null;
  name: string;
  unit: string | null;
  qty: number;
  giaGoc: number;
  thanhTien: number;
  /** Mã các hạng mục (phần gốc) có công tác này. */
  hangMuc: string[];
}

/**
 * Gộp các dòng cùng công tác (cùng mã CV, không có mã thì cùng tên) và cùng đơn vị
 * qua mọi hạng mục: cộng khối lượng và thành tiền. Đơn giá hiện ra là bình quân
 * gia quyền, vì cùng một công tác có thể mang giá khác nhau ở từng hạng mục.
 */
export function gopKhoiLuong(sections: SectionView[], items: ItemView[]): DongGop[] {
  const theoId = new Map(sections.map((s) => [s.id, s]));
  const gocCua = (id: string) => {
    let s = theoId.get(id);
    while (s?.parentId) s = theoId.get(s.parentId);
    return s?.code ?? "";
  };
  const ket = new Map<string, DongGop>();
  for (const it of items) {
    const ten = (it.tenGon ?? it.name).trim();
    const khoa = `${(it.workCode ?? "").trim() || ten.toLowerCase()}|${(it.unit ?? "").trim().toLowerCase()}`;
    let d = ket.get(khoa);
    if (!d) {
      d = { khoa, workCode: it.workCode, name: ten, unit: it.unit, qty: 0, giaGoc: 0, thanhTien: 0, hangMuc: [] };
      ket.set(khoa, d);
    }
    const kl = it.qty ?? 0;
    d.qty += kl;
    d.giaGoc += kl * (it.baseCost ?? 0);
    d.thanhTien += kl * (it.sellPrice ?? 0);
    const hm = gocCua(it.sectionId);
    if (hm && !d.hangMuc.includes(hm)) d.hangMuc.push(hm);
  }
  return [...ket.values()];
}

export function BangGop({ sections, items }: { sections: SectionView[]; items: ItemView[] }) {
  const dong = gopKhoiLuong(sections, items);
  return (
    <Table>
      <THead>
        <tr>
          <Th>Mã CV</Th>
          <Th>Nội dung công việc</Th>
          <Th>ĐVT</Th>
          <Th className="text-right">Tổng khối lượng</Th>
          <Th className="text-right">Đơn giá bán BQ</Th>
          <Th className="text-right">Thành tiền</Th>
          <Th>Hạng mục</Th>
        </tr>
      </THead>
      <tbody>
        {dong.map((d) => (
          <tr key={d.khoa} className="border-t border-slate-100">
            <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{d.workCode ?? "—"}</td>
            <td className="px-3 py-1.5 text-slate-800">{d.name}</td>
            <td className="px-3 py-1.5 text-slate-600">{d.unit ?? ""}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {d.qty ? formatQty(d.qty) : <span className="text-slate-300">—</span>}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
              {d.qty ? formatNumber(Math.round(d.thanhTien / d.qty)) : "—"}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatVND(d.thanhTien)}</td>
            <td className="px-3 py-1.5 text-xs text-slate-500">{d.hangMuc.join(", ")}</td>
          </tr>
        ))}
        {dong.length === 0 && (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
              Chưa có dòng công tác nào.
            </td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}
