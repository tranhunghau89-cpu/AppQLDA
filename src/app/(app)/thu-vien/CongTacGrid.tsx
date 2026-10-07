"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, History, Download, Upload, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import {
  ESTIMATE_GROUP,
  ESTIMATE_GROUP_MAP,
  WORK_GROUP,
  WORK_GROUP_MAP,
  labelOf,
  nhomChiPhiTheoNhomMa,
  workGroupOf,
} from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import { computeBaseCost } from "@/lib/quote";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { quyCachBoSung } from "@/lib/text";
import { luuCongTac, xoaCongTac } from "./actions";
import { capNhatBangGia } from "./bangGiaActions";
import { docSoVN as docSo } from "@/lib/thuVien/bangGia";
import { NhapExcelBangGia, homNay } from "./NhapExcelBangGia";


export interface CongTacView {
  id: string;
  ma: string;
  ten: string;
  tenNgan: string | null;
  quyCach: string | null;
  donVi: string | null;
  nhomMa: string;
  nhomChiPhi: string;
  heSo: number | null;
  ghiChu: string | null;
  /** Đơn giá đang áp dụng hôm nay; null = chưa khai bản giá nào. */
  donGiaHienHanh: number | null;
  hieuLucTu: string | null;
  soBanGia: number;
}

