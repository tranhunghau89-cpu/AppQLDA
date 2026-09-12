"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import {
  ESTIMATE_GROUP,
  QUOTE_SPEC_GROUP,
  QUOTE_SPEC_GROUP_MAP,
  VAT_TU_TAG,
  VAT_TU_TAG_MAP,
  labelOf,
} from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { luuGiaMuaVatTu, luuVatTu, xoaGiaMuaVatTu, xoaVatTu } from "./actions";

export interface GiaMuaView {
  id: string;
  supplierId: string;
  nhaCungCap: string;
  khuVuc: string | null;
  donGia: number;
  donVi: string | null;
  hieuLucTu: string;
  ghiChu: string | null;
  laGiaTotNhat: boolean;
}

export interface VatTuView {
  id: string;
  ma: string;
  ten: string;
  quyCach: string | null;
  hang: string | null;
  xuatXu: string | null;
  donVi: string | null;
  nhomTSKT: string;
  tag: string | null;
  inTrongMoTa: boolean;
  nhomChiPhi: string;
  ghiChu: string | null;
  soBienThe: number;
  giaTotNhat: { donGia: number; nhaCungCap: string } | null;
  giaMua: GiaMuaView[];
}

export interface ChonLua {
  nhaCungCaps: { id: string; ten: string }[];
  khuVucs: { id: string; ma: string; ten: string }[];
}

