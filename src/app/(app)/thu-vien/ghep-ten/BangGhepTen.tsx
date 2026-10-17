"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { apGhepTen } from "./actions";

export interface TenChuaNoi {
  ten: string;
  soDong: number;
  soDuAn: number;
  /** Công tác gợi ý sẵn (trùng tên ngắn / tên) — người dùng sửa được. */
  goiY: string | null;
}
export interface CongTacGhep {
  id: string;
  ma: string;
  ten: string;
  donVi: string | null;
  nhomMa: string;
}

export function BangGhepTen({
  ten,
  thuVien,
  canEdit,
}: {
  ten: TenChuaNoi[];
  thuVien: CongTacGhep[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  const [chon, setChon] = useState<Record<string, string>>(() =>
    Object.fromEntries(ten.filter((t) => t.goiY).map((t) => [t.ten, t.goiY!])),
  );
  const nhom = useMemo(() => {
    const m = new Map<string, CongTacGhep[]>();
    for (const c of thuVien) m.set(c.nhomMa, [...(m.get(c.nhomMa) ?? []), c]);
    return [...m];
  }, [thuVien]);
  const soChon = ten.filter((t) => chon[t.ten]).length;
  const soDongChon = ten.reduce((s, t) => s + (chon[t.ten] ? t.soDong : 0), 0);

  if (ten.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 py-10 text-center text-emerald-700">
        Mọi dòng dự toán đã nối Thư viện đơn giá.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Đã chọn <b>{soChon}</b>/{ten.length} tên — <b>{soDongChon}</b> dòng sẽ
          được nối. Tên quá chung (“Vật tư”, “Ống”) cứ để trống, sửa từng dòng
          trong dự toán.
        </p>
        {canEdit && (
          <Button
            disabled={dangLuu || soChon === 0}
            onClick={() =>
              start(async () => {
                const r = await apGhepTen(
                  Object.entries(chon).map(([t, congTacId]) => ({
                    ten: t,
                    congTacId,
                  })),
                );
                if (!r.ok) toast.error(r.error);
                else {
                  toast.success(
                    `Đã nối ${r.soDong} dòng dự toán; tự gắn ${r.soMonGan} món đơn hàng.`,
                  );
                  router.refresh();
                }
              })
            }
          >
            {dangLuu ? "Đang nối…" : `Nối ${soDongChon} dòng`}
          </Button>
        )}
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Tên trong dự toán</Th>
            <Th className="text-right">Số dòng</Th>
            <Th className="text-right">Dự án</Th>
            <Th>Công tác thư viện</Th>
          </tr>
        </THead>
        <tbody>
          {ten.map((t) => (
            <Tr key={t.ten}>
              <Td className="font-medium text-slate-900">{t.ten}</Td>
              <Td className="text-right tabular-nums">{t.soDong}</Td>
              <Td className="text-right tabular-nums text-slate-500">
                {t.soDuAn}
              </Td>
              <Td>
                <select
                  aria-label={`Công tác thư viện cho "${t.ten}"`}
                  disabled={!canEdit}
                  value={chon[t.ten] ?? ""}
                  onChange={(e) =>
                    setChon((c) => {
                      const n = { ...c };
                      if (e.target.value) n[t.ten] = e.target.value;
                      else delete n[t.ten];
                      return n;
                    })
                  }
                  className={cn(
                    "w-full max-w-md rounded border px-2 py-1 text-sm",
                    chon[t.ten]
                      ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                      : "border-red-300 bg-red-50 text-red-700",
                  )}
                >
                  <option value="">⚠ Chưa chọn — bỏ qua</option>
                  {nhom.map(([ma, ds]) => (
                    <optgroup key={ma} label={ma}>
                      {ds.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.ma} · {c.ten}
                          {c.donVi ? ` (${c.donVi})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {t.goiY && chon[t.ten] === t.goiY && (
                  <span className="ml-2 text-xs text-slate-400">gợi ý</span>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
