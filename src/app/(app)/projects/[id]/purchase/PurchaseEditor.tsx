"use client";

import {
  createContext,
  Fragment,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  FileSpreadsheet,
  ImagePlus,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  PO_CATEGORY,
  PO_CATEGORY_MAP,
  PO_STATUS,
  PO_STATUS_MAP,
} from "@/lib/constants";
import { cn, formatVND, formatNumber, formatDate } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import {
  savePurchaseOrder,
  deletePurchaseOrder,
  savePurchaseItem,
  deletePurchaseItem,
  uploadPurchaseItemImages,
  deletePurchaseItemImage,
  suaOMonHang,
  ganDuToanNhieu,
  doiTenHangMuc,
  themNhanhMonHang,
} from "./actions";
import { OSoSua } from "@/components/ui/OSoSua";
import { NutLuuMau, NutTaoTuMau, type MauView } from "./ThuVienMau";
import { tongNhom } from "@/lib/donHang/khoiLuong";
import { gopTheoMa } from "@/lib/donHang/gop";

type GroupBy = "category" | "group";
type SortField = "name" | "other" | "qty" | "unitPrice" | "amount" | "weight";
type SortDir = "asc" | "desc";
interface SortState {
  field: SortField | null;
  dir: SortDir;
}

export interface OrderItemView {
  id: string;
  category: string | null;
  groupName: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  weight: number | null;
  /** Chiều dài một cây/tấm/sợi, mm. */
  length: number | null;
  note: string | null;
  imageIds: string[];
  estimateItemId: string | null;
  /** Tên đầu việc dự toán đã gắn (hiện dưới tên món). */
  estimateItemName: string | null;
}
/** Đầu việc dự toán thi công để gắn món đơn hàng — nhóm theo hạng mục. */
export interface DauViecOpt {
  id: string;
  name: string;
  unit: string | null;
  section: string;
}
export interface OrderView {
  id: string;
  orderNo: string | null;
  orderDate: string | null;
  category: string;
  supplierId: string | null;
  supplierName: string | null;
  status: string;
  orderedDate: string | null;
  expectedDate: string | null;
  receivedDate: string | null;
  value: number | null;
  totalWeight: number | null;
  filePath: string | null;
  note: string | null;
  items: OrderItemView[];
}
interface SupplierOpt {
  id: string;
  name: string;
}

