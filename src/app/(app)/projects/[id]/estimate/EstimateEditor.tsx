"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Pencil, Table2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, Tr, Td } from "@/components/ui/table";
import { ESTIMATE_GROUP, ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { formatVND, formatNumber, formatQty } from "@/lib/utils";
import { chiSoNhom } from "@/lib/nhomDong";
import { OSoSua } from "@/components/ui/OSoSua";
import { OChonCongTac, type CongTacChon } from "@/components/ui/OChonCongTac";
import {
  computeActualAmount,
  computeActualCost,
  computeAmount,
  computeProfit,
} from "@/lib/profit";
import { BangGiaiDoan } from "@/components/BangGiaiDoan";
import type { GiaTriGiaiDoan } from "@/lib/giaTriGiaiDoan";
import {
  saveEstimateItem,
  deleteEstimateItem,
  deleteEstimateSection,
  suaOEstimate,
  suaCongViecEstimate,
} from "./actions";
import { ApplyTemplate, type TemplateForClient } from "./ApplyTemplate";
import { BangBocModal } from "./BangBocModal";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { updateSalePrice } from "../../actions";

export interface EstimateRow {
  id: string;
  sectionId: string | null;
  groupLabel: string | null;
  groupCode: string;
  name: string;
  unit: string | null;
  designQty: number | null;
  actualQty: number | null;
  unitPrice: number | null;
  actualUnitPrice: number | null;
  amount: number | null;
  supplierId: string | null;
  supplierName: string | null;
  orderStatus: string | null;
  dispatchStatus: string | null;
  note: string | null;
  sortOrder: number;
  /** Số dòng bảng bóc chi tiết đang gắn. >0 nghĩa là KL thiết kế do bảng quyết định. */
  soChiTiet: number;
  /** Công tác thư viện đang gắn; null = dòng nhập từ Excel hoặc gõ tay. */
  congTacId: string | null;
  /** Mã CV (mã định mức) của công tác đang gắn. */
  maCV: string | null;
}

export interface SectionInfo {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
}

export interface SupplierOpt {
  id: string;
  name: string;
}

const UNSECTIONED = "__none__";

const phanTram = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
// Ô số đọc kiểu Việt (dấu chấm = hàng nghìn) — điền sẵn phải dùng dấu phẩy thập phân,
// không thì 75922.52 bị đọc thành 7.592.252.
const soVN = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

export function EstimateEditor({
  projectId,
  items,
  sections,
  templates,
  suppliers,
  trongKhuVuc,
  khuVucTen,
  salePrice,
  giaBanTheoHD,
  giaiDoan,
  area,
  canEdit,
  catalog,
}: {
  projectId: string;
  items: EstimateRow[];
  sections: SectionInfo[];
  templates: TemplateForClient[];
  suppliers: SupplierOpt[];
  /** Id nhà cung cấp phục vụ khu vực của dự án, đã xếp theo ưu tiên. */
  trongKhuVuc: string[];
  khuVucTen: string | null;
  salePrice: number | null;
  /** Có HĐ ký: giá bán khoá theo HĐ, ghi các số HĐ để hiện nguồn. Null = sửa tay được. */
  giaBanTheoHD: string[] | null;
  giaiDoan: GiaTriGiaiDoan | null;
  area: number | null;
  canEdit: boolean;
  /** Công tác thư viện — cho ô chọn công việc ngay trên bảng. */
  catalog: CongTacChon[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateRow | null>(null);
  // Hạng mục + nhóm điền sẵn khi bấm "Thêm dòng vào …"; "" = chưa phân hạng mục.
  const [dich, setDich] = useState<{ sectionId: string; groupLabel: string }>({
    sectionId: "",
    groupLabel: "",
  });
  const [thuGon, setThuGon] = useState<Set<string>>(new Set());
  const doiThuGon = (k: string) =>
    setThuGon((cu) => {
      const moi = new Set(cu);
      if (moi.has(k)) moi.delete(k);
      else moi.add(k);
      return moi;
    });
  const [bangBoc, setBangBoc] = useState<EstimateRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  const summary = useMemo(
    () => computeProfit(items, salePrice, area),
    [items, salePrice, area]
  );

  // Tách nhà cung cấp theo khu vực dự án, giữ đúng thứ tự ưu tiên đã tính ở máy chủ.
  // Nhóm "khác" vẫn hiện đầy đủ — mua ngoài vùng là chuyện có thật, chỉ là không phải
  // lựa chọn mặc định.
  const [nccTrongVung, nccNgoaiVung] = useMemo(() => {
    if (trongKhuVuc.length === 0) return [[], suppliers] as const;
    const theoId = new Map(suppliers.map((s) => [s.id, s]));
    const trong = trongKhuVuc
      .map((id) => theoId.get(id))
      .filter((s): s is SupplierOpt => !!s);
    const daCo = new Set(trong.map((s) => s.id));
    return [trong, suppliers.filter((s) => !daCo.has(s.id))] as const;
  }, [suppliers, trongKhuVuc]);

  // Gom: Hạng mục (Section) → Nhóm (groupLabel, fallback nhãn groupCode).
  const sectionBlocks = useMemo(() => {
    const bySection = new Map<string, EstimateRow[]>();
    for (const it of items) {
      const key = it.sectionId ?? UNSECTIONED;
      const arr = bySection.get(key) ?? [];
      arr.push(it);
      bySection.set(key, arr);
    }

    const groupRows = (rows: EstimateRow[]) => {
      const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
      const order: string[] = [];
      const map = new Map<string, EstimateRow[]>();
      for (const r of sorted) {
        const label = r.groupLabel ?? ESTIMATE_GROUP_MAP[r.groupCode]?.label ?? r.groupCode;
        if (!map.has(label)) {
          map.set(label, []);
          order.push(label);
        }
        map.get(label)!.push(r);
      }
      return order.map((label) => ({ label, rows: map.get(label)! }));
    };

    const blocks: {
      id: string | null;
      name: string;
      code: string | null;
      rows: EstimateRow[];
      groups: { label: string; rows: EstimateRow[] }[];
    }[] = [];

    for (const s of [...sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const rows = bySection.get(s.id);
      if (rows) blocks.push({ id: s.id, name: s.name, code: s.code, rows, groups: groupRows(rows) });
    }
    const none = bySection.get(UNSECTIONED);
    if (none) blocks.push({ id: null, name: "Chưa phân hạng mục", code: null, rows: none, groups: groupRows(none) });
    return blocks;
  }, [items, sections]);

  const tongDuToan = summary.totalCost;
  const dsSection = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  /** Mở form thêm dòng; không chỉ định thì vào hạng mục cuối cùng (chứ không "Chưa phân"). */
  function openNew(sectionId?: string | null, groupLabel?: string) {
    setEditing(null);
    setDich({
      sectionId: sectionId === undefined ? (dsSection.at(-1)?.id ?? "") : (sectionId ?? ""),
      groupLabel: groupLabel ?? "",
    });
    setError(null);
    setOpen(true);
  }
  function openEdit(it: EstimateRow) {
    setEditing(it);
    setDich({ sectionId: it.sectionId ?? "", groupLabel: it.groupLabel ?? "" });
    setError(null);
    setOpen(true);
  }
  // Nhóm đã có trong hạng mục đang chọn — gợi ý cho ô Nhóm của form.
  const nhomCoSan = [
    ...new Set(
      items
        .filter((it) => (it.sectionId ?? "") === dich.sectionId)
        .map((it) => it.groupLabel ?? ESTIMATE_GROUP_MAP[it.groupCode]?.label ?? it.groupCode),
    ),
  ];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveEstimateItem(projectId, editing?.id ?? null, form);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  async function onDelete(it: EstimateRow) {
    if (!(await confirm(`Xóa "${it.name}"?`))) return;
    start(async () => {
      const res = await deleteEstimateItem(projectId, it.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  async function onDeleteSection(id: string, name: string) {
    if (!(await confirm(`Xóa cả hạng mục "${name}" và mọi dòng bên trong?`))) return;
    start(async () => {
      const res = await deleteEstimateSection(projectId, id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,80rem)_minmax(22rem,1fr)]">
      {/* Bảng dự toán */}
      <div className="space-y-4 xl:col-span-3 2xl:col-span-1 2xl:col-start-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Bảng dự toán</h2>
          {canEdit && (
            <div className="flex gap-2">
              <ApplyTemplate projectId={projectId} templates={templates} />
              <Button size="sm" onClick={() => openNew()}>
                <Plus className="h-4 w-4" /> Thêm dòng
              </Button>
            </div>
          )}
        </div>

        {sectionBlocks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            Chưa có dòng dự toán nào. Bấm <b>Thêm hạng mục từ mẫu</b> để bắt đầu nhanh.
          </div>
        )}

        {sectionBlocks.map((block) => {
          const sectionTotal = block.rows.reduce((s, r) => s + computeAmount(r), 0);
          const khoa = block.id ?? UNSECTIONED;
          const gon = thuGon.has(khoa);
          const tyLeTong = chiSoNhom(sectionTotal, tongDuToan, area).tyLe;
          const m2 = chiSoNhom(sectionTotal, 0, area).moiM2;
          return (
            <div key={khoa} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 bg-slate-800 px-4 py-2.5 text-white">
                <button
                  type="button"
                  onClick={() => doiThuGon(khoa)}
                  aria-expanded={!gon}
                  title={gon ? "Mở hạng mục" : "Thu gọn hạng mục"}
                  className="flex min-w-0 items-center gap-1.5 text-left font-semibold"
                >
                  {gon ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  {block.code ? <span className="mr-1 rounded bg-white/20 px-1.5 py-0.5 text-xs">{block.code}</span> : null}
                  <span className="truncate">{block.name}</span>
                  <span
                    className="ml-2 shrink-0 text-xs font-normal text-white/60"
                    title="Thành tiền hạng mục ÷ tổng dự toán"
                  >
                    {phanTram(tyLeTong)} tổng
                    {m2 != null && ` · ${formatNumber(Math.round(m2))}/m²`}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold">{formatVND(sectionTotal)}</span>
                  {canEdit && (
                    <button
                      className="text-white/70 hover:text-white"
                      title={`Thêm dòng vào ${block.name}`}
                      aria-label={`Thêm dòng vào ${block.name}`}
                      onClick={() => openNew(block.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                  {canEdit && block.id && (
                    <button
                      className="text-white/70 hover:text-red-300"
                      title="Xóa cả hạng mục" aria-label="Xóa cả hạng mục"
                      onClick={() => onDeleteSection(block.id!, block.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Một bảng cho cả hạng mục, cột cố định độ rộng để các nhóm thẳng hàng nhau. */}
              {!gon && (
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-20" />
                  <col />
                  <col className="w-14" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-32" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-32" />
                  {canEdit && <col className="w-28" />}
                </colgroup>
                <thead className="bg-white text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th rowSpan={2} className="px-2 py-1 text-left align-bottom" title="Mã định mức (Mã CV) của công tác thư viện; dòng gõ tay hiện số thứ tự">
                      Mã CV
                    </th>
                    <th rowSpan={2} className="px-3 py-1 text-left align-bottom">Công việc</th>
                    <th rowSpan={2} className="px-3 py-1 text-left align-bottom">ĐVT</th>
                    <th colSpan={3} className="border-b border-slate-200 px-3 pt-2 pb-1 text-center text-slate-600">
                      Dự toán
                    </th>
                    <th colSpan={3} className="border-b border-l border-slate-200 bg-amber-50/60 px-3 pt-2 pb-1 text-center text-amber-700">
                      Thực tế (mua hàng)
                    </th>
                    {canEdit && <th rowSpan={2} />}
                  </tr>
                  <tr>
                    <th className="px-3 py-1 text-right">KL</th>
                    <th className="px-3 py-1 text-right">Đơn giá</th>
                    <th className="px-3 py-1 text-right">Thành tiền</th>
                    <th className="border-l border-slate-200 bg-amber-50/60 px-3 py-1 text-right">KL</th>
                    <th className="bg-amber-50/60 px-3 py-1 text-right">Đơn giá</th>
                    <th className="bg-amber-50/60 px-3 py-1 text-right">Thành tiền</th>
                  </tr>
                </thead>
              {block.groups.map((grp, gi) => {
                const subtotal = grp.rows.reduce((s, r) => s + computeAmount(r), 0);
                const thucNhom = computeActualCost(grp.rows);
                const csNhom = chiSoNhom(subtotal, sectionTotal, area);
                const tyLeNhomTong = chiSoNhom(subtotal, tongDuToan, null).tyLe;
                return (
                  <Fragment key={grp.label}>
                  <tbody>
                    <tr className="border-y border-slate-100 bg-slate-50">
                      <td className="px-2 py-1.5 text-sm font-semibold text-slate-700">{gi + 1}</td>
                      <td colSpan={3} className="px-4 py-1.5 text-sm font-semibold text-slate-700">
                        {grp.label}
                        <span
                          className="ml-2 text-xs font-medium text-slate-500"
                          title="Thành tiền của nhóm ÷ thành tiền của hạng mục"
                        >
                          {phanTram(csNhom.tyLe)} hạng mục
                        </span>
                        <span
                          className="ml-1 text-xs font-medium text-slate-400"
                          title="Thành tiền của nhóm ÷ tổng dự toán"
                        >
                          · {phanTram(tyLeNhomTong)} tổng
                        </span>
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-xs text-slate-500"
                        title="Thành tiền của nhóm ÷ diện tích dự án"
                      >
                        {csNhom.moiM2 != null ? `${formatNumber(Math.round(csNhom.moiM2))}/m²` : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs font-medium text-slate-500">
                        {formatVND(subtotal)}
                      </td>
                      <td colSpan={2} className="border-l border-slate-100" />
                      <td
                        className="px-3 py-1.5 text-right text-xs font-medium text-amber-700"
                        title={
                          thucNhom.soDongCoGia < thucNhom.soDong
                            ? `${thucNhom.soDongCoGia}/${thucNhom.soDong} dòng có giá thực — dòng còn lại tạm theo dự toán`
                            : undefined
                        }
                      >
                        {thucNhom.soDongCoGia === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <>
                            {formatVND(thucNhom.total)}
                            {thucNhom.soDongCoGia < thucNhom.soDong && (
                              <span className="ml-1 font-normal text-slate-400">*</span>
                            )}
                          </>
                        )}
                      </td>
                      {canEdit && <td />}
                    </tr>
                        {grp.rows.map((r, ri) => (
                          <Tr key={r.id}>
                            <Td className="px-2 font-mono text-xs">
                              {r.maCV ? (
                                <span className="text-slate-600">{r.maCV}</span>
                              ) : (
                                <span className="text-slate-300">
                                  {gi + 1}.{ri + 1}
                                </span>
                              )}
                            </Td>
                            <Td className="pl-6 text-slate-800 break-words">
                              {canEdit ? (
                                <>
                                  {/* Gõ để đổi tên, hoặc chọn công tác khác của thư viện. */}
                                  <OChonCongTac
                                    ten={r.name}
                                    congTacId={r.congTacId}
                                    catalog={catalog}
                                    luu={(chon) => suaCongViecEstimate(projectId, r.id, chon)}
                                  />
                                  {r.note ? (
                                    <div className="px-1.5 text-xs text-slate-400">{r.note}</div>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  {r.name}
                                  {r.note ? <span className="text-slate-400"> · {r.note}</span> : null}
                                </>
                              )}
                            </Td>
                            <Td className="text-slate-400">{r.unit ?? ""}</Td>
                            <Td className="text-right">
                              {canEdit ? (
                                // Sửa đúng số đang hiện: KL thực tế nếu đã có, không thì KL thiết
                                // kế. KL thiết kế đã có bảng bóc thì khoá — đổi bảng bóc.
                                <OSoSua
                                  nhan={`Khối lượng — ${r.name}`}
                                  giaTri={r.designQty}
                                  dinhDang={formatQty}
                                  khoa={r.soChiTiet > 0}
                                  dauKhoa="▤"
                                  lyDoKhoa={`Bằng tổng bảng bóc ${r.soChiTiet} dòng — sửa bằng nút bảng bóc`}
                                  luu={(tho) => suaOEstimate(projectId, r.id, "qty", tho)}
                                />
                              ) : (
                                <>
                                  {formatNumber(r.designQty)}
                                  {/* Dấu bảng: khối lượng thiết kế đến từ bảng bóc chi tiết. */}
                                  {r.soChiTiet > 0 && (
                                    <span
                                      className="ml-1 text-slate-400"
                                      title={`Khối lượng thiết kế từ bảng bóc ${r.soChiTiet} dòng`}
                                    >
                                      ▤
                                    </span>
                                  )}
                                </>
                              )}
                            </Td>
                            <Td className="text-right">
                              {canEdit ? (
                                <OSoSua
                                  nhan={`Đơn giá — ${r.name}`}
                                  giaTri={r.unitPrice}
                                  dinhDang={formatNumber}
                                  khoa={false}
                                  luu={(tho) => suaOEstimate(projectId, r.id, "unitPrice", tho)}
                                />
                              ) : (
                                formatNumber(r.unitPrice)
                              )}
                            </Td>
                            <Td className="text-right font-medium">{formatVND(computeAmount(r))}</Td>
                            <Td className="border-l border-slate-100 bg-amber-50/30 text-right">
                              {canEdit ? (
                                <OSoSua
                                  nhan={`KL thực — ${r.name}`}
                                  giaTri={r.actualQty}
                                  dinhDang={formatQty}
                                  khoa={false}
                                  luu={(tho) => suaOEstimate(projectId, r.id, "actualQty", tho)}
                                />
                              ) : (
                                formatNumber(r.actualQty)
                              )}
                            </Td>
                            <Td className="bg-amber-50/30 text-right">
                              {canEdit ? (
                                <OSoSua
                                  nhan={`Đơn giá thực — ${r.name}`}
                                  giaTri={r.actualUnitPrice}
                                  dinhDang={formatNumber}
                                  khoa={false}
                                  luu={(tho) => suaOEstimate(projectId, r.id, "actualUnitPrice", tho)}
                                />
                              ) : (
                                formatNumber(r.actualUnitPrice)
                              )}
                            </Td>
                            <Td className="bg-amber-50/30 text-right font-medium text-amber-800">
                              {computeActualAmount(r) == null ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                formatVND(computeActualAmount(r))
                              )}
                            </Td>
                            {canEdit && (
                              <Td className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Bảng bóc khối lượng chi tiết"
                                    onClick={() => setBangBoc(r)}
                                  >
                                    <Table2 className={`h-4 w-4 ${r.soChiTiet > 0 ? "text-blue-600" : ""}`} />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:bg-red-50"
                                    onClick={() => onDelete(r)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </Td>
                            )}
                          </Tr>
                        ))}
                  </tbody>
                  </Fragment>
                );
              })}
              {canEdit && (
                <tbody>
                  <tr>
                    <td colSpan={10} className="px-3 py-1.5">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => openNew(block.id)}
                      >
                        + Thêm dòng vào {block.code ? `${block.code} · ` : ""}
                        {block.name}
                      </button>
                    </td>
                  </tr>
                </tbody>
              )}
              </Table>
              )}
            </div>
          );
        })}
      </div>

      {/* Tổng hợp chi phí / lợi nhuận */}
      <div className="space-y-4 2xl:max-w-md">
        {giaiDoan && (
          <BangGiaiDoan
            g={giaiDoan}
            chiPhiM2={summary.costPerM2}
            oHopDong={<>
                {canEdit ? (
                  <OSoSua
                    nhan="Giá bán (chưa VAT)"
                    giaTri={salePrice}
                    dinhDang={formatVND}
                    khoa={giaBanTheoHD != null}
                    dauKhoa="HĐ"
                    lyDoKhoa="Giá bán lấy theo hợp đồng đã ký — muốn đổi thì sửa hợp đồng"
                    luu={(tho) => updateSalePrice(projectId, tho)}
                  />
                ) : (
                  formatVND(summary.salePrice)
                )}
                {giaBanTheoHD != null && (
                  <a
                    href={`/projects/${projectId}/contract`}
                    className="block text-xs font-normal text-blue-600 hover:underline"
                  >
                    Theo HĐ {giaBanTheoHD.join(", ")}
                  </a>
                )}
              </>}
          />
        )}

        {summary.groupSubtotals.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Theo nhóm</h3>
            <dl className="space-y-1.5 text-sm">
              {summary.groupSubtotals.map((g) => (
                <div key={g.code} className="flex justify-between">
                  <dt className="text-slate-500">{g.label}</dt>
                  <dd className="text-slate-700">{formatVND(g.amount)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa dòng dự toán" : "Thêm dòng dự toán"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Hạng mục">
              <Select
                name="sectionId"
                value={dich.sectionId}
                onChange={(e) => setDich((d) => ({ ...d, sectionId: e.target.value }))}
              >
                {dsSection.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `${s.code} · ` : ""}
                    {s.name}
                  </option>
                ))}
                <option value="">— Chưa phân hạng mục —</option>
              </Select>
            </Field>
            <Field label="Nhóm trong hạng mục (Bulong neo, Giằng…)">
              <Input
                name="groupLabel"
                list="nhom-trong-hang-muc"
                value={dich.groupLabel}
                onChange={(e) => setDich((d) => ({ ...d, groupLabel: e.target.value }))}
                placeholder="Chọn nhóm có sẵn hoặc gõ nhóm mới"
              />
              <datalist id="nhom-trong-hang-muc">
                {nhomCoSan.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nhóm chi phí *">
              <Select name="groupCode" defaultValue={editing?.groupCode ?? "KCT"}>
                {ESTIMATE_GROUP.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Đơn vị">
              <Input name="unit" defaultValue={editing?.unit ?? ""} placeholder="kg, bộ, m²…" />
            </Field>
          </div>
          <Field label="Tên công việc *">
            <Input name="name" defaultValue={editing?.name ?? ""} required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="KL thiết kế">
              {/*
                Có bảng bóc thì ô này KHOÁ: con số bằng đúng tổng bảng, và máy chủ cũng
                bỏ qua giá trị gửi lên. Cho gõ rồi lặng lẽ không nhận là tệ nhất.
              */}
              <Input
                name="designQty"
                inputMode="decimal"
                placeholder="12,5 hoặc =3*4"
                defaultValue={soVN(editing?.designQty)}
                readOnly={(editing?.soChiTiet ?? 0) > 0}
                className={(editing?.soChiTiet ?? 0) > 0 ? "bg-slate-100 text-slate-500" : undefined}
              />
              {(editing?.soChiTiet ?? 0) > 0 && (
                <p className="text-xs text-slate-500">
                  Bằng tổng bảng bóc ({editing!.soChiTiet} dòng).
                </p>
              )}
            </Field>
            <Field label="KL thực tế">
              <Input name="actualQty" inputMode="decimal" defaultValue={soVN(editing?.actualQty)} />
            </Field>
            <Field label="Đơn giá">
              <Input name="unitPrice" inputMode="decimal" defaultValue={soVN(editing?.unitPrice)} />
            </Field>
          </div>
          <Field label="Thành tiền (để trống = KL × đơn giá)">
            <Input name="amount" inputMode="decimal" defaultValue={soVN(editing?.amount)} />
            <p className="text-xs text-slate-500">
              Các ô số nhận công thức bắt đầu bằng &quot;=&quot;, ví dụ =12*3,5.
            </p>
          </Field>
          <Field label="Nhà cung cấp">
            <Select name="supplierId" defaultValue={editing?.supplierId ?? ""}>
              <option value="">— Không —</option>
              {nccTrongVung.length === 0 ? (
                suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              ) : (
                <>
                  <optgroup label={`Trong khu vực${khuVucTen ? ` ${khuVucTen}` : ""}`}>
                    {nccTrongVung.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Nhà cung cấp khác">
                    {nccNgoaiVung.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Đặt hàng">
              <Input name="orderStatus" defaultValue={editing?.orderStatus ?? ""} />
            </Field>
            <Field label="Xuất hàng">
              <Input name="dispatchStatus" defaultValue={editing?.dispatchStatus ?? ""} />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Textarea name="note" defaultValue={editing?.note ?? ""} />
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

      {bangBoc && (
        <BangBocModal
          projectId={projectId}
          dong={bangBoc}
          soChiTietHienCo={bangBoc.soChiTiet}
          onClose={() => setBangBoc(null)}
        />
      )}
    </div>
  );
}
