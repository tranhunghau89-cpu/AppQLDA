"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { SUPPLIER_CATEGORY_MAP, labelOf } from "@/lib/constants";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { ganKhuVucChoNhaCungCap, luuKhuVuc, xoaKhuVuc } from "./actions";

export interface KhuVucView {
  id: string;
  ma: string;
  ten: string;
  ghiChu: string | null;
  soNhaCungCap: number;
  soBanGia: number;
  soDuAn: number;
}

export interface NhaCungCapView {
  id: string;
  ten: string;
  nhom: string;
  khuVucIds: string[];
}

export function KhuVucManager({
  khuVucs,
  nhaCungCaps,
  canEdit,
}: {
  khuVucs: KhuVucView[];
  nhaCungCaps: NhaCungCapView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KhuVucView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [q, setQ] = useState("");
  const [dangLuu, setDangLuu] = useState<string | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  const nccLoc = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return nhaCungCaps;
    return nhaCungCaps.filter((n) => n.ten.toLowerCase().includes(s));
  }, [nhaCungCaps, q]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await luuKhuVuc(editing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  async function onXoa(k: KhuVucView) {
    if (!(await confirm(`Xóa khu vực "${k.ma} — ${k.ten}"?`))) return;
    start(async () => {
      const res = await xoaKhuVuc(k.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function doiKhuVuc(ncc: NhaCungCapView, khuVucId: string, bat: boolean) {
    const sau = bat
      ? [...ncc.khuVucIds, khuVucId]
      : ncc.khuVucIds.filter((x) => x !== khuVucId);
    setDangLuu(ncc.id);
    start(async () => {
      const res = await ganKhuVucChoNhaCungCap(ncc.id, sau);
      setDangLuu(null);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* ----- Danh sách khu vực ----- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">
            Khu vực ({khuVucs.length})
          </h2>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setError(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Thêm khu vực
            </Button>
          )}
        </div>

        {khuVucs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            Chưa khai khu vực nào. Không có khu vực thì mọi đơn giá là giá chung toàn
            quốc — vẫn dùng được, chỉ là không phân biệt được vùng.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white">
            <Table>
              <THead>
                <tr>
                  <Th>Mã</Th>
                  <Th>Tên khu vực</Th>
                  <Th className="hidden md:table-cell">Ghi chú</Th>
                  <Th className="text-right">NCC</Th>
                  <Th className="text-right">Bản giá riêng</Th>
                  <Th className="text-right">Dự án</Th>
                  {canEdit && <Th></Th>}
                </tr>
              </THead>
              <tbody>
                {khuVucs.map((k) => (
                  <Tr key={k.id}>
                    <Td className="font-mono text-slate-700">{k.ma}</Td>
                    <Td className="font-medium text-slate-900">{k.ten}</Td>
                    <Td className="hidden text-slate-500 md:table-cell">
                      {k.ghiChu ?? "—"}
                    </Td>
                    <Td className="text-right text-slate-600">{k.soNhaCungCap}</Td>
                    <Td className="text-right text-slate-600">{k.soBanGia}</Td>
                    <Td className="text-right text-slate-600">{k.soDuAn}</Td>
                    {canEdit && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(k);
                              setError(null);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => onXoa(k)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      {/* ----- Gán nhà cung cấp vào khu vực ----- */}
      {khuVucs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-slate-900">
                Nhà cung cấp phục vụ vùng nào
              </h2>
              <p className="text-sm text-slate-500">
                Một nhà cung cấp phục vụ được nhiều vùng — Hoa Sen, Hoà Phát bán toàn
                quốc. Tích ô là lưu ngay.
              </p>
            </div>
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Tìm nhà cung cấp…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <Table>
              <THead>
                <tr>
                  <Th>Nhà cung cấp</Th>
                  <Th className="hidden sm:table-cell">Nhóm</Th>
                  {khuVucs.map((k) => (
                    <Th key={k.id} className="text-center whitespace-nowrap">
                      {k.ma}
                    </Th>
                  ))}
                </tr>
              </THead>
              <tbody>
                {nccLoc.map((n) => (
                  <Tr key={n.id}>
                    <Td className="font-medium text-slate-900">{n.ten}</Td>
                    <Td className="hidden text-slate-500 sm:table-cell">
                      {labelOf(SUPPLIER_CATEGORY_MAP, n.nhom)}
                    </Td>
                    {khuVucs.map((k) => {
                      const co = n.khuVucIds.includes(k.id);
                      return (
                        <Td key={k.id} className="text-center">
                          <input
                            type="checkbox"
                            checked={co}
                            disabled={!canEdit || dangLuu === n.id}
                            onChange={(e) => doiKhuVuc(n, k.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 disabled:opacity-40"
                            aria-label={`${n.ten} phục vụ ${k.ten}`}
                          />
                        </Td>
                      );
                    })}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {nccLoc.length === 0 && (
            <p className="text-sm text-slate-400">Không có nhà cung cấp nào khớp.</p>
          )}
        </section>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa khu vực" : "Thêm khu vực"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Mã *">
              <Input
                name="ma"
                defaultValue={editing?.ma ?? ""}
                placeholder="MB"
                required
              />
            </Field>
            <Field label="Tên khu vực *" className="sm:col-span-2">
              <Input
                name="ten"
                defaultValue={editing?.ten ?? ""}
                placeholder="Miền Bắc"
                required
              />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Input
              name="ghiChu"
              defaultValue={editing?.ghiChu ?? ""}
              placeholder="Hà Nội và các tỉnh lân cận"
            />
          </Field>
          <p className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            Khai ít vùng thôi — vùng chỉ có nghĩa khi nó thật sự đổi giá. Chia theo 63
            tỉnh là tự tạo ra hàng nghìn dòng đơn giá phải duy trì.
          </p>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
