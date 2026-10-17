"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { PO_CATEGORY_MAP } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import { doiTenMau, xoaMau } from "./actions";

export interface MauChiTiet {
  id: string;
  name: string;
  category: string;
  createdAt: string;
  items: {
    id: string;
    category: string | null;
    groupName: string | null;
    name: string;
    unit: string | null;
    qty: number | null;
    length: number | null;
    weight: number | null;
  }[];
}

/** Danh sách mẫu; bấm một mẫu để xem đủ nhóm → quy cách → món như trang Đơn hàng. */
export function BangMauDonHang({ mau, canEdit }: { mau: MauChiTiet[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [mo, setMo] = useState<string | null>(null);
  const [, start] = useTransition();

  const chay = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });

  if (mau.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
        Chưa có đơn hàng mẫu nào.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mau.map((m) => {
        const cat = PO_CATEGORY_MAP[m.category];
        const dangMo = mo === m.id;
        const nhom = [...new Set(m.items.map((i) => i.category || "—"))];
        const kg = m.items.reduce((t, i) => t + (i.weight ?? 0), 0);
        return (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <button
                type="button"
                onClick={() => setMo(dangMo ? null : m.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {dangMo ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                )}
                <Badge tone={cat?.tone ?? "slate"}>{cat?.label ?? m.category}</Badge>
                <span className="font-semibold text-slate-900">{m.name}</span>
                <span className="truncate text-sm text-slate-500">
                  · {m.items.length} dòng · {nhom.length} nhóm · {formatNumber(kg)} kg · lưu{" "}
                  {formatDate(m.createdAt)}
                </span>
              </button>
              {canEdit && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Đổi tên"
                    aria-label="Đổi tên"
                    onClick={() => {
                      const ten = window.prompt("Tên mẫu mới", m.name);
                      if (ten != null && ten.trim() !== m.name) chay(() => doiTenMau(m.id, ten));
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Xoá mẫu"
                    aria-label="Xoá mẫu"
                    className="text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      if (
                        await confirm(
                          `Xoá mẫu "${m.name}"? Các đơn đã tạo từ mẫu không bị ảnh hưởng.`,
                        )
                      )
                        chay(() => xoaMau(m.id));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {dangMo && (
              <div className="border-t border-slate-100 p-4">
                <Table>
                  <THead>
                    <tr>
                      <Th className="w-12 text-center">STT</Th>
                      <Th>Tên hàng, quy cách</Th>
                      <Th className="text-right">Dài (mm)</Th>
                      <Th className="text-right">SL</Th>
                      <Th>ĐV</Th>
                      <Th className="text-right">TL (kg)</Th>
                    </tr>
                  </THead>
                  <tbody>
                    {nhom.map((n, ni) => (
                      <NhomMau
                        key={n}
                        so={ni + 1}
                        ten={n}
                        ds={m.items.filter((i) => (i.category || "—") === n)}
                      />
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NhomMau({ so, ten, ds }: { so: number; ten: string; ds: MauChiTiet["items"] }) {
  return (
    <>
      <tr className="border-y-2 border-blue-200 bg-blue-50">
        <td className="py-2 text-center font-bold text-blue-700">{so}</td>
        <td colSpan={5} className="px-3 py-2 font-bold uppercase tracking-wide text-blue-900">
          {ten}
        </td>
      </tr>
      {ds.map((i, k) => {
        const tieuDe = i.groupName && i.groupName !== ds[k - 1]?.groupName;
        return (
          <Fragment key={i.id}>
            {tieuDe && (
              <tr className="bg-slate-50">
                <td />
                <td
                  colSpan={5}
                  className="border-l-4 border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800"
                >
                  {i.groupName}
                </td>
              </tr>
            )}
            <Tr>
              <Td className="text-center text-xs text-slate-400">{k + 1}</Td>
              <Td className="pl-6 text-slate-900">{i.name}</Td>
              <Td className="text-right tabular-nums">{formatNumber(i.length)}</Td>
              <Td className="text-right tabular-nums">{formatNumber(i.qty)}</Td>
              <Td className="text-slate-500">{i.unit || "—"}</Td>
              <Td className="text-right tabular-nums">{formatNumber(i.weight)}</Td>
            </Tr>
          </Fragment>
        );
      })}
    </>
  );
}