export function CongTacGrid({
  items,
  canEdit,
}: {
  items: CongTacView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CongTacView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Xem trước đơn giá ban đầu — chỉ có nghĩa khi TẠO MỚI.
  const [ma, setMa] = useState("");
  const [vt, setVt] = useState(0);
  const [ncm, setNcm] = useState(0);
  const [hs, setHs] = useState(1);

  const toast = useToast();
  const confirm = useConfirm();

  // Sửa cả bảng: mỗi ô đơn giá thành ô nhập, bấm "Cập nhật" ghi một phiên bản giá
  // chung một ngày hiệu lực cho mọi mã đã đổi.
  const [suaBang, setSuaBang] = useState(false);
  const [giaNhap, setGiaNhap] = useState<Record<string, string>>({});
  const [ngayBang, setNgayBang] = useState(homNay);
  const [ghiChuBang, setGhiChuBang] = useState("");
  const [moExcel, setMoExcel] = useState(false);

  const daDoi = useMemo(
    () =>
      items.filter((it) => {
        const v = giaNhap[it.id];
        if (v === undefined) return false;
        const n = docSo(v);
        return n !== null && (Number.isNaN(n) || it.donGiaHienHanh === null || Math.abs(n - it.donGiaHienHanh) >= 0.5);
      }),
    [items, giaNhap]
  );

  function batSuaBang() {
    setGiaNhap({});
    setNgayBang(homNay());
    setGhiChuBang("");
    setSuaBang(true);
  }

  async function luuBang() {
    if (daDoi.some((it) => Number.isNaN(docSo(giaNhap[it.id]))))
      return toast.error("Có ô đơn giá không phải số.");
    if (!(await confirm(`Tạo phiên bản giá mới hiệu lực từ ${formatDate(ngayBang)} cho ${daDoi.length} mã?`)))
      return;
    setPending(true);
    const res = await capNhatBangGia({
      dong: daDoi.map((it) => ({ ma: it.ma, vatTu: null, nhanCongMay: null, heSo: null, donGia: docSo(giaNhap[it.id]) })),
      hieuLucTu: ngayBang,
      ghiChu: ghiChuBang,
      nguon: "NHAP_TAY",
    });
    setPending(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Đã cập nhật giá cho ${res.soMa} mã.`);
    setSuaBang(false);
    router.refresh();
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        it.ma.toLowerCase().includes(s) ||
        it.ten.toLowerCase().includes(s) ||
        (it.tenNgan ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  const groups = useMemo(() => {
    const theoNhom = new Map<string, CongTacView[]>();
    for (const it of filtered) {
      const g = it.nhomMa in WORK_GROUP_MAP ? it.nhomMa : "AL";
      const ds = theoNhom.get(g);
      if (ds) ds.push(it);
      else theoNhom.set(g, [it]);
    }
    return WORK_GROUP.map((g) => ({ ...g, rows: theoNhom.get(g.value) ?? [] })).filter(
      (g) => g.rows.length > 0
    );
  }, [filtered]);

  function moThem() {
    setEditing(null);
    setMa("");
    setVt(0);
    setNcm(0);
    setHs(1);
    setError(null);
    setOpen(true);
  }

  function moSua(it: CongTacView) {
    setEditing(it);
    setMa(it.ma);
    setVt(0);
    setNcm(0);
    setHs(it.heSo ?? 1);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await luuCongTac(editing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  async function onXoa(it: CongTacView) {
    const canhBao =
      it.soBanGia > 0
        ? ` Toàn bộ ${it.soBanGia} bản giá trong lịch sử cũng mất theo.`
        : "";
    if (!(await confirm(`Xóa công tác "${it.ma} — ${it.ten}"?${canhBao}`))) return;
    start(async () => {
      const res = await xoaCongTac(it.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  const xemTruoc = computeBaseCost(vt, ncm, hs);
  const nhomMaSuyRa = workGroupOf(ma);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm mã / tên công tác…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/thu-vien/bang-gia"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Tải Excel
          </a>
          {canEdit && !suaBang && (
            <>
              <Button size="sm" variant="outline" onClick={() => setMoExcel(true)}>
                <Upload className="h-4 w-4" /> Nhập Excel
              </Button>
              <Button size="sm" variant="outline" onClick={batSuaBang}>
                <Table2 className="h-4 w-4" /> Sửa cả bảng giá
              </Button>
              <Button size="sm" onClick={moThem}>
                <Plus className="h-4 w-4" /> Thêm công tác
              </Button>
            </>
          )}
        </div>
      </div>

      {suaBang && (
        <div className="sticky top-0 z-20 flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="text-sm text-amber-800">
            <b>Đang sửa cả bảng giá</b> — gõ đơn giá mới vào cột Đơn giá.
            <br />
            <span className="text-xs">Mã đã đổi: <b>{daDoi.length}</b>. Giá cũ vẫn giữ trong lịch sử.</span>
          </div>
          <label className="text-xs text-slate-600">
            Hiệu lực từ
            <Input type="date" className="mt-1 w-40" value={ngayBang} onChange={(e) => setNgayBang(e.target.value)} />
          </label>
          <label className="flex-1 text-xs text-slate-600">
            Ghi chú phiên bản
            <Input className="mt-1" placeholder="VD: Giá tháng 10/2026" value={ghiChuBang} onChange={(e) => setGhiChuBang(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSuaBang(false)}>
              Hủy
            </Button>
            <Button size="sm" onClick={luuBang} disabled={pending || daDoi.length === 0}>
              Cập nhật {daDoi.length} mã
            </Button>
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Không có công tác nào khớp
        </div>
      )}

      {groups.map((g) => (
        <div key={g.value} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
            <span>
              <span className="font-mono text-slate-400">{g.value}</span> · {g.label}
            </span>
            <span className="text-xs text-slate-400">{g.rows.length} công tác</span>
          </div>
          {/* Độ rộng cố định: mọi nhóm là bảng riêng, phải cùng khuôn cột mới thẳng hàng. */}
          <Table className="table-fixed">
            <THead>
              <tr>
                <Th className="w-24">Mã</Th>
                <Th>Nội dung</Th>
                <Th className="hidden w-20 sm:table-cell">ĐVT</Th>
                <Th className="hidden w-40 lg:table-cell">Nhóm chi phí</Th>
                <Th className="w-40 text-right">Đơn giá hiện hành</Th>
                <Th className="hidden w-32 md:table-cell">Hiệu lực từ</Th>
                <Th className="w-28"></Th>
              </tr>
            </THead>
            <tbody>
              {g.rows.map((it) => (
                <Tr key={it.id}>
                  <Td className="font-mono text-slate-700">{it.ma}</Td>
                  <Td className="font-medium text-slate-900">
                    {it.ten}
                    {quyCachBoSung(it.ten, it.quyCach) ? (
                      <span className="text-slate-400"> · {quyCachBoSung(it.ten, it.quyCach)}</span>
                    ) : null}
                  </Td>
                  <Td className="hidden text-slate-600 sm:table-cell">
                    {it.donVi ?? "—"}
                  </Td>
                  <Td className="hidden text-slate-600 lg:table-cell">
                    {labelOf(ESTIMATE_GROUP_MAP, it.nhomChiPhi)}
                  </Td>
                  <Td className="text-right font-medium text-blue-700">
                    {suaBang ? (
                      <input
                        inputMode="decimal"
                        className={`w-full rounded border px-2 py-1 text-right tabular-nums outline-none focus:ring-2 focus:ring-blue-400 ${
                          daDoi.includes(it) ? "border-amber-400 bg-amber-50" : "border-slate-200"
                        }`}
                        placeholder="Chưa có giá"
                        value={giaNhap[it.id] ?? (it.donGiaHienHanh === null ? "" : formatNumber(it.donGiaHienHanh))}
                        onChange={(e) => setGiaNhap((g) => ({ ...g, [it.id]: e.target.value }))}
                      />
                    ) : it.donGiaHienHanh === null ? (
                      <span className="text-amber-600">Chưa có giá</span>
                    ) : (
                      formatNumber(it.donGiaHienHanh)
                    )}
                  </Td>
                  <Td className="hidden text-slate-500 md:table-cell">
                    {formatDate(it.hieuLucTu)}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/thu-vien/cong-tac/${it.id}`}
                        title={`Lịch sử giá (${it.soBanGia} bản)`}
                        // Link mang dáng nút icon — khai cùng dấu hiệu với <Button> để quy tắc
                        // thu gọn nút trong ô bảng (globals.css) nhận ra nó.
                        data-size="icon"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <History className="h-4 w-4" />
                      </Link>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moSua(it)}
                            title="Sửa thông tin công tác"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => onXoa(it)}
                            title="Xóa công tác"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      ))}

      <NhapExcelBangGia open={moExcel} onClose={() => setMoExcel(false)} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa công tác" : "Thêm công tác"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mã công tác *">
              <Input
                name="ma"
                defaultValue={editing?.ma ?? ""}
                placeholder="AA.110"
                required
                onChange={(e) => setMa(e.target.value)}
              />
            </Field>
            <Field label="Đơn vị">
              <Input
                name="donVi"
                defaultValue={editing?.donVi ?? ""}
                placeholder="kg, bộ, m²…"
              />
            </Field>
          </div>
          <Field label="Nội dung công tác *">
            <Input name="ten" defaultValue={editing?.ten ?? ""} required />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Loại (rút gọn)">
              <Input name="tenNgan" defaultValue={editing?.tenNgan ?? ""} />
            </Field>
            <Field label="Thông số kỹ thuật">
              <Input name="quyCach" defaultValue={editing?.quyCach ?? ""} />
            </Field>
          </div>
          <Field label="Nhóm chi phí (khi đổ xuống dự toán thi công)">
            <Select
              name="nhomChiPhi"
              defaultValue={editing?.nhomChiPhi ?? nhomChiPhiTheoNhomMa(nhomMaSuyRa)}
            >
              {ESTIMATE_GROUP.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500">
              Mã &quot;{ma || "—"}&quot; thuộc nhóm {nhomMaSuyRa}; mặc định là{" "}
              {labelOf(ESTIMATE_GROUP_MAP, nhomChiPhiTheoNhomMa(nhomMaSuyRa))}
            </p>
          </Field>

          {editing ? (
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Đơn giá không sửa ở đây. Đổi giá là{" "}
              <Link
                href={`/thu-vien/cong-tac/${editing.id}`}
                className="font-medium text-blue-700 underline"
              >
                thêm một bản giá mới
              </Link>{" "}
              có ngày hiệu lực, để giá cũ còn tra lại được.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Vật tư (VT)">
                  <Input
                    name="giaVatTu"
                    type="number"
                    step="any"
                    onChange={(e) => setVt(Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="NC + Máy">
                  <Input
                    name="giaNhanCongMay"
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
                    defaultValue={1}
                    onChange={(e) => setHs(Number(e.target.value) || 0)}
                  />
                </Field>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Bản giá đầu tiên = (VT + NC) × HS ={" "}
                <span className="font-semibold text-blue-700">
                  {formatNumber(xemTruoc)}
                </span>
                , hiệu lực từ hôm nay. Bỏ trống nếu chưa có giá.
              </div>
            </>
          )}

          {editing && (
            <Field label="Hệ số mặc định (gợi ý khi nhập bản giá mới)">
              <Input
                name="heSo"
                type="number"
                step="any"
                defaultValue={editing.heSo ?? 1}
              />
            </Field>
          )}

          <Field label="Ghi chú">
            <Input name="ghiChu" defaultValue={editing?.ghiChu ?? ""} />
          </Field>

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