function homNay(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function VatTuGrid({
  items,
  chonLua,
  canEdit,
}: {
  items: VatTuView[];
  chonLua: ChonLua;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [moRong, setMoRong] = useState<Set<string>>(new Set());

  const [openVT, setOpenVT] = useState(false);
  const [editing, setEditing] = useState<VatTuView | null>(null);
  const [openGia, setOpenGia] = useState<VatTuView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (v) =>
        v.ma.toLowerCase().includes(s) ||
        v.ten.toLowerCase().includes(s) ||
        (v.hang ?? "").toLowerCase().includes(s) ||
        (v.quyCach ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  const nhom = useMemo(() => {
    const theoNhom = new Map<string, VatTuView[]>();
    for (const v of filtered) {
      const g = v.nhomTSKT in QUOTE_SPEC_GROUP_MAP ? v.nhomTSKT : "A";
      const ds = theoNhom.get(g);
      if (ds) ds.push(v);
      else theoNhom.set(g, [v]);
    }
    return QUOTE_SPEC_GROUP.map((g) => ({
      ...g,
      rows: theoNhom.get(g.value) ?? [],
    })).filter((g) => g.rows.length > 0);
  }, [filtered]);

  function gapMo(id: string) {
    setMoRong((cu) => {
      const sau = new Set(cu);
      if (sau.has(id)) sau.delete(id);
      else sau.add(id);
      return sau;
    });
  }

  function onLuuVatTu(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await luuVatTu(editing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpenVT(false);
        router.refresh();
      }
    });
  }

  function onLuuGia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openGia) return;
    const form = new FormData(e.currentTarget);
    const vtId = openGia.id;
    setError(null);
    setPending(true);
    start(async () => {
      const res = await luuGiaMuaVatTu(vtId, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpenGia(null);
        setMoRong((cu) => new Set(cu).add(vtId));
        router.refresh();
      }
    });
  }

  async function onXoaVatTu(v: VatTuView) {
    if (!(await confirm(`Xóa vật tư "${v.ma} — ${v.ten}"?`))) return;
    start(async () => {
      const res = await xoaVatTu(v.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  async function onXoaGia(g: GiaMuaView) {
    if (!(await confirm(`Xóa giá mua của ${g.nhaCungCap} hiệu lực ${formatDate(g.hieuLucTu)}?`)))
      return;
    start(async () => {
      const res = await xoaGiaMuaVatTu(g.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm mã / tên / hãng / quy cách…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setError(null);
              setOpenVT(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm vật tư
          </Button>
        )}
      </div>

      {nhom.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {items.length === 0
            ? "Chưa khai vật tư nào."
            : "Không có vật tư nào khớp."}
        </div>
      )}

      {nhom.map((g) => (
        <div key={g.value} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
            <span>
              <span className="font-mono text-slate-400">{g.value}</span> · {g.label}
            </span>
            <span className="text-xs text-slate-400">{g.rows.length} vật tư</span>
          </div>
          <Table>
            <THead>
              <tr>
                <Th className="w-8"></Th>
                <Th>Mã</Th>
                <Th>Tên &amp; quy cách</Th>
                <Th className="hidden md:table-cell">Hãng</Th>
                <Th className="hidden lg:table-cell">Nhãn</Th>
                <Th className="text-right">Giá mua tốt nhất</Th>
                <Th className="hidden sm:table-cell text-right">Biến thể</Th>
                {canEdit && <Th></Th>}
              </tr>
            </THead>
            <tbody>
              {g.rows.map((v) => (
                // Fragment phải mang key: mỗi vật tư sinh ra HAI hàng (dòng chính và
                // hàng giá mua bung ra), nên key không đặt được trên từng hàng con.
                <Fragment key={v.id}>
                  <Tr>
                    <Td>
                      <button
                        type="button"
                        onClick={() => gapMo(v.id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100"
                        aria-label={moRong.has(v.id) ? "Thu gọn" : "Xem giá mua"}
                      >
                        {moRong.has(v.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </Td>
                    <Td className="font-mono text-slate-700">{v.ma}</Td>
                    <Td className="font-medium text-slate-900">
                      {v.ten}
                      {v.quyCach ? (
                        <span className="text-slate-400"> · {v.quyCach}</span>
                      ) : null}
                    </Td>
                    <Td className="hidden text-slate-600 md:table-cell">
                      {v.hang ?? "—"}
                    </Td>
                    <Td className="hidden text-slate-600 lg:table-cell">
                      {v.tag ? labelOf(VAT_TU_TAG_MAP, v.tag) : "Dùng chung"}
                    </Td>
                    <Td className="text-right font-medium text-blue-700">
                      {v.giaTotNhat ? (
                        formatNumber(v.giaTotNhat.donGia)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td className="hidden text-right text-slate-600 sm:table-cell">
                      {v.soBienThe}
                    </Td>
                    {canEdit && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setError(null);
                              setOpenGia(v);
                            }}
                          >
                            + Giá mua
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(v);
                              setError(null);
                              setOpenVT(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => onXoaVatTu(v)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                  {moRong.has(v.id) && (
                    <Tr>
                      <Td colSpan={canEdit ? 8 : 7} className="bg-slate-50/60 p-0">
                        <GiaMuaBang
                          giaMua={v.giaMua}
                          canEdit={canEdit}
                          onXoa={onXoaGia}
                        />
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </div>
      ))}

      {/* ----- Sửa vật tư ----- */}
      <Modal
        open={openVT}
        onClose={() => setOpenVT(false)}
        title={editing ? "Sửa vật tư" : "Thêm vật tư"}
      >
        <form onSubmit={onLuuVatTu} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Mã *">
              <Input
                name="ma"
                defaultValue={editing?.ma ?? ""}
                placeholder="TON-045-HS"
                required
              />
            </Field>
            <Field label="Tên vật tư *" className="sm:col-span-2">
              <Input
                name="ten"
                defaultValue={editing?.ten ?? ""}
                placeholder="Tôn lợp mái 0,45mm"
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Hãng">
              <Input name="hang" defaultValue={editing?.hang ?? ""} placeholder="Hoa Sen" />
            </Field>
            <Field label="Quy cách (in ra TSKT)" className="sm:col-span-2">
              <Input
                name="quyCach"
                defaultValue={editing?.quyCach ?? ""}
                placeholder="0,45mm · fy = 2.450 kG/cm2"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Xuất xứ">
              <Input name="xuatXu" defaultValue={editing?.xuatXu ?? ""} />
            </Field>
            <Field label="Đơn vị">
              <Input name="donVi" defaultValue={editing?.donVi ?? ""} placeholder="m2, kg…" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Nhóm bảng TSKT">
              <Select name="nhomTSKT" defaultValue={editing?.nhomTSKT ?? "A"}>
                {QUOTE_SPEC_GROUP.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nhãn hạng mục">
              <Select name="tag" defaultValue={editing?.tag ?? ""}>
                <option value="">Dùng chung mọi hạng mục</option>
                {VAT_TU_TAG.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nhóm chi phí">
              <Select name="nhomChiPhi" defaultValue={editing?.nhomChiPhi ?? "KHAC"}>
                {ESTIMATE_GROUP.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="inTrongMoTa"
              defaultChecked={editing?.inTrongMoTa ?? false}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            In vào phần mô tả của dòng báo giá (ngoài bảng TSKT)
          </label>
          <Field label="Ghi chú">
            <Input name="ghiChu" defaultValue={editing?.ghiChu ?? ""} />
          </Field>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenVT(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ----- Thêm giá mua ----- */}
      <Modal
        open={openGia !== null}
        onClose={() => setOpenGia(null)}
        title={openGia ? `Giá mua — ${openGia.ma}` : "Giá mua"}
      >
        <form onSubmit={onLuuGia} className="space-y-3">
          <Field label="Nhà cung cấp *">
            <Select name="supplierId" defaultValue="" required>
              <option value="">— Chọn nhà cung cấp —</option>
              {chonLua.nhaCungCaps.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.ten}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Khu vực áp dụng">
              <Select name="khuVucId" defaultValue="">
                <option value="">Mọi khu vực</option>
                {chonLua.khuVucs.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ma} — {k.ten}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hiệu lực từ ngày *">
              <Input name="hieuLucTu" type="date" defaultValue={homNay()} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Đơn giá mua *">
              <Input name="donGia" type="number" step="any" required />
            </Field>
            <Field label="Đơn vị">
              <Input name="donVi" defaultValue={openGia?.donVi ?? ""} />
            </Field>
          </div>
          <Field label="Ghi chú (số báo giá của NCC…)">
            <Input name="ghiChu" />
          </Field>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Giá mua KHÔNG tự đổi đơn giá bán của công tác. Nó phục vụ mua hàng và kiểm
            soát chi phí; đơn giá bán vẫn do người lập dự toán chốt.
          </p>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenGia(null)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu giá mua"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function GiaMuaBang({
  giaMua,
  canEdit,
  onXoa,
}: {
  giaMua: GiaMuaView[];
  canEdit: boolean;
  onXoa: (g: GiaMuaView) => void;
}) {
  if (giaMua.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-slate-400">
        Chưa có giá mua nào cho vật tư này.
      </div>
    );
  }
  return (
    <div className="px-6 py-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-1 pr-3 font-medium">Nhà cung cấp</th>
            <th className="py-1 pr-3 font-medium">Khu vực</th>
            <th className="py-1 pr-3 font-medium">Hiệu lực từ</th>
            <th className="py-1 pr-3 text-right font-medium">Đơn giá</th>
            <th className="py-1 pr-3 font-medium">Ghi chú</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {giaMua.map((g) => (
            <tr key={g.id} className="border-t border-slate-200/70">
              <td className="py-1.5 pr-3 text-slate-800">
                {g.nhaCungCap}
                {g.laGiaTotNhat && (
                  <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                    Tốt nhất
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-slate-500">{g.khuVuc ?? "Mọi vùng"}</td>
              <td className="py-1.5 pr-3 text-slate-500">{formatDate(g.hieuLucTu)}</td>
              <td className="py-1.5 pr-3 text-right font-medium text-slate-800">
                {formatNumber(g.donGia)}
                {g.donVi ? (
                  <span className="text-slate-400"> /{g.donVi}</span>
                ) : null}
              </td>
              <td className="py-1.5 pr-3 text-slate-500">{g.ghiChu ?? "—"}</td>
              {canEdit && (
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onXoa(g)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="Xóa dòng giá mua"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
