"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { datBienTheMacDinh, themBienThe, xoaBienThe } from "./bienTheActions";

export interface BienTheView {
  id: string;
  vatTuMa: string;
  vatTuTen: string;
  hang: string | null;
  quyCach: string | null;
  tenBienThe: string | null;
  laMacDinh: boolean;
  soBanGia: number;
  /** Đơn giá riêng của biến thể này hôm nay; null = chưa khai, dùng giá chung. */
  donGiaRieng: number | null;
}

export function BienTheEditor({
  congTacId,
  bienThes,
  vatTuChuaGan,
  canEdit,
}: {
  congTacId: string;
  bienThes: BienTheView[];
  vatTuChuaGan: { id: string; ma: string; ten: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await themBienThe(congTacId, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function onMacDinh(bt: BienTheView) {
    start(async () => {
      const res = await datBienTheMacDinh(bt.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  async function onXoa(bt: BienTheView) {
    if (!(await confirm(`Gỡ biến thể "${bt.vatTuTen}" khỏi công tác này?`))) return;
    start(async () => {
      const res = await xoaBienThe(bt.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Biến thể vật liệu</h2>
          <p className="text-sm text-slate-500">
            Cùng một công tác làm bằng vật liệu khác nhau thì đơn giá khác nhau. Khai
            biến thể ở đây rồi thêm bản giá riêng cho từng cái; biến thể chưa có giá
            riêng vẫn dùng giá chung của công tác.
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            disabled={vatTuChuaGan.length === 0}
            title={
              vatTuChuaGan.length === 0
                ? "Mọi vật tư trong thư viện đã được gán cho công tác này"
                : undefined
            }
          >
            <Plus className="h-4 w-4" /> Thêm biến thể
          </Button>
        )}
      </div>

      {bienThes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
          Công tác này chưa khai biến thể nào — đơn giá của nó áp cho mọi vật liệu.
          {canEdit && vatTuChuaGan.length === 0 && (
            <>
              {" "}
              Chưa có vật tư nào trong thư viện;{" "}
              <Link href="/thu-vien/vat-tu" className="text-blue-700 underline">
                khai vật tư trước
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table>
            <THead>
              <tr>
                <Th className="w-10"></Th>
                <Th>Vật tư</Th>
                <Th className="hidden md:table-cell">Hãng / quy cách</Th>
                <Th className="text-right">Đơn giá riêng</Th>
                <Th className="hidden sm:table-cell text-right">Bản giá</Th>
                {canEdit && <Th></Th>}
              </tr>
            </THead>
            <tbody>
              {bienThes.map((bt) => (
                <Tr key={bt.id}>
                  <Td>
                    <button
                      type="button"
                      onClick={() => canEdit && onMacDinh(bt)}
                      disabled={!canEdit}
                      className="rounded p-1 disabled:cursor-default"
                      title={
                        bt.laMacDinh
                          ? "Đang là biến thể mặc định — bấm để bỏ"
                          : "Đặt làm biến thể mặc định"
                      }
                      aria-label="Biến thể mặc định"
                    >
                      <Star
                        className={
                          bt.laMacDinh
                            ? "h-4 w-4 fill-amber-400 text-amber-500"
                            : "h-4 w-4 text-slate-300"
                        }
                      />
                    </button>
                  </Td>
                  <Td className="font-medium text-slate-900">
                    {bt.tenBienThe ?? bt.vatTuTen}
                    <span className="ml-2 font-mono text-xs text-slate-400">
                      {bt.vatTuMa}
                    </span>
                  </Td>
                  <Td className="hidden text-slate-600 md:table-cell">
                    {[bt.hang, bt.quyCach].filter(Boolean).join(" · ") || "—"}
                  </Td>
                  <Td className="text-right font-medium text-blue-700">
                    {bt.donGiaRieng === null ? (
                      <span className="text-slate-400">Dùng giá chung</span>
                    ) : (
                      formatNumber(bt.donGiaRieng)
                    )}
                  </Td>
                  <Td className="hidden text-right text-slate-600 sm:table-cell">
                    {bt.soBanGia}
                  </Td>
                  {canEdit && (
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => onXoa(bt)}
                        title="Gỡ biến thể"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm biến thể vật liệu">
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Vật tư *">
            <Select name="vatTuId" defaultValue="" required>
              <option value="">— Chọn vật tư —</option>
              {vatTuChuaGan.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.ma} — {v.ten}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tên hiển thị (bỏ trống thì dùng tên vật tư)">
            <Input name="tenBienThe" placeholder="Lợp mái tôn Hoa Sen 0,45" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="laMacDinh"
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Đặt làm biến thể mặc định (chọn sẵn khi thêm dòng dự toán)
          </label>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Thêm"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
