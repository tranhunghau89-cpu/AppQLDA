"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
import { PO_CATEGORY, PO_CATEGORY_MAP, PO_STATUS, PO_STATUS_MAP } from "@/lib/constants";
import { cn, formatVND, formatNumber, formatDate } from "@/lib/utils";
import {
  savePurchaseOrder,
  deletePurchaseOrder,
  savePurchaseItem,
  deletePurchaseItem,
  uploadPurchaseItemImages,
  deletePurchaseItemImage,
} from "./actions";

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
  note: string | null;
  imageIds: string[];
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
  canEdit,
}: {
  projectId: string;
  orders: OrderView[];
  suppliers: SupplierOpt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oOpen, setOOpen] = useState(false);
  const [oEditing, setOEditing] = useState<OrderView | null>(null);
  const [iOpen, setIOpen] = useState(false);
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
        : { field, dir: "asc" }
    );
  }

  function onOrderSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await savePurchaseOrder(projectId, oEditing?.id ?? null, form);
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
      const res = await savePurchaseItem(projectId, iOrderId, iEditing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setIOpen(false);
        router.refresh();
      }
    });
  }
  function onDeleteOrder(o: OrderView) {
    if (!window.confirm(`Xóa đơn hàng "${o.orderNo ?? ""}" và toàn bộ dòng vật tư?`)) return;
    start(async () => {
      const res = await deletePurchaseOrder(projectId, o.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }
  function onDeleteItem(orderId: string, item: OrderItemView) {
    if (!window.confirm(`Xóa "${item.name}"?`)) return;
    start(async () => {
      const res = await deletePurchaseItem(projectId, orderId, item.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
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
                    : "text-slate-600 hover:bg-slate-100"
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
      <Modal open={oOpen} onClose={() => setOOpen(false)} title={oEditing ? "Sửa đơn hàng" : "Thêm đơn hàng"}>
        <form onSubmit={onOrderSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số / tên đơn">
              <Input name="orderNo" defaultValue={oEditing?.orderNo ?? ""} />
            </Field>
            <Field label="Ngày đơn">
              <Input name="orderDate" type="date" defaultValue={d10(oEditing?.orderDate ?? null)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loại đơn *">
              <Select name="category" defaultValue={oEditing?.category ?? "BL"}>
                {PO_CATEGORY.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Trạng thái *">
              <Select name="status" defaultValue={oEditing?.status ?? "DRAFT"}>
                {PO_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Nhà cung cấp">
            <Select name="supplierId" defaultValue={oEditing?.supplierId ?? ""}>
              <option value="">— Không —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày đặt">
              <Input name="orderedDate" type="date" defaultValue={d10(oEditing?.orderedDate ?? null)} />
            </Field>
            <Field label="Ngày nhận">
              <Input name="receivedDate" type="date" defaultValue={d10(oEditing?.receivedDate ?? null)} />
            </Field>
          </div>
          <Field label="Đường dẫn file đơn (.xlsx trên ổ đĩa)">
            <Input name="filePath" defaultValue={oEditing?.filePath ?? ""} />
          </Field>
          <Field label="Ghi chú">
            <Textarea name="note" defaultValue={oEditing?.note ?? ""} />
          </Field>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal vật tư */}
      <Modal open={iOpen} onClose={() => setIOpen(false)} title={iEditing ? "Sửa vật tư" : "Thêm vật tư"}>
        <form onSubmit={onItemSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loại (sheet)">
              <Input name="category" defaultValue={iEditing?.category ?? ""} placeholder="BLLK, Tôn mái…" />
            </Field>
            <Field label="Hạng mục">
              <Input name="groupName" defaultValue={iEditing?.groupName ?? ""} placeholder="HM khung mái…" />
            </Field>
          </div>
          <Field label="Tên hàng, quy cách *">
            <Input name="name" defaultValue={iEditing?.name ?? ""} required />
          </Field>
          <div className="grid grid-cols-4 gap-3">
            <Field label="SL">
              <Input name="qty" type="number" step="any" defaultValue={iEditing?.qty ?? ""} />
            </Field>
            <Field label="Đơn vị">
              <Input name="unit" defaultValue={iEditing?.unit ?? ""} />
            </Field>
            <Field label="Đơn giá">
              <Input name="unitPrice" type="number" step="any" defaultValue={iEditing?.unitPrice ?? ""} />
            </Field>
            <Field label="TL (kg)">
              <Input name="weight" type="number" step="any" defaultValue={iEditing?.weight ?? ""} />
            </Field>
          </div>
          <Field label="Thành tiền (để trống = SL × đơn giá)">
            <Input name="amount" type="number" step="any" defaultValue={iEditing?.amount ?? ""} />
          </Field>
          <Field label="Ghi chú">
            <Input name="note" defaultValue={iEditing?.note ?? ""} />
          </Field>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIOpen(false)}>
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

const otherOf = (it: OrderItemView, groupBy: GroupBy) =>
  (groupBy === "category" ? it.groupName : it.category) ?? "";

function sortRows(rows: OrderItemView[], sort: SortState, groupBy: GroupBy): OrderItemView[] {
  if (!sort.field) return rows;
  const { field, dir } = sort;
  const sign = dir === "asc" ? 1 : -1;
  const out = [...rows];
  out.sort((a, b) => {
    if (field === "name") return sign * a.name.localeCompare(b.name, "vi");
    if (field === "other")
      return sign * otherOf(a, groupBy).localeCompare(otherOf(b, groupBy), "vi");
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
        align === "right" && "text-right"
      )}
      onClick={() => onToggle(field)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "text-blue-600" : "text-slate-300")} />
      </span>
    </Th>
  );
}

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

  const groups = useMemo(() => {
    const map = new Map<string, OrderItemView[]>();
    for (const it of order.items) {
      const key = (groupBy === "category" ? it.category : it.groupName) || "—";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(
      ([key, rows]) => [key, sortRows(rows, sort, groupBy)] as const
    );
  }, [order.items, groupBy, sort]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge tone={cat?.tone ?? "slate"}>{cat?.label ?? order.category}</Badge>
            <span className="font-semibold text-slate-900">{order.orderNo ?? "(Đơn chưa đặt tên)"}</span>
            <Badge tone={st?.tone ?? "slate"}>{st?.label ?? order.status}</Badge>
          </div>
          <div className="text-sm text-slate-500">
            NCC: {order.supplierName ?? "—"} · Ngày đặt:{" "}
            {order.orderedDate ? formatDate(order.orderedDate) : "—"}
            {order.receivedDate ? ` · Đã nhận: ${formatDate(order.receivedDate)}` : ""}
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

      {groups.map(([catName, rows]) => (
        <div key={catName}>
          <div className="bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-600">{catName}</div>
          <Table>
            <THead>
              <tr>
                <SortHead field="name" label="Tên hàng, quy cách" sort={sort} onToggle={onToggleSort} />
                <SortHead field="other" label={otherLabel} sort={sort} onToggle={onToggleSort} />
                <SortHead field="qty" label="SL" sort={sort} onToggle={onToggleSort} align="right" />
                <SortHead field="unitPrice" label="Đơn giá" sort={sort} onToggle={onToggleSort} align="right" />
                <SortHead field="amount" label="Thành tiền" sort={sort} onToggle={onToggleSort} align="right" />
                <SortHead field="weight" label="TL (kg)" sort={sort} onToggle={onToggleSort} align="right" />
                {canEdit && <Th></Th>}
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-slate-900">
                    {r.name}
                    {r.unit ? <span className="text-slate-400"> ({r.unit})</span> : null}
                    <ItemImages
                      item={r}
                      projectId={projectId}
                      canEdit={canEdit}
                      onRefresh={onRefresh}
                    />
                  </Td>
                  <Td className="text-slate-500">{otherOf(r, groupBy) || "—"}</Td>
                  <Td className="text-right">{formatNumber(r.qty)}</Td>
                  <Td className="text-right">{formatNumber(r.unitPrice)}</Td>
                  <Td className="text-right">{r.amount ? formatVND(r.amount) : "—"}</Td>
                  <Td className="text-right">{formatNumber(r.weight)}</Td>
                  {canEdit && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onEditItem(r)}>
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
            </tbody>
          </Table>
        </div>
      ))}

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
            <dd className="font-semibold text-blue-600">{formatNumber(order.totalWeight)} kg</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Giá trị:</dt>
            <dd className="font-semibold text-slate-900">{order.value ? formatVND(order.value) : "—"}</dd>
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

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    e.target.value = "";
    setBusy(true);
    const res = await uploadPurchaseItemImages(projectId, item.id, fd);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onRefresh();
  }
  async function onDelete(imgId: string) {
    if (!window.confirm("Xóa ảnh biên dạng này?")) return;
    setBusy(true);
    const res = await deletePurchaseItemImage(projectId, imgId);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onRefresh();
  }

  if (!canEdit && item.imageIds.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {item.imageIds.map((imgId) => (
        <div key={imgId} className="group relative">
          <a
            href={`/api/po-images/${imgId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Mở hình biên dạng"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/po-images/${imgId}`}
              alt="biên dạng"
              className="h-12 w-auto rounded border border-slate-200 bg-white object-contain p-0.5 hover:border-blue-400"
            />
          </a>
          {canEdit && (
            <button
              type="button"
              onClick={() => onDelete(imgId)}
              title="Xóa ảnh"
              className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-600 p-0.5 text-white shadow group-hover:block hover:bg-red-700"
            >
              <X className="h-3 w-3" />
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
            className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50"
          >
            <ImagePlus className="h-5 w-5" />
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
