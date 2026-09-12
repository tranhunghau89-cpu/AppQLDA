"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { DON_GIA_NGUON_MAP, labelOf } from "@/lib/constants";
import { computeBaseCost } from "@/lib/quote";
import { formatDate, formatNumber } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { themBanGia, xoaBanGia } from "../../actions";

export interface BanGiaView {
  id: string;
  vatTu: number | null;
  nhanCongMay: number | null;
  heSo: number | null;
  donGia: number;
  hieuLucTu: string;
  nguon: string;
  ghiChu: string | null;
  createdByName: string | null;
  /** Bản đang được dùng cho một báo giá lập hôm nay. */
  dangApDung: boolean;
  /** Đã khai trước, tới ngày mới có hiệu lực. */
  chuaHieuLuc: boolean;
}

function homNay(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function DonGiaTimeline({
  congTacId,
  heSoMacDinh,
  banGias,
  canEdit,
}: {
  congTacId: string;
  heSoMacDinh: number | null;
  banGias: BanGiaView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [vt, setVt] = useState(0);
  const [ncm, setNcm] = useState(0);
  const [hs, setHs] = useState(heSoMacDinh ?? 1);
  const [donGiaTay, setDonGiaTay] = useState("");

  const toast = useToast();
  const confirm = useConfirm();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await themBanGia(congTacId, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  async function onXoa(g: BanGiaView) {
    const canhBao = g.dangApDung
      ? " Đây là bản ĐANG ÁP DỤNG — xóa xong giá sẽ lùi về bản cũ hơn."
      : "";
    if (!(await confirm(`Xóa bản giá hiệu lực ${formatDate(g.hieuLucTu)}?${canhBao}`)))
      return;
    start(async () => {
      const res = await xoaBanGia(g.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  const tinhRa = computeBaseCost(vt, ncm, hs);
  const daGoTay = donGiaTay.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Lịch sử đơn giá</h2>
          <p className="text-sm text-slate-500">
            Đổi giá là thêm một bản mới có ngày hiệu lực, không sửa đè bản cũ. Báo giá
            đã lập giữ nguyên đơn giá đã chốt tại thời điểm lập.
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setVt(0);
              setNcm(0);
              setHs(heSoMacDinh ?? 1);
              setDonGiaTay("");
              setError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm bản giá
          </Button>
        )}
      </div>

      {banGias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Công tác này chưa có bản giá nào
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table>
            <THead>
              <tr>
                <Th>Hiệu lực từ</Th>
                <Th className="hidden sm:table-cell text-right">Vật tư</Th>
                <Th className="hidden sm:table-cell text-right">NC + Máy</Th>
                <Th className="hidden md:table-cell text-right">Hệ số</Th>
                <Th className="text-right">Đơn giá</Th>
                <Th className="hidden lg:table-cell">Nguồn</Th>
                <Th className="hidden lg:table-cell">Ghi chú</Th>
                {canEdit && <Th></Th>}
              </tr>
            </THead>
            <tbody>
              {banGias.map((g) => (
                <Tr key={g.id}>
                  <Td>
                    <span className="text-slate-700">{formatDate(g.hieuLucTu)}</span>
                    {g.dangApDung && (
                      <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                        Đang áp dụng
                      </span>
                    )}
                    {g.chuaHieuLuc && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        Chưa hiệu lực
                      </span>
                    )}
                  </Td>
                  <Td className="hidden text-right sm:table-cell">
                    {formatNumber(g.vatTu)}
                  </Td>
                  <Td className="hidden text-right sm:table-cell">
                    {formatNumber(g.nhanCongMay)}
                  </Td>
                  <Td className="hidden text-right md:table-cell">{g.heSo ?? "—"}</Td>
                  <Td className="text-right font-medium text-blue-700">
                    {formatNumber(g.donGia)}
                  </Td>
                  <Td className="hidden text-slate-500 lg:table-cell">
                    {labelOf(DON_GIA_NGUON_MAP, g.nguon)}
                  </Td>
                  <Td className="hidden text-slate-500 lg:table-cell">
                    {g.ghiChu ?? "—"}
                    {g.createdByName ? (
                      <span className="text-slate-400"> · {g.createdByName}</span>
                    ) : null}
                  </Td>
                  {canEdit && (
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => onXoa(g)}
                        title="Xóa bản giá"
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

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm bản giá">
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Hiệu lực từ ngày *">
            <Input name="hieuLucTu" type="date" defaultValue={homNay()} required />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Vật tư (VT)">
              <Input
                name="vatTu"
                type="number"
                step="any"
                onChange={(e) => setVt(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="NC + Máy">
              <Input
                name="nhanCongMay"
                type="number"
                step="any"
                onChange={(e) => setNcm(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Hệ số (HS)">
              <Input
                name="heSo"
                type="number"
                step="any"
                defaultValue={heSoMacDinh ?? 1}
                onChange={(e) => setHs(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <Field label="Đơn giá trọn gói (bỏ trống để tính từ VT/NC/HS)">
            <Input
              name="donGia"
              type="number"
              step="any"
              value={donGiaTay}
              onChange={(e) => setDonGiaTay(e.target.value)}
              placeholder={String(Math.round(tinhRa))}
            />
          </Field>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {daGoTay ? (
              <>
                Dùng đơn giá gõ tay:{" "}
                <span className="font-semibold text-blue-700">
                  {formatNumber(Number(donGiaTay))}
                </span>
              </>
            ) : (
              <>
                (VT + NC) × HS ={" "}
                <span className="font-semibold text-blue-700">
                  {formatNumber(tinhRa)}
                </span>
              </>
            )}
          </div>
          <Field label="Ghi chú (nguồn báo giá, lý do đổi giá…)">
            <Input name="ghiChu" />
          </Field>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu bản giá"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
