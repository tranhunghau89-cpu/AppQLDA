"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatVND } from "@/lib/utils";
import type { CustomerDebt, SupplierDebt } from "@/lib/debt";

const SOURCE_LABEL: Record<string, string> = {
  QUYETTOAN: "Quyết toán",
  HOPDONG: "Hợp đồng",
  GIABAN: "Giá bán",
  NONE: "—",
};

export function ReceivableTable({ rows }: { rows: CustomerDebt[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  if (rows.length === 0)
    return <p className="text-sm text-slate-400">Chưa có dữ liệu công nợ phải thu.</p>;

  return (
    <Table>
      <THead>
        <tr>
          <Th>Chủ đầu tư</Th>
          <Th className="text-right">Giá trị HĐ</Th>
          <Th className="text-right">Đã thu</Th>
          <Th className="text-right">Còn phải thu</Th>
          <Th className="text-center">Số DA</Th>
        </tr>
      </THead>
      <tbody>
        {rows.map((c) => {
          const key = c.customerId ?? "__none__";
          const isOpen = open.has(key);
          return (
            <FragmentRow key={key}>
              <Tr className="cursor-pointer" onClick={() => toggle(key)}>
                <Td className="font-medium text-slate-900">
                  <span className="inline-flex items-center gap-1">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    {c.name}
                  </span>
                </Td>
                <Td className="text-right">{formatVND(c.totalValue)}</Td>
                <Td className="text-right text-green-600">{formatVND(c.totalCollected)}</Td>
                <Td className="text-right font-semibold text-blue-700">
                  {formatVND(c.totalReceivable)}
                </Td>
                <Td className="text-center">{c.projects.length}</Td>
              </Tr>
              {isOpen &&
                c.projects.map((p) => (
                  <tr key={p.projectId} className="border-b border-slate-100 bg-slate-50/60">
                    <Td className="pl-9">
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="text-slate-700 hover:text-blue-600 hover:underline"
                      >
                        {p.code} · {p.name}
                      </Link>
                      <span className="ml-2 text-xs text-slate-400">
                        ({SOURCE_LABEL[p.source]})
                      </span>
                    </Td>
                    <Td className="text-right">{formatVND(p.value)}</Td>
                    <Td className="text-right text-green-600">{formatVND(p.collected)}</Td>
                    <Td className="text-right text-blue-700">{formatVND(p.receivable)}</Td>
                    <Td />
                  </tr>
                ))}
            </FragmentRow>
          );
        })}
      </tbody>
    </Table>
  );
}

export function PayableTable({ rows }: { rows: SupplierDebt[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  if (rows.length === 0)
    return <p className="text-sm text-slate-400">Chưa có dữ liệu công nợ phải trả.</p>;

  return (
    <Table>
      <THead>
        <tr>
          <Th>Nhà cung cấp</Th>
          <Th className="text-right">Đặt hàng</Th>
          <Th className="text-right">Giá trị QT</Th>
          <Th className="text-right">Đã trả</Th>
          <Th className="text-right">Còn phải trả</Th>
          <Th className="text-center">Số DA</Th>
        </tr>
      </THead>
      <tbody>
        {rows.map((s, i) => {
          const key = s.supplierId ?? `name:${i}`;
          const isOpen = open.has(key);
          return (
            <FragmentRow key={key}>
              <Tr className="cursor-pointer" onClick={() => toggle(key)}>
                <Td className="font-medium text-slate-900">
                  <span className="inline-flex items-center gap-1">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    {s.name}
                    {!s.matched && (
                      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        chưa khớp
                      </span>
                    )}
                  </span>
                </Td>
                <Td className="text-right">{formatVND(s.totalOrdered)}</Td>
                <Td className="text-right">{formatVND(s.totalQtValue)}</Td>
                <Td className="text-right text-green-600">{formatVND(s.totalPaid)}</Td>
                <Td className="text-right font-semibold text-amber-700">
                  {formatVND(s.totalPayable)}
                </Td>
                <Td className="text-center">{s.projects.length}</Td>
              </Tr>
              {isOpen &&
                s.projects.map((p) => (
                  <tr key={p.projectId} className="border-b border-slate-100 bg-slate-50/60">
                    <Td className="pl-9">
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="text-slate-700 hover:text-blue-600 hover:underline"
                      >
                        {p.code} · {p.name}
                      </Link>
                    </Td>
                    <Td className="text-right">{formatVND(p.ordered)}</Td>
                    <Td className="text-right">{formatVND(p.qtValue)}</Td>
                    <Td className="text-right text-green-600">{formatVND(p.paid)}</Td>
                    <Td className="text-right text-amber-700">{formatVND(p.payable)}</Td>
                    <Td />
                  </tr>
                ))}
            </FragmentRow>
          );
        })}
      </tbody>
    </Table>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
