"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ListTree,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Pencil,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, Tr, Td } from "@/components/ui/table";
import { ESTIMATE_GROUP, ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { formatVND, formatNumber, formatQty } from "@/lib/utils";
import { chiSoNhom } from "@/lib/nhomDong";
import { OSoSua } from "@/components/ui/OSoSua";
import { coThamChieuMa, idSangMa, maSangId } from "@/lib/khoiLuong/congThucDong";
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
import { MucConModal } from "./MucConModal";
import { DoiChieuThuVien } from "./DoiChieuThuVien";
import type { MauKg } from "@/lib/thuVien/trongLuongBulong";
import { DashboardDuToan, type NhomSoSanh } from "./DashboardDuToan";
import { TongHopKhoiLuong } from "./TongHopKhoiLuong";
import { tongHopKhoiLuong } from "@/lib/tongHopKhoiLuong";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { updateSalePrice } from "../../actions";

export interface MucConRow {
  id: string;
  ten: string;
  donVi: string | null;
  khoiLuong: number | null;
  donGia: number | null;
  kgMotDonVi: number | null;
  ghiChu: string | null;
}

/** Món đơn hàng mua đã gắn vào đầu việc — mục con thực tế chỉ đọc, sửa ở màn đơn hàng. */
export interface DonHangRow {
  id: string;
  orderId: string;
  orderNo: string | null;
  ten: string;
  donVi: string | null;
  khoiLuong: number | null;
  donGia: number | null;
  thanhTien?: number | null;
  /** Trọng lượng ghi trên món (kg). */
  kgTong?: number | null;
  /** Kg một đơn vị tra theo bảng quy đổi khi món tính bộ/cái chưa ghi trọng lượng. */
  kgMotDonVi?: number | null;
}

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
  /** Thành tiền thực cộng từ mục con thực tế (cache). */
  actualAmount: number | null;
  /** Người dùng đã gõ tay ô thực tế → mục con thực tế không cộng lên. */
  thucTeGhiDe: boolean;
  /** Mục con: dự toán và thực tế là hai danh sách riêng, được khác mã nhau. */
  mucConDuToan: MucConRow[];
  mucConThucTe: MucConRow[];
  donHang: DonHangRow[];
  amount: number | null;
  supplierId: string | null;
  supplierName: string | null;
  orderStatus: string | null;
  dispatchStatus: string | null;
  note: string | null;
  sortOrder: number;
  /** Số dòng bảng bóc chi tiết đang gắn. >0 nghĩa là KL thiết kế do bảng quyết định. */
  soChiTiet: number;
  /** Dòng dẫn xuất: KL tự tính từ dòng nguồn mang cùng tham số trong hạng mục. */
  layTuThamSo: string | null;
  napThamSo: string | null;
  heSoQuyDoi: number | null;
  /** KL theo công thức tham chiếu dòng, lưu theo id ("=[@id]+[@id]"). */
  klCongThuc: string | null;
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
const NHOM_MOI = "__moi__";

/** Tiêu đề nhóm của dòng trên bảng: nhãn tự gõ, không có thì tên loại chi phí. */
const nhanNhom = (r: { groupLabel: string | null; groupCode: string }) =>
  r.groupLabel ?? ESTIMATE_GROUP_MAP[r.groupCode]?.label ?? r.groupCode;

const phanTram = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
// Ô số đọc kiểu Việt (dấu chấm = hàng nghìn) — điền sẵn phải dùng dấu phẩy thập phân,
// không thì 75922.52 bị đọc thành 7.592.252.
const TEN_THAM_SO: Record<string, string> = {
  KCT_KG: "kg thép",
  TON_M2: "m² tôn",
  DECK_M2: "m² tôn sàn deck",
  DINH_BO: "bộ đinh chống cắt",
};
const tenThamSo = (p: string | null) => (p ? TEN_THAM_SO[p] ?? p : "");
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
  suaThuVien,
  catalog,
  thuVienKg,
}: {
  /** Được gắn mã công tác cho dòng bộ hạng mục (quyền sửa thư viện). */
  suaThuVien: boolean;
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
  /** Bảng quy đổi bộ → kg của thư viện (bulong, ty xà gồ). */
  thuVienKg: MauKg[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Cột tổng hợp bên phải: màn hình dưới 1920px mặc định thu gọn để bảng dự toán dùng hết
  // chiều ngang — ở 1687px bảng đã ép cột tên xuống ba hàng. Người dùng bật/tắt thì nhớ
  // lựa chọn trong trình duyệt. Đọc sau khi gắn để HTML máy chủ và máy khách khớp nhau.
  const [anCotPhai, setAnCotPhai] = useState(false);
  useEffect(() => {
    let an = window.innerWidth < 1920;
    try {
      const luu = localStorage.getItem("du-toan:cot-phai");
      if (luu === "an") an = true;
      if (luu === "hien") an = false;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc lựa chọn đã lưu sau khi gắn
    setAnCotPhai(an);
  }, []);
  function doiCotPhai() {
    setAnCotPhai((c) => {
      try {
        localStorage.setItem("du-toan:cot-phai", c ? "hien" : "an");
      } catch {}
      return !c;
    });
  }
  const [editing, setEditing] = useState<EstimateRow | null>(null);
  // Hạng mục + nhóm điền sẵn khi bấm "Thêm dòng vào …"; "" = chưa phân hạng mục.
  // Hạng mục, nhóm (tiêu đề trên bảng) và loại chi phí của dòng đang thêm / sửa.
  // nhomMoi = đang gõ một nhóm chưa có trong hạng mục.
  const [dich, setDich] = useState<{
    sectionId: string;
    groupLabel: string;
    groupCode: string;
    nhomMoi: boolean;
  }>({ sectionId: "", groupLabel: "", groupCode: "KCT", nhomMoi: false });
  const [thuGon, setThuGon] = useState<Set<string>>(new Set());
  const doiThuGon = (k: string) =>
    setThuGon((cu) => {
      const moi = new Set(cu);
      if (moi.has(k)) moi.delete(k);
      else moi.add(k);
      return moi;
    });
  const [bangBoc, setBangBoc] = useState<EstimateRow | null>(null);
  const [mucCon, setMucCon] = useState<EstimateRow | null>(null);
  // Đầu việc đang mở mục con ngay trên bảng.
  const [moMucCon, setMoMucCon] = useState<Set<string>>(() => new Set());
  const batMucCon = (id: string) =>
    setMoMucCon((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  const summary = useMemo(
    () => computeProfit(items, salePrice, area),
    [items, salePrice, area]
  );
  // Dự toán và thực tế theo nhóm chi phí, cùng thứ tự với bảng lợi nhuận.
  const soSanhNhom = useMemo<NhomSoSanh[]>(
    () =>
      summary.groupSubtotals.map((g) => {
        const thuc = computeActualCost(items.filter((it) => it.groupCode === g.code));
        return {
          code: g.code,
          label: g.label,
          duToan: g.amount,
          thucTe: thuc.total,
          tamTinh: thuc.soDongCoGia < thuc.soDong,
        };
      }),
    [items, summary]
  );
  // Khối lượng thép tổ hợp, thép hình, xà gồ, tôn — cả dự toán và từng hạng mục.
  const khoiLuongVatTu = useMemo(() => tongHopKhoiLuong(items), [items]);
  const tenHangMuc = (sectionId: string | null) => {
    const s = sections.find((x) => x.id === sectionId);
    return s ? `${s.code ? `${s.code} · ` : ""}${s.name}` : "Chưa phân hạng mục";
  };

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
        const label = nhanNhom(r);
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

  /**
   * Nhóm đang hiện trên bảng của một hạng mục — đúng tiêu đề nhóm người dùng thấy (nhãn
   * tự gõ, hoặc tên loại chi phí khi dòng chưa có nhãn), kèm loại chi phí hay gặp nhất
   * trong nhóm để chọn nhóm là loại chi phí tự theo.
   */
  const nhomCua = (sectionId: string) => {
    const dem = new Map<string, Map<string, number>>();
    for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if ((it.sectionId ?? "") !== sectionId) continue;
      const nhan = nhanNhom(it);
      const m = dem.get(nhan) ?? new Map<string, number>();
      m.set(it.groupCode, (m.get(it.groupCode) ?? 0) + 1);
      dem.set(nhan, m);
    }
    return [...dem].map(([nhan, m]) => ({
      nhan,
      groupCode: [...m].sort((a, b) => b[1] - a[1])[0][0],
    }));
  };
  const nhomCoSan = nhomCua(dich.sectionId);

  /** Chọn hạng mục: nhóm về nhóm cuối của hạng mục đó (dòng mới hay nối tiếp nhóm cuối). */
  function chonHangMuc(sectionId: string, giuNhom?: { nhan: string; groupCode: string }) {
    const ds = nhomCua(sectionId);
    const nhom = giuNhom ?? ds.at(-1);
    setDich({
      sectionId,
      groupLabel: nhom?.nhan ?? "",
      groupCode: nhom?.groupCode ?? "KCT",
      nhomMoi: !nhom,
    });
  }

  /** Mở form thêm dòng; không chỉ định thì vào hạng mục cuối cùng (chứ không "Chưa phân"). */
  function openNew(sectionId?: string | null) {
    setEditing(null);
    chonHangMuc(sectionId === undefined ? (dsSection.at(-1)?.id ?? "") : (sectionId ?? ""));
    setError(null);
    setOpen(true);
  }
  function openEdit(it: EstimateRow) {
    setEditing(it);
    setDich({
      sectionId: it.sectionId ?? "",
      groupLabel: nhanNhom(it),
      groupCode: it.groupCode,
      nhomMoi: false,
    });
    setError(null);
    setOpen(true);
  }

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
    <div
      className={
        anCotPhai
          ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_auto]"
          : "grid grid-cols-1 gap-6 xl:grid-cols-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,80rem)_minmax(22rem,1fr)]"
      }
    >
      {/* Bảng dự toán */}
      <div className={anCotPhai ? "min-w-0 space-y-4" : "space-y-4 xl:col-span-3 2xl:col-span-1 2xl:col-start-2"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Bảng dự toán</h2>
          {canEdit && (
            <div className="flex gap-2">
              <DoiChieuThuVien projectId={projectId} />
              <ApplyTemplate projectId={projectId} templates={templates} catalog={catalog} suaThuVien={suaThuVien} />
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
          // Số thứ tự "nhóm.dòng" ↔ id dòng — để gõ công thức "=[6.1]+[7.1]" trong hạng mục.
          const maToiId = new Map<string, string>();
          const idToiMa = new Map<string, string>();
          block.groups.forEach((g, gi) =>
            g.rows.forEach((r, ri) => {
              maToiId.set(`${gi + 1}.${ri + 1}`, r.id);
              idToiMa.set(r.id, `${gi + 1}.${ri + 1}`);
            })
          );
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
                return (
                  <Fragment key={grp.label}>
                  <tbody>
                    <tr className="border-y border-slate-100 bg-slate-50">
                      <td className="px-2 py-1.5 text-sm font-semibold text-slate-700">{gi + 1}</td>
                      <td colSpan={3} className="px-4 py-1.5 text-sm font-semibold text-slate-700">
                        {grp.label}
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
                        {grp.rows.map((r, ri) => {
                          const soThuc = r.mucConThucTe.length + r.donHang.length;
                          const soCon = r.mucConDuToan.length + soThuc;
                          const coConDuToan = r.mucConDuToan.length > 0;
                          const dangMo = moMucCon.has(r.id);
                          return (
                          <Fragment key={r.id}>
                          <Tr>
                            <Td className="px-2 font-mono text-xs">
                              {r.maCV ? (
                                <span className="text-slate-600">{r.maCV}</span>
                              ) : (
                                <span className="text-slate-300">
                                  {gi + 1}.{ri + 1}
                                </span>
                              )}
                            </Td>
                            <Td className="relative pl-6 text-slate-800 break-words">
                              {soCon > 0 && (
                                <button
                                  type="button"
                                  onClick={() => batMucCon(r.id)}
                                  title={`${dangMo ? "Ẩn" : "Hiện"} ${soCon} mục con`}
                                  className="absolute left-0.5 top-2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  {dangMo ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              )}
                              {canEdit ? (
                                <>
                                  {/* Gõ để đổi tên, hoặc chọn công tác khác của thư viện. */}
                                  <OChonCongTac
                                    ten={r.name}
                                    congTacId={r.congTacId}
                                    catalog={catalog}
                                    luu={(chon) => suaCongViecEstimate(projectId, r.id, chon)}
                                  />
                                  {/* Nguyên tắc: đầu việc lấy từ Thư viện đơn giá — dòng gõ tay
                                      thì nhắc. Dòng hệ thống tự tính (vận chuyển, lắp dựng) miễn. */}
                                  {!r.congTacId && !r.layTuThamSo && (
                                    <div
                                      className="px-1.5 text-[11px] font-medium text-red-600"
                                      title="Bấm vào tên để chọn công tác thư viện, hoặc ghép hàng loạt ở Thư viện đơn giá → Ghép tên dự toán"
                                    >
                                      ⚠ chưa nối thư viện
                                    </div>
                                  )}
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
                                  khoa={r.soChiTiet > 0 || coConDuToan || !!r.layTuThamSo}
                                  dauKhoa={r.soChiTiet > 0 ? "▤" : coConDuToan ? "∑" : "↳"}
                                  lyDoKhoa={
                                    r.soChiTiet > 0
                                      ? `Bằng tổng bảng bóc ${r.soChiTiet} dòng — sửa bằng nút bảng bóc`
                                      : coConDuToan
                                        ? `Tổng ${r.mucConDuToan.length} mục con dự toán — sửa bằng nút mục con`
                                        : `Tự tính = tổng ${tenThamSo(r.layTuThamSo)} của hạng mục — sửa các dòng nguồn`
                                  }
                                  congThuc={r.klCongThuc ? idSangMa(r.klCongThuc, idToiMa) : undefined}
                                  luu={(tho) => {
                                    if (!coThamChieuMa(tho)) return suaOEstimate(projectId, r.id, "qty", tho);
                                    const ct = maSangId(tho, maToiId);
                                    return ct.ok
                                      ? suaOEstimate(projectId, r.id, "qty", ct.congThuc)
                                      : Promise.resolve({ ok: false as const, error: ct.error });
                                  }}
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
                                  khoa={coConDuToan}
                                  dauKhoa="∑"
                                  lyDoKhoa={`Bình quân ${r.mucConDuToan.length} mục con dự toán — sửa bằng nút mục con`}
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
                              {soThuc > 0 && (
                                <div
                                  className="text-[10px] font-normal text-slate-400"
                                  title={
                                    r.thucTeGhiDe
                                      ? "Đang ghi đè bằng số gõ tay — mục con thực tế không cộng lên"
                                      : `Tổng ${r.mucConThucTe.length} mục con thực tế, ${r.donHang.length} món đơn hàng`
                                  }
                                >
                                  {r.thucTeGhiDe ? "ghi đè tay" : `∑ ${soThuc} mục con`}
                                </div>
                              )}
                            </Td>
                            {canEdit && (
                              <Td className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Mục con (dự toán / thực tế)"
                                    onClick={() => setMucCon(r)}
                                  >
                                    <ListTree className={`h-4 w-4 ${soCon > 0 ? "text-blue-600" : ""}`} />
                                  </Button>
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
                          {dangMo &&
                            r.mucConDuToan.map((m) => (
                              <tr key={m.id} className="bg-slate-50/40 text-xs text-slate-600">
                                <td />
                                <td className="py-1 pl-10 pr-3">
                                  ↳ {m.ten}
                                  {m.ghiChu ? <span className="text-slate-400"> · {m.ghiChu}</span> : null}
                                </td>
                                <td className="px-3 py-1 text-slate-400">{m.donVi ?? r.unit ?? ""}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{formatNumber(m.khoiLuong)}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{formatNumber(m.donGia)}</td>
                                <td className="px-3 py-1 text-right tabular-nums">
                                  {m.khoiLuong != null && m.donGia != null ? formatVND(m.khoiLuong * m.donGia) : "—"}
                                </td>
                                <td colSpan={3} className="border-l border-slate-100 bg-amber-50/20" />
                                {canEdit && <td />}
                              </tr>
                            ))}
                          {dangMo &&
                            r.mucConThucTe.map((m) => (
                              <tr key={m.id} className="bg-amber-50/20 text-xs text-slate-600">
                                <td />
                                <td className="py-1 pl-10 pr-3">
                                  <span className="mr-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">
                                    TT
                                  </span>
                                  {m.ten}
                                  {m.ghiChu ? <span className="text-slate-400"> · {m.ghiChu}</span> : null}
                                </td>
                                <td className="px-3 py-1 text-slate-400">{m.donVi ?? r.unit ?? ""}</td>
                                <td colSpan={3} />
                                <td className="border-l border-slate-100 px-3 py-1 text-right tabular-nums">
                                  {formatNumber(m.khoiLuong)}
                                </td>
                                <td className="px-3 py-1 text-right tabular-nums">{formatNumber(m.donGia)}</td>
                                <td className="px-3 py-1 text-right tabular-nums text-amber-800">
                                  {m.khoiLuong != null && m.donGia != null ? formatVND(m.khoiLuong * m.donGia) : "—"}
                                </td>
                                {canEdit && <td />}
                              </tr>
                            ))}
                          {dangMo &&
                            r.donHang.map((m) => (
                              <tr key={m.id} className="bg-amber-50/20 text-xs text-slate-600">
                                <td />
                                <td className="py-1 pl-10 pr-3">
                                  <span className="mr-1 rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-800">
                                    ĐH
                                  </span>
                                  {m.ten}
                                  <Link
                                    href={`/projects/${projectId}/purchase#${m.orderId}`}
                                    className="ml-1 text-blue-600 hover:underline"
                                  >
                                    {m.orderNo ?? "đơn hàng"}
                                  </Link>
                                </td>
                                <td className="px-3 py-1 text-slate-400">{m.donVi ?? r.unit ?? ""}</td>
                                <td colSpan={3} />
                                <td className="border-l border-slate-100 px-3 py-1 text-right tabular-nums">
                                  {formatNumber(m.khoiLuong)}
                                </td>
                                <td className="px-3 py-1 text-right tabular-nums">{formatNumber(m.donGia)}</td>
                                <td className="px-3 py-1 text-right tabular-nums text-amber-800">
                                  {m.thanhTien != null ? formatVND(m.thanhTien) : "—"}
                                </td>
                                {canEdit && <td />}
                              </tr>
                            ))}
                          </Fragment>
                          );
                        })}
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
      {anCotPhai ? (
        <button
          type="button"
          onClick={doiCotPhai}
          title="Hiện cột tổng hợp (giai đoạn, dự toán và thực tế, theo nhóm)"
          className="flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 xl:sticky xl:top-20 xl:px-2 xl:py-4 xl:[writing-mode:vertical-rl]"
        >
          <PanelRightOpen className="h-4 w-4 xl:rotate-90" />
          Tổng hợp
        </button>
      ) : (
      <div className="space-y-4 2xl:max-w-md">
        <button
          type="button"
          onClick={doiCotPhai}
          className="flex w-full items-center justify-end gap-1.5 text-xs text-slate-500 hover:text-slate-800"
        >
          <PanelRightClose className="h-4 w-4" /> Thu gọn cột tổng hợp
        </button>
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

        <TongHopKhoiLuong vatTu={khoiLuongVatTu} tenHangMuc={tenHangMuc} area={area} />

        {giaiDoan && <DashboardDuToan g={giaiDoan} nhom={soSanhNhom} />}
      </div>
      )}

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
                onChange={(e) => chonHangMuc(e.target.value)}
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
            <Field label="Nhóm (tiêu đề trên bảng)">
              <input type="hidden" name="groupLabel" value={dich.groupLabel} />
              <Select
                value={dich.nhomMoi ? NHOM_MOI : dich.groupLabel}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === NHOM_MOI) {
                    setDich((d) => ({ ...d, nhomMoi: true, groupLabel: "" }));
                    return;
                  }
                  const n = nhomCoSan.find((x) => x.nhan === v);
                  setDich((d) => ({
                    ...d,
                    nhomMoi: false,
                    groupLabel: v,
                    groupCode: n?.groupCode ?? d.groupCode,
                  }));
                }}
              >
                {nhomCoSan.map((n, i) => (
                  <option key={n.nhan} value={n.nhan}>
                    {i + 1}. {n.nhan}
                  </option>
                ))}
                <option value={NHOM_MOI}>+ Nhóm mới…</option>
              </Select>
              {dich.nhomMoi && (
                <Input
                  className="mt-2"
                  autoFocus
                  value={dich.groupLabel}
                  onChange={(e) => setDich((d) => ({ ...d, groupLabel: e.target.value }))}
                  placeholder="Tên nhóm mới, vd Máng nước"
                />
              )}
            </Field>
          </div>
          <Field label="Tên công việc *">
            <Input name="name" defaultValue={editing?.name ?? ""} required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Đơn vị">
              <Input name="unit" defaultValue={editing?.unit ?? ""} placeholder="kg, bộ, m²…" />
            </Field>
            <Field label="Loại chi phí (để tổng hợp bên phải) *">
              <Select
                name="groupCode"
                value={dich.groupCode}
                onChange={(e) => setDich((d) => ({ ...d, groupCode: e.target.value }))}
              >
                {ESTIMATE_GROUP.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
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
                readOnly={(editing?.soChiTiet ?? 0) > 0 || !!editing?.layTuThamSo}
                className={(editing?.soChiTiet ?? 0) > 0 || editing?.layTuThamSo ? "bg-slate-100 text-slate-500" : undefined}
              />
              {(editing?.soChiTiet ?? 0) > 0 ? (
                <p className="text-xs text-slate-500">
                  Bằng tổng bảng bóc ({editing!.soChiTiet} dòng).
                </p>
              ) : editing?.layTuThamSo ? (
                <p className="text-xs text-slate-500">Tự tính = tổng {tenThamSo(editing.layTuThamSo)} của hạng mục.</p>
              ) : null}
            </Field>
            <Field label="KL thực tế">
              <Input name="actualQty" inputMode="decimal" defaultValue={soVN(editing?.actualQty)} />
            </Field>
            <Field label="Đơn giá">
              <Input name="unitPrice" inputMode="decimal" defaultValue={soVN(editing?.unitPrice)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Khối lượng">
              <Select
                name="vaiTroKL"
                defaultValue={
                  editing?.layTuThamSo ? `lay:${editing.layTuThamSo}` : editing?.napThamSo ? `nap:${editing.napThamSo}` : ""
                }
              >
                <option value="">Nhập tay</option>
                <optgroup label="Dòng nguồn — cộng KL dòng này vào">
                  {Object.entries(TEN_THAM_SO).map(([k, ten]) => (
                    <option key={k} value={`nap:${k}`}>
                      Tổng {ten} của hạng mục
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Tự tính — KL dòng này bằng">
                  {Object.entries(TEN_THAM_SO).map(([k, ten]) => (
                    <option key={k} value={`lay:${k}`}>
                      Tổng {ten} × hệ số
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field label="Hệ số (khi tự tính)">
              <Input name="heSoQuyDoi" inputMode="decimal" placeholder="1" defaultValue={soVN(editing?.heSoQuyDoi)} />
            </Field>
            <p className="self-end pb-2 text-xs text-slate-500">
              Vd Xà gồ, Dầm ngang: nguồn kg thép; Vận chuyển KCT, Lắp dựng KCT: tự tính từ kg thép.
            </p>
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

      {mucCon && (
        <MucConModal projectId={projectId} dong={mucCon} thuVienKg={thuVienKg} onClose={() => setMucCon(null)} />
      )}

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