const d10 = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function PurchaseEditor({
  projectId,
  orders,
  suppliers,
  dauViec,
  mau,
  canEdit,
}: {
  projectId: string;
  orders: OrderView[];
  suppliers: SupplierOpt[];
  dauViec: DauViecOpt[];
  mau: MauView[];
  canEdit: boolean;
}) {
  const nhomDauViec = useMemo(() => {
    const m = new Map<string, DauViecOpt[]>();
    for (const d of dauViec) m.set(d.section, [...(m.get(d.section) ?? []), d]);
    return [...m];
  }, [dauViec]);
  const router = useRouter();
  const [, start] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oOpen, setOOpen] = useState(false);
  const [oEditing, setOEditing] = useState<OrderView | null>(null);
  const [iOpen, setIOpen] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const [iOrderId, setIOrderId] = useState<string | null>(null);
  const [iEditing, setIEditing] = useState<OrderItemView | null>(null);

  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [sort, setSort] = useState<SortState>({ field: null, dir: "asc" });
  function toggleSort(field: SortField) {
    setSort((s) =>
      s.field === field
        ? s.dir === "asc"
          ? { field, dir: "desc" }
          : { field: null, dir: "asc" }
        : { field, dir: "asc" },
    );
  }

  function onOrderSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await savePurchaseOrder(
        projectId,
        oEditing?.id ?? null,
        form,
      );
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOOpen(false);
        router.refresh();
      }
    });
  }
  function onItemSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!iOrderId) return;
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await savePurchaseItem(
        projectId,
        iOrderId,
        iEditing?.id ?? null,
        form,
      );
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setIOpen(false);
        router.refresh();
      }
    });
  }
  async function onDeleteOrder(o: OrderView) {
    if (
      !(await confirm(
        `Xóa đơn hàng "${o.orderNo ?? ""}" và toàn bộ dòng vật tư?`,
      ))
    )
      return;
    start(async () => {
      const res = await deletePurchaseOrder(projectId, o.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }
  async function onDeleteItem(orderId: string, item: OrderItemView) {
    if (!(await confirm(`Xóa "${item.name}"?`))) return;
    start(async () => {
      const res = await deletePurchaseItem(projectId, orderId, item.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <DauViecCtx.Provider value={canEdit ? nhomDauViec : []}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Gom theo:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {(
                [
                  ["category", "Nhóm vật tư"],
                  ["group", "Hạng mục"],
                ] as [GroupBy, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGroupBy(val)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition",
                    groupBy === val
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {sort.field && (
              <button
                type="button"
                onClick={() => setSort({ field: null, dir: "asc" })}
                className="text-xs text-slate-400 underline hover:text-slate-600"
              >
                Bỏ sắp xếp
              </button>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <NutTaoTuMau projectId={projectId} mau={mau} />
              <Button
                size="sm"
                onClick={() => {
                  setOEditing(null);
                  setError(null);
                  setOOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Thêm đơn hàng
              </Button>
            </div>
          )}
        </div>

        {orders.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
            Chưa có đơn đặt hàng nào
          </div>
        )}

        {orders.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            canEdit={canEdit}
            projectId={projectId}
            groupBy={groupBy}
            sort={sort}
            onToggleSort={toggleSort}
            onRefresh={() => router.refresh()}
            onEditOrder={() => {
              setOEditing(o);
              setError(null);
              setOOpen(true);
            }}
            onDeleteOrder={() => onDeleteOrder(o)}
            onAddItem={() => {
              setIOrderId(o.id);
              setIEditing(null);
              setError(null);
              setIOpen(true);
            }}
            onEditItem={(it) => {
              setIOrderId(o.id);
              setIEditing(it);
              setError(null);
              setIOpen(true);
            }}
            onDeleteItem={(it) => onDeleteItem(o.id, it)}
          />
        ))}

        {/* Modal đơn hàng */}
        <Modal
          open={oOpen}
          onClose={() => setOOpen(false)}
          title={oEditing ? "Sửa đơn hàng" : "Thêm đơn hàng"}
        >
          <form onSubmit={onOrderSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Số / tên đơn">
                <Input name="orderNo" defaultValue={oEditing?.orderNo ?? ""} />
              </Field>
              <Field label="Ngày đơn">
                <Input
                  name="orderDate"
                  type="date"
                  defaultValue={d10(oEditing?.orderDate ?? null)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Loại đơn *">
                <Select
                  name="category"
                  defaultValue={oEditing?.category ?? "VTP"}
                >
                  {PO_CATEGORY.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Trạng thái *">
                <Select
                  name="status"
                  defaultValue={oEditing?.status ?? "DRAFT"}
                >
                  {PO_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Nhà cung cấp">
              <Select
                name="supplierId"
                defaultValue={oEditing?.supplierId ?? ""}
              >
                <option value="">— Không —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Ngày đặt">
                <Input
                  name="orderedDate"
                  type="date"
                  defaultValue={d10(oEditing?.orderedDate ?? null)}
                />
              </Field>
              <Field label="Dự kiến giao">
                <Input
                  name="expectedDate"
                  type="date"
                  defaultValue={d10(oEditing?.expectedDate ?? null)}
                />
              </Field>
              <Field label="Ngày nhận">
                <Input
                  name="receivedDate"
                  type="date"
                  defaultValue={d10(oEditing?.receivedDate ?? null)}
                />
              </Field>
            </div>
            <Field label="Đường dẫn file đơn (.xlsx trên ổ đĩa)">
              <Input name="filePath" defaultValue={oEditing?.filePath ?? ""} />
            </Field>
            <Field label="Ghi chú">
              <Textarea name="note" defaultValue={oEditing?.note ?? ""} />
            </Field>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal vật tư */}
        <Modal
          open={iOpen}
          onClose={() => setIOpen(false)}
          title={iEditing ? "Sửa vật tư" : "Thêm vật tư"}
        >
          <form onSubmit={onItemSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Loại (sheet)">
                <Input
                  name="category"
                  defaultValue={iEditing?.category ?? ""}
                  placeholder="BLLK, Tôn mái…"
                />
              </Field>
              <Field label="Hạng mục">
                <Input
                  name="groupName"
                  defaultValue={iEditing?.groupName ?? ""}
                  placeholder="HM khung mái…"
                />
              </Field>
            </div>
            <Field label="Tên hàng, quy cách *">
              <Input name="name" defaultValue={iEditing?.name ?? ""} required />
            </Field>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="SL">
                <Input
                  name="qty"
                  type="number"
                  step="any"
                  defaultValue={iEditing?.qty ?? ""}
                />
              </Field>
              <Field label="Đơn vị">
                <Input name="unit" defaultValue={iEditing?.unit ?? ""} />
              </Field>
              <Field label="Đơn giá">
                <Input
                  name="unitPrice"
                  type="number"
                  step="any"
                  defaultValue={iEditing?.unitPrice ?? ""}
                />
              </Field>
              <Field label="TL (kg)">
                <Input
                  name="weight"
                  type="number"
                  step="any"
                  defaultValue={iEditing?.weight ?? ""}
                />
              </Field>
            </div>
            <Field label="Thành tiền (để trống = SL × đơn giá)">
              <Input
                name="amount"
                type="number"
                step="any"
                defaultValue={iEditing?.amount ?? ""}
              />
            </Field>
            <Field label="Ghi chú">
              <Input name="note" defaultValue={iEditing?.note ?? ""} />
            </Field>
            <Field label="Đầu việc dự toán thi công (cộng vào thực tế)">
              <Select
                name="estimateItemId"
                defaultValue={iEditing?.estimateItemId ?? ""}
              >
                <option value="">— Chưa gắn —</option>
                {nhomDauViec.map(([hm, ds]) => (
                  <optgroup key={hm} label={hm}>
                    {ds.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {d.unit ? ` (${d.unit})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DauViecCtx.Provider>
  );
}

const otherOf = (it: OrderItemView, groupBy: GroupBy) =>
  (groupBy === "category" ? it.groupName : it.category) ?? "";

function sortRows(
  rows: OrderItemView[],
  sort: SortState,
  groupBy: GroupBy,
): OrderItemView[] {
  if (!sort.field) return rows;
  const { field, dir } = sort;
  const sign = dir === "asc" ? 1 : -1;
  const out = [...rows];
  out.sort((a, b) => {
    if (field === "name") return sign * a.name.localeCompare(b.name, "vi");
    if (field === "other")
      return (
        sign * otherOf(a, groupBy).localeCompare(otherOf(b, groupBy), "vi")
      );
    const av = a[field] as number | null;
    const bv = b[field] as number | null;
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // null luôn xuống cuối
    if (bv == null) return -1;
    return sign * (av - bv);
  });
  return out;
}

function SortHead({
  field,
  label,
  sort,
  onToggle,
  align = "left",
}: {
  field: SortField;
  label: string;
  sort: SortState;
  onToggle: (f: SortField) => void;
  align?: "left" | "right";
}) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th
      className={cn(
        "cursor-pointer select-none hover:bg-slate-200/70",
        align === "right" && "text-right",
      )}
      onClick={() => onToggle(field)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            active ? "text-blue-600" : "text-slate-300",
          )}
        />
      </span>
    </Th>
  );
}

function ItemsTable({
  rows,
  sort,
  onToggleSort,
  groupBy,
  otherLabel,
  canEdit,
  projectId,
  onRefresh,
  onEditItem,
  onDeleteItem,
  showGroupCol = false,
  orderId,
  nhomMoi,
}: {
  orderId: string;
  /** Nhóm gán cho dòng thêm nhanh — theo tab đang mở. */
  nhomMoi: { category?: string | null; groupName?: string | null };
  rows: OrderItemView[];
  sort: SortState;
  onToggleSort: (f: SortField) => void;
  groupBy: GroupBy;
  otherLabel: string;
  canEdit: boolean;
  projectId: string;
  onRefresh: () => void;
  onEditItem: (it: OrderItemView) => void;
  onDeleteItem: (it: OrderItemView) => void;
  showGroupCol?: boolean;
}) {
  // Bảng "toàn bộ vật tư": gom thành dòng cha (nhóm) + dòng con, như sheet Excel —
  // thay cho cột nhóm lặp lại ở mọi dòng. Thứ tự nhóm theo lần xuất hiện đầu.
  //
  // Trong mỗi nhóm lại gom theo chiều còn lại (hạng mục / nhóm vật tư) thành dòng tiêu
  // đề in đậm — đúng như dòng "1. Tôn PU dày 0.45mm…" của file Excel — thay cho cột
  // hạng mục lặp lại ở từng dòng.
  const khoi = useMemo(() => {
    const gom = <T,>(ds: T[], key: (x: T) => string) => {
      const m = new Map<string, T[]>();
      for (const x of ds) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
      return [...m];
    };
    const tachHangMuc = (ds: OrderItemView[]) =>
      gom(ds, (r) => otherOf(r, groupBy).trim()).map(([hm, con]) => ({
        hm,
        ds: con,
      }));
    if (!showGroupCol)
      return [
        { nhom: null as string | null, ds: rows, hms: tachHangMuc(rows) },
      ];
    return gom(
      rows,
      (r) => (groupBy === "category" ? r.category : r.groupName) || "—",
    ).map(([nhom, ds]) => ({
      nhom: nhom as string | null,
      ds,
      hms: tachHangMuc(ds),
    }));
  }, [rows, showGroupCol, groupBy]);
  const truongHangMuc = groupBy === "category" ? "groupName" : "category";

  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-12 text-center">STT</Th>
          <SortHead
            field="name"
            label="Tên hàng, quy cách"
            sort={sort}
            onToggle={onToggleSort}
          />
          <Th className="text-center">Biên dạng</Th>
          <Th className="text-right">Dài (mm)</Th>
          <SortHead
            field="qty"
            label="SL"
            sort={sort}
            onToggle={onToggleSort}
            align="right"
          />
          <Th>ĐV</Th>
          <SortHead
            field="unitPrice"
            label="Đơn giá"
            sort={sort}
            onToggle={onToggleSort}
            align="right"
          />
          <SortHead
            field="amount"
            label="Thành tiền"
            sort={sort}
            onToggle={onToggleSort}
            align="right"
          />
          <SortHead
            field="weight"
            label="TL (kg)"
            sort={sort}
            onToggle={onToggleSort}
            align="right"
          />
          <Th>Ghi chú</Th>
          {canEdit && <Th></Th>}
        </tr>
      </THead>
      <tbody onKeyDown={canEdit ? diChuyenO : undefined}>
        {khoi.map(({ nhom, ds, hms }, ni) => {
          // Nhóm chỉ có MỘT hạng mục (quy cách) thì đưa quy cách lên luôn dòng nhóm, bỏ số
          // thứ tự "1." đầu chữ vì nhóm đã được đánh số.
          const gop =
            nhom != null && hms.length === 1 && hms[0].hm ? hms[0] : null;
          return (
            <Fragment key={nhom ?? ""}>
              {nhom != null && (
                // Cấp 1 — nhóm vật tư: nền xanh, IN HOA, số to.
                <tr className="border-y-2 border-blue-200 bg-blue-50">
                  <td className="w-12 py-2.5 text-center text-base font-bold text-blue-700">
                    {ni + 1}
                  </td>
                  <td colSpan={98} className="px-3 py-2.5 text-sm">
                    <span className="text-[15px] font-bold uppercase tracking-wide text-blue-900">
                      {nhom}
                    </span>
                    {gop && (
                      <>
                        <span className="mx-1.5 text-blue-300">—</span>
                        {canEdit ? (
                          <OChuSua
                            giaTri={boSoDau(gop.hm)}
                            nhan="Quy cách nhóm"
                            rong
                            luu={(v) =>
                              doiTenHangMuc(
                                projectId,
                                orderId,
                                gop.ds.map((x) => x.id),
                                truongHangMuc,
                                v,
                              )
                            }
                          />
                        ) : (
                          <span className="font-semibold text-slate-800">
                            {boSoDau(gop.hm)}
                          </span>
                        )}
                      </>
                    )}
                    {canEdit && (gop || hms.length === 1) && (
                      <GanDuToan
                        ds={ds}
                        luu={(id) =>
                          ganDuToanNhieu(
                            projectId,
                            orderId,
                            ds.map((x) => x.id),
                            id,
                          )
                        }
                      />
                    )}
                    <span className="ml-2 text-xs text-slate-500">
                      {ds.length} dòng
                      <TongKhoiLuong ds={ds} />
                      {(() => {
                        const tien = ds.reduce(
                          (t, x) => t + (x.amount ?? 0),
                          0,
                        );
                        return tien ? ` · ${formatVND(tien)}` : "";
                      })()}
                    </span>
                  </td>
                </tr>
              )}
              {hms.map(({ hm, ds: con }, hi) => (
                <Fragment key={hm}>
                  {hm && !gop && (
                    // Cấp 2 — quy cách: nền xám nhạt, số "1.2" theo nhóm, bỏ số gốc "I."/"2." đầu chữ.
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="w-12 py-2 text-center text-sm font-semibold text-slate-600">
                        {nhom != null ? `${ni + 1}.${hi + 1}` : hi + 1}
                      </td>
                      <td
                        colSpan={98}
                        className="border-l-4 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
                      >
                        {canEdit ? (
                          <OChuSua
                            giaTri={boSoDau(hm)}
                            nhan={otherLabel}
                            rong
                            luu={(v) =>
                              doiTenHangMuc(
                                projectId,
                                orderId,
                                con.map((x) => x.id),
                                truongHangMuc,
                                v,
                              )
                            }
                          />
                        ) : (
                          boSoDau(hm)
                        )}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          <TongKhoiLuong ds={con} />
                        </span>
                        {canEdit && (
                          <GanDuToan
                            ds={con}
                            luu={(id) =>
                              ganDuToanNhieu(
                                projectId,
                                orderId,
                                con.map((x) => x.id),
                                id,
                              )
                            }
                          />
                        )}
                      </td>
                    </tr>
                  )}
                  {con.map((r, i) => (
                    <Tr key={r.id}>
                      <Td
                        className={cn(
                          "w-12 text-center text-xs text-slate-400",
                        )}
                      >
                        {i + 1}
                      </Td>
                      <Td className="pl-6 text-slate-900" data-cot="name">
                        {canEdit ? (
                          <OChuSua
                            giaTri={r.name}
                            nhan="Tên hàng, quy cách"
                            rong
                            luu={(v) => suaOMonHang(projectId, r.id, "name", v)}
                          />
                        ) : (
                          r.name
                        )}
                        {r.estimateItemName && (
                          <div className="text-xs font-normal text-emerald-700">
                            → {r.estimateItemName}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <div className="flex justify-center">
                          <ItemImages
                            item={r}
                            projectId={projectId}
                            canEdit={canEdit}
                            onRefresh={onRefresh}
                          />
                        </div>
                      </Td>
                      <Td className="text-right" data-cot="length">
                        {canEdit ? (
                          <OSoSua
                            giaTri={r.length}
                            dinhDang={formatNumber}
                            khoa={false}
                            thuCong={false}
                            nhan="Dài (mm)"
                            luu={(v) =>
                              suaOMonHang(projectId, r.id, "length", v)
                            }
                          />
                        ) : (
                          formatNumber(r.length)
                        )}
                      </Td>
                      <Td className="text-right" data-cot="qty">
                        {canEdit ? (
                          <OSoSua
                            giaTri={r.qty}
                            dinhDang={formatNumber}
                            khoa={false}
                            thuCong={false}
                            nhan="SL"
                            luu={(v) => suaOMonHang(projectId, r.id, "qty", v)}
                          />
                        ) : (
                          formatNumber(r.qty)
                        )}
                      </Td>
                      <Td className="text-slate-500" data-cot="unit">
                        {canEdit ? (
                          <OChuSua
                            giaTri={r.unit ?? ""}
                            nhan="Đơn vị"
                            luu={(v) => suaOMonHang(projectId, r.id, "unit", v)}
                          />
                        ) : (
                          r.unit || "—"
                        )}
                      </Td>
                      <Td className="text-right" data-cot="unitPrice">
                        {canEdit ? (
                          <OSoSua
                            giaTri={r.unitPrice}
                            dinhDang={formatNumber}
                            khoa={false}
                            thuCong={false}
                            nhan="Đơn giá"
                            luu={(v) =>
                              suaOMonHang(projectId, r.id, "unitPrice", v)
                            }
                          />
                        ) : (
                          formatNumber(r.unitPrice)
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.amount ? formatVND(r.amount) : "—"}
                      </Td>
                      <Td className="text-right" data-cot="weight">
                        {canEdit ? (
                          <OSoSua
                            giaTri={r.weight}
                            dinhDang={formatNumber}
                            khoa={false}
                            thuCong={false}
                            nhan="TL (kg)"
                            luu={(v) =>
                              suaOMonHang(projectId, r.id, "weight", v)
                            }
                          />
                        ) : (
                          formatNumber(r.weight)
                        )}
                      </Td>
                      <Td className="text-slate-500" data-cot="note">
                        {canEdit ? (
                          <OChuSua
                            giaTri={r.note ?? ""}
                            nhan="Ghi chú"
                            luu={(v) => suaOMonHang(projectId, r.id, "note", v)}
                          />
                        ) : (
                          r.note || ""
                        )}
                      </Td>
                      {canEdit && (
                        <Td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEditItem(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => onDeleteItem(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          );
        })}
        {canEdit && (
          <tr>
            <td
              colSpan={99}
              className="border-t border-dashed border-slate-200 px-3 py-1.5"
            >
              <ThemNhanh
                luu={(ten) =>
                  themNhanhMonHang(projectId, orderId, ten, nhomMoi)
                }
              />
            </td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}

/**
 * Enter / ↑ / ↓ trong một ô sửa → nhảy sang ô CÙNG CỘT ở dòng trên/dưới, như Excel.
 * Ô tự lưu khi mất focus nên chỉ cần dời focus. Tab giữ nguyên hành vi trình duyệt
 * (sang ô bên phải).
 */
/**
 * Tab "Gộp theo mã": bóc tách nhập riêng từng hạng mục, đặt hàng thì cộng dồn cùng mã —
 * như cột Mã bulong / Tổng SL / Tổng trọng lượng của sheet BLLK. Gộp trong từng nhóm vật
 * tư, để tôn không cộng lẫn với bulông.
 */
function BangGopTheoMa({ items }: { items: OrderItemView[] }) {
  const nhom = useMemo(() => {
    const m = new Map<string, OrderItemView[]>();
    for (const it of items) {
      const k = it.category || "—";
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    return [...m].map(([k, ds]) => [k, gopTheoMa(ds)] as const);
  }, [items]);
  return (
    <div className="space-y-4 p-4">
      {nhom.map(([k, ds], ni) => (
        <div key={k}>
          <div className="mb-1.5 text-sm font-bold uppercase tracking-wide text-blue-900">
            {ni + 1}. {k}
          </div>
          <Table>
            <THead>
              <tr>
                <Th className="w-12 text-center">STT</Th>
                <Th>Mã / quy cách</Th>
                <Th className="text-right">Tổng SL</Th>
                <Th>ĐV</Th>
                <Th className="text-right">Tổng TL (kg)</Th>
                <Th>Theo hạng mục</Th>
              </tr>
            </THead>
            <tbody>
              {ds.map((g, i) => (
                <Tr key={`${g.name}|${g.unit}`}>
                  <Td className="w-12 text-center text-xs text-slate-400">
                    {i + 1}
                  </Td>
                  <Td className="font-medium text-slate-900">{g.name}</Td>
                  <Td className="text-right font-semibold tabular-nums">
                    {formatNumber(g.qty)}
                  </Td>
                  <Td className="text-slate-500">{g.unit || "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {formatNumber(g.weight)}
                  </Td>
                  <Td className="text-xs text-slate-500">
                    {g.chiTiet.length > 1
                      ? g.chiTiet
                          .map(
                            (c) =>
                              `${boSoDau(c.hangMuc)}: ${formatNumber(c.qty)}`,
                          )
                          .join(" · ")
                      : boSoDau(g.chiTiet[0]?.hangMuc ?? "")}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      ))}
    </div>
  );
}

/** Đầu việc dự toán (theo hạng mục) để gắn món đơn hàng — rỗng khi không có quyền sửa. */
const DauViecCtx = createContext<[string, DauViecOpt[]][]>([]);

/**
 * Ô chọn đầu việc dự toán cho CẢ một nhóm / quy cách. Mọi món cùng gắn một đầu việc thì
 * hiện đầu việc đó; lẫn lộn thì hiện "nhiều đầu việc" — chọn lại là gắn chung cho tất cả.
 */
function GanDuToan({
  ds,
  luu,
}: {
  ds: OrderItemView[];
  luu: (
    estimateItemId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const nhom = useContext(DauViecCtx);
  const router = useRouter();
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  if (nhom.length === 0) return null;
  const ids = new Set(ds.map((x) => x.estimateItemId ?? ""));
  const hienTai = ids.size === 1 ? [...ids][0] : "__mix";
  return (
    <select
      aria-label="Gắn vào đầu việc dự toán"
      title="Cộng khối lượng cả nhóm vào thực tế của đầu việc dự toán"
      value={hienTai}
      disabled={dangLuu}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__mix") return;
        start(async () => {
          const res = await luu(v);
          if (!res.ok) toast.error(res.error);
          else router.refresh();
        });
      }}
      className={cn(
        "ml-3 max-w-[18rem] rounded border px-1.5 py-0.5 align-middle text-xs font-normal normal-case tracking-normal disabled:opacity-50",
        hienTai && hienTai !== "__mix"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-dashed border-slate-300 bg-white text-slate-500",
      )}
    >
      <option value="">→ Gắn dự toán…</option>
      {hienTai === "__mix" && <option value="__mix">→ nhiều đầu việc</option>}
      {nhom.map(([hm, dsDv]) => (
        <optgroup key={hm} label={hm}>
          {dsDv.map((d) => (
            <option key={d.id} value={d.id}>
              → {d.name}
              {d.unit ? ` (${d.unit})` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Tổng của một nhóm như dòng "Tổng cộng" Excel: tổng dài (m), tổng m² (tôn) và kg.
 * Số nào bằng 0 thì không hiện — nhóm bulông không có "0 m".
 */
function TongKhoiLuong({ ds }: { ds: OrderItemView[] }) {
  const t = tongNhom(ds.map((x) => ({ ...x, quyCach: x.groupName })));
  return (
    <>
      {t.dai > 0 && (
        <>
          {" "}
          · <b className="font-medium text-slate-700">
            {formatNumber(t.dai)}
          </b>{" "}
          m
        </>
      )}
      {t.m2 > 0 && (
        <>
          {" "}
          · <b className="font-medium text-slate-700">
            {formatNumber(t.m2)}
          </b>{" "}
          m²
        </>
      )}
      {" · "}
      <b className="font-medium text-slate-700">{formatNumber(t.kg)}</b> kg
    </>
  );
}

/** "1. Máng xối tôn…" / "II. La đỡ…" → bỏ số thứ tự đầu chữ. */
const boSoDau = (s: string) => s.replace(/^\s*(\d+|[IVXLC]+)\s*[.)]\s*/, "");

function diChuyenO(e: React.KeyboardEvent<HTMLTableSectionElement>) {
  const el = e.target as HTMLElement;
  if (el.tagName !== "INPUT") return;
  const buoc =
    e.key === "Enter" || e.key === "ArrowDown"
      ? 1
      : e.key === "ArrowUp"
        ? -1
        : 0;
  if (!buoc) return;
  const td = el.closest<HTMLElement>("td[data-cot]");
  const tr = td?.closest("tr");
  if (!td || !tr) return;
  e.preventDefault();
  const cot = td.dataset.cot;
  let ke = buoc > 0 ? tr.nextElementSibling : tr.previousElementSibling;
  let o: HTMLInputElement | null = null;
  // Bỏ qua dòng cha (tên nhóm) không có ô cùng cột.
  while (
    ke &&
    !(o = ke.querySelector<HTMLInputElement>(`td[data-cot="${cot}"] input`))
  ) {
    ke = buoc > 0 ? ke.nextElementSibling : ke.previousElementSibling;
  }
  if (o) o.focus();
  else el.blur();
}

/** Ô chữ sửa ngay trong bảng — cùng nếp với `OSoSua`: Enter/rời ô thì lưu, Esc thì thôi. */
function OChuSua({
  giaTri,
  nhan,
  luu,
  rong = false,
}: {
  giaTri: string;
  nhan: string;
  luu: (v: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  rong?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  const [nhap, setNhap] = useState<string | null>(null);
  const huy = useRef(false);

  function roiO(v: string) {
    if (huy.current || v.trim() === giaTri.trim()) {
      huy.current = false;
      setNhap(null);
      return;
    }
    start(async () => {
      const res = await luu(v);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
      setNhap(null);
    });
  }

  return (
    <input
      aria-label={nhan}
      value={nhap ?? giaTri}
      placeholder="—"
      disabled={dangLuu}
      onFocus={(e) => {
        setNhap(giaTri);
        e.currentTarget.select();
      }}
      onChange={(e) => setNhap(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          huy.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => roiO(e.currentTarget.value)}
      size={Math.max(4, (nhap ?? giaTri).length + 1)}
      className={cn(
        "field-sizing-content rounded border border-transparent bg-transparent px-1.5 py-0.5 hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-50",
        rong ? "min-w-[16ch] font-medium text-slate-900" : "min-w-[4ch]",
      )}
    />
  );
}

/** Dòng cuối bảng: gõ tên rồi Enter là có dòng mới, con trỏ ở lại để gõ tiếp dòng sau. */
function ThemNhanh({
  luu,
}: {
  luu: (ten: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  const [ten, setTen] = useState("");
  return (
    <div className="flex items-center gap-2 text-sm">
      <Plus className="h-4 w-4 text-slate-400" />
      <input
        aria-label="Thêm vật tư mới"
        value={ten}
        disabled={dangLuu}
        placeholder="Gõ tên hàng, quy cách rồi Enter để thêm dòng…"
        onChange={(e) => setTen(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !ten.trim()) return;
          e.preventDefault();
          start(async () => {
            const res = await luu(ten);
            if (!res.ok) toast.error(res.error);
            else {
              setTen("");
              router.refresh();
            }
          });
        }}
        className="flex-1 bg-transparent py-0.5 placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  );
}

const SUMMARY_TAB = "__summary__";
const GOP_TAB = "__gop__";

function OrderCard({
  order,
  canEdit,
  projectId,
  groupBy,
  sort,
  onToggleSort,
  onRefresh,
  onEditOrder,
  onDeleteOrder,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: {
  order: OrderView;
  canEdit: boolean;
  projectId: string;
  groupBy: GroupBy;
  sort: SortState;
  onToggleSort: (f: SortField) => void;
  onRefresh: () => void;
  onEditOrder: () => void;
  onDeleteOrder: () => void;
  onAddItem: () => void;
  onEditItem: (it: OrderItemView) => void;
  onDeleteItem: (it: OrderItemView) => void;
}) {
  const cat = PO_CATEGORY_MAP[order.category];
  const st = PO_STATUS_MAP[order.status];
  const otherLabel = groupBy === "category" ? "Hạng mục" : "Nhóm vật tư";
  const groupColLabel = groupBy === "category" ? "Nhóm vật tư" : "Hạng mục";

  const groups = useMemo(() => {
    const map = new Map<string, OrderItemView[]>();
    for (const it of order.items) {
      const key = (groupBy === "category" ? it.category : it.groupName) || "—";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(
      ([key, rows]) => [key, sortRows(rows, sort, groupBy)] as const,
    );
  }, [order.items, groupBy, sort]);

  const summary = useMemo(
    () =>
      groups.map(([key, rows]) => ({
        key,
        count: rows.length,
        weight: rows.reduce((s, r) => s + (r.weight ?? 0), 0),
        value: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
      })),
    [groups],
  );
  const allRows = useMemo(
    () => sortRows(order.items, sort, groupBy),
    [order.items, sort, groupBy],
  );

  const [tab, setTab] = useState<string>(SUMMARY_TAB);
  const tabKeys = groups.map(([k]) => k);
  const current =
    tab === SUMMARY_TAB || tab === GOP_TAB || tabKeys.includes(tab)
      ? tab
      : SUMMARY_TAB;
  const currentRows = groups.find(([k]) => k === current)?.[1] ?? [];

  return (
    <div
      id={order.id}
      className="scroll-mt-4 rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge tone={cat?.tone ?? "slate"}>
              {cat?.label ?? order.category}
            </Badge>
            <span className="font-semibold text-slate-900">
              {order.orderNo ?? "(Đơn chưa đặt tên)"}
            </span>
            <Badge tone={st?.tone ?? "slate"}>
              {st?.label ?? order.status}
            </Badge>
          </div>
          <div className="text-sm text-slate-500">
            NCC: {order.supplierName ?? "—"} · Ngày đặt:{" "}
            {order.orderedDate ? formatDate(order.orderedDate) : "—"}
            {order.expectedDate
              ? ` · Dự kiến giao: ${formatDate(order.expectedDate)}`
              : ""}
            {order.receivedDate
              ? ` · Đã nhận: ${formatDate(order.receivedDate)}`
              : ""}
            <LateBadge
              expected={order.expectedDate}
              received={order.receivedDate}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.filePath && (
            <a
              href={`/api/purchases/${order.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <FileSpreadsheet className="h-4 w-4" /> Mở file đơn
            </a>
          )}
          {canEdit && (
            <>
              <NutLuuMau
                projectId={projectId}
                orderId={order.id}
                tenGoiY={order.orderNo ?? ""}
              />
              <Button variant="ghost" size="icon" onClick={onEditOrder}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                onClick={onDeleteOrder}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {order.items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-2">
            {groups.map(([key, rows], gi) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-t-md border-b-2 px-3 py-1.5 text-sm font-medium transition",
                  current === key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                <span className="mr-1 font-semibold text-slate-400">{gi + 1}.</span>
                {key}
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">
                  {rows.length}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTab(SUMMARY_TAB)}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-1.5 text-sm font-semibold transition",
                current === SUMMARY_TAB
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700",
              )}
            >
              Tổng hợp
            </button>
            <button
              type="button"
              onClick={() => setTab(GOP_TAB)}
              title="Cộng dồn cùng mã qua các hạng mục — số đặt hàng gửi nhà cung cấp"
              className={cn(
                "rounded-t-md border-b-2 px-3 py-1.5 text-sm font-semibold transition",
                current === GOP_TAB
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700",
              )}
            >
              Gộp theo mã
            </button>
          </div>

          {current === GOP_TAB ? (
            <BangGopTheoMa items={order.items} />
          ) : current === SUMMARY_TAB ? (
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-600">
                  Tóm tắt theo {groupColLabel.toLowerCase()}
                </div>
                <Table>
                  <THead>
                    <tr>
                      <Th className="w-12 text-center">STT</Th>
                      <Th>{groupColLabel}</Th>
                      <Th className="text-right">Số dòng</Th>
                      <Th className="text-right">Khối lượng (kg)</Th>
                      <Th className="text-right">Giá trị</Th>
                    </tr>
                  </THead>
                  <tbody>
                    {summary.map((s, i) => (
                      <Tr key={s.key}>
                        <Td className="w-12 text-center text-slate-400">
                          {i + 1}
                        </Td>
                        <Td className="font-medium text-slate-900">{s.key}</Td>
                        <Td className="text-right">{s.count}</Td>
                        <Td className="text-right">{formatNumber(s.weight)}</Td>
                        <Td className="text-right">
                          {s.value ? formatVND(s.value) : "—"}
                        </Td>
                      </Tr>
                    ))}
                    <Tr className="bg-slate-50 font-semibold">
                      <Td className="text-slate-900">Tổng cộng</Td>
                      <Td className="text-right">{order.items.length}</Td>
                      <Td className="text-right">
                        {formatNumber(order.totalWeight)}
                      </Td>
                      <Td className="text-right">
                        {order.value ? formatVND(order.value) : "—"}
                      </Td>
                    </Tr>
                  </tbody>
                </Table>
              </div>
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-600">
                  Toàn bộ vật tư
                </div>
                <ItemsTable
                  rows={allRows}
                  sort={sort}
                  onToggleSort={onToggleSort}
                  groupBy={groupBy}
                  otherLabel={otherLabel}
                  canEdit={canEdit}
                  projectId={projectId}
                  onRefresh={onRefresh}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                  showGroupCol
                  orderId={order.id}
                  nhomMoi={{}}
                />
              </div>
            </div>
          ) : (
            <ItemsTable
              rows={currentRows}
              orderId={order.id}
              nhomMoi={
                current === "—"
                  ? {}
                  : groupBy === "category"
                    ? { category: current }
                    : { groupName: current }
              }
              sort={sort}
              onToggleSort={onToggleSort}
              groupBy={groupBy}
              otherLabel={otherLabel}
              canEdit={canEdit}
              projectId={projectId}
              onRefresh={onRefresh}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
            />
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 p-4">
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={onAddItem}>
            <Plus className="h-4 w-4" /> Thêm vật tư
          </Button>
        ) : (
          <span />
        )}
        <dl className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Số dòng:</dt>
            <dd className="font-medium text-slate-800">{order.items.length}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Khối lượng:</dt>
            <dd className="font-semibold text-blue-600">
              {formatNumber(order.totalWeight)} kg
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Giá trị:</dt>
            <dd className="font-semibold text-slate-900">
              {order.value ? formatVND(order.value) : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ItemImages({
  item,
  projectId,
  canEdit,
  onRefresh,
}: {
  item: OrderItemView;
  projectId: string;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    e.target.value = "";
    setBusy(true);
    const res = await uploadPurchaseItemImages(projectId, item.id, fd);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else onRefresh();
  }
  async function onDelete(imgId: string) {
    if (!(await confirm("Xóa ảnh biên dạng này?"))) return;
    setBusy(true);
    const res = await deletePurchaseItemImage(projectId, imgId);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else onRefresh();
  }

  if (!canEdit && item.imageIds.length === 0)
    return <span className="text-slate-300">—</span>;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {item.imageIds.map((imgId) => (
        <div key={imgId} className="group relative">
          <a
            href={`/api/po-images/${imgId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Mở hình biên dạng"
            aria-label="Mở hình biên dạng"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/po-images/${imgId}`}
              alt="biên dạng"
              className="h-8 w-8 rounded border border-slate-200 bg-white object-contain p-0.5 hover:border-blue-400"
            />
          </a>
          {canEdit && (
            <button
              type="button"
              onClick={() => onDelete(imgId)}
              title="Xóa ảnh"
              aria-label="Xóa ảnh"
              className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-600 p-0.5 text-white shadow group-hover:block hover:bg-red-700"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            title="Thêm ảnh biên dạng"
            aria-label="Thêm ảnh biên dạng"
            className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPick}
          />
        </>
      )}
    </div>
  );
}

function LateBadge({
  expected,
  received,
}: {
  expected: string | null;
  received: string | null;
}) {
  if (!expected) return null;
  const exp = new Date(expected);
  const end = received ? new Date(received) : new Date();
  const days = Math.floor((end.getTime() - exp.getTime()) / 86400000);
  if (days <= 0) {
    return received ? (
      <span className="ml-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
        đúng hẹn
      </span>
    ) : null;
  }
  return (
    <span className="ml-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
      {received ? `giao trễ ${days} ngày` : `quá hẹn ${days} ngày`}
    </span>
  );
}
