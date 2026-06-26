"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  ArrowUpFromLine,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatVND, formatNumber, formatDate } from "@/lib/utils";
import { computeQuoteTotals, lineSell, sellFromBase } from "@/lib/quote";
import {
  saveQuote,
  deleteQuote,
  saveSection,
  deleteSection,
  saveItem,
  deleteItem,
  cloneQuoteFrom,
  repriceQuote,
  pushSalePrice,
} from "./actions";

export interface SectionView {
  id: string;
  code: string;
  name: string;
  kind: string; // PHAN | SUB
  parentId: string | null;
  area: number | null;
}
export interface ItemView {
  id: string;
  sectionId: string;
  workCode: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  baseCost: number | null;
  sellPrice: number | null;
  spec: string | null;
  note: string | null;
}
export interface QuoteView {
  id: string;
  title: string;
  recipient: string | null;
  location: string | null;
  scope: string | null;
  quoteDate: string | null;
  markup: number | null;
  note: string | null;
  clonedFromTitle: string | null;
  sections: SectionView[];
  items: ItemView[];
}
export interface CatalogOption {
  code: string;
  name: string;
  unit: string | null;
  baseCost: number | null;
}
export interface CloneSource {
  id: string;
  label: string;
}

export function QuoteEditor({
  projectId,
  quotes,
  catalog,
  cloneSources,
  canEdit,
}: {
  projectId: string;
  quotes: QuoteView[];
  catalog: CatalogOption[];
  cloneSources: CloneSource[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // ----- quote header modal -----
  const [qOpen, setQOpen] = useState(false);
  const [qEditing, setQEditing] = useState<QuoteView | null>(null);

  // ----- section modal -----
  const [sOpen, setSOpen] = useState(false);
  const [sQuoteId, setSQuoteId] = useState<string>("");
  const [sEditing, setSEditing] = useState<SectionView | null>(null);
  const [sKind, setSKind] = useState<"PHAN" | "SUB">("PHAN");
  const [sParent, setSParent] = useState<string>("");
  const [sPhanOptions, setSPhanOptions] = useState<SectionView[]>([]);

  // ----- item modal -----
  const [iOpen, setIOpen] = useState(false);
  const [iQuoteId, setIQuoteId] = useState<string>("");
  const [iEditing, setIEditing] = useState<ItemView | null>(null);
  const [iMarkup, setIMarkup] = useState(1);
  const [iSections, setISections] = useState<{ id: string; label: string }[]>([]);
  const [f, setF] = useState({
    sectionId: "",
    workCode: "",
    name: "",
    unit: "",
    qty: "",
    baseCost: "",
    sellPrice: "",
    spec: "",
    note: "",
  });

  // ----- clone modal -----
  const [cOpen, setCOpen] = useState(false);

  function refresh() {
    setError(null);
    router.refresh();
  }

  // ---------- quote header ----------
  function openQuote(q: QuoteView | null) {
    setQEditing(q);
    setError(null);
    setQOpen(true);
  }
  function onQuoteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await saveQuote(projectId, qEditing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setQOpen(false);
        refresh();
      }
    });
  }
  function onDeleteQuote(q: QuoteView) {
    if (!window.confirm(`Xóa báo giá "${q.title}"? (kèm toàn bộ phần & dòng)`)) return;
    start(async () => {
      const res = await deleteQuote(projectId, q.id);
      if (!res.ok) alert(res.error);
      else refresh();
    });
  }

  // ---------- section ----------
  function openSection(
    quoteId: string,
    phanOptions: SectionView[],
    editing: SectionView | null,
    defaultKind: "PHAN" | "SUB",
    defaultParent: string
  ) {
    setSQuoteId(quoteId);
    setSPhanOptions(phanOptions);
    setSEditing(editing);
    setSKind(editing ? (editing.kind as "PHAN" | "SUB") : defaultKind);
    setSParent(editing?.parentId ?? defaultParent);
    setError(null);
    setSOpen(true);
  }
  function onSectionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await saveSection(projectId, sQuoteId, sEditing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setSOpen(false);
        refresh();
      }
    });
  }
  function onDeleteSection(s: SectionView) {
    if (!window.confirm(`Xóa "${s.code} — ${s.name}"? (kèm dòng bên trong)`)) return;
    start(async () => {
      const res = await deleteSection(projectId, s.id);
      if (!res.ok) alert(res.error);
      else refresh();
    });
  }

  // ---------- item ----------
  function leafLabel(q: QuoteView, s: SectionView): string {
    if (s.kind === "SUB") {
      const parent = q.sections.find((x) => x.id === s.parentId);
      return `${parent?.code ?? ""}.${s.code} — ${s.name}`;
    }
    return `${s.code} — ${s.name}`;
  }
  function openItem(q: QuoteView, sectionId: string, editing: ItemView | null) {
    setIQuoteId(q.id);
    setIMarkup(q.markup ?? 1);
    setIEditing(editing);
    setISections(q.sections.map((s) => ({ id: s.id, label: leafLabel(q, s) })));
    setF({
      sectionId: editing?.sectionId ?? sectionId,
      workCode: editing?.workCode ?? "",
      name: editing?.name ?? "",
      unit: editing?.unit ?? "",
      qty: editing?.qty != null ? String(editing.qty) : "",
      baseCost: editing?.baseCost != null ? String(editing.baseCost) : "",
      sellPrice: editing?.sellPrice != null ? String(editing.sellPrice) : "",
      spec: editing?.spec ?? "",
      note: editing?.note ?? "",
    });
    setError(null);
    setIOpen(true);
  }
  function onPickCatalog(code: string) {
    if (!code) {
      setF((p) => ({ ...p, workCode: "" }));
      return;
    }
    const c = catalog.find((x) => x.code === code);
    if (!c) {
      setF((p) => ({ ...p, workCode: code }));
      return;
    }
    const base = c.baseCost ?? 0;
    setF((p) => ({
      ...p,
      workCode: code,
      name: c.name,
      unit: c.unit ?? "",
      baseCost: String(base),
      sellPrice: String(Math.round(sellFromBase(base, iMarkup))),
    }));
  }
  function onItemSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await saveItem(projectId, iQuoteId, iEditing?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setIOpen(false);
        refresh();
      }
    });
  }
  function onDeleteItem(it: ItemView) {
    if (!window.confirm(`Xóa dòng "${it.name}"?`)) return;
    start(async () => {
      const res = await deleteItem(projectId, it.id);
      if (!res.ok) alert(res.error);
      else refresh();
    });
  }

  // ---------- clone / reprice / push ----------
  function onCloneSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sourceId = String(form.get("sourceId") ?? "");
    const mk = String(form.get("markup") ?? "");
    if (!sourceId) {
      setError("Hãy chọn báo giá nguồn.");
      return;
    }
    setError(null);
    setPending(true);
    start(async () => {
      const res = await cloneQuoteFrom(projectId, sourceId, mk === "" ? null : Number(mk));
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setCOpen(false);
        refresh();
      }
    });
  }
  function onReprice(q: QuoteView) {
    if (!window.confirm("Cập nhật lại giá gốc từ bảng đơn giá (đơn giá bán = giá gốc × TL)?"))
      return;
    start(async () => {
      const res = await repriceQuote(projectId, q.id);
      if (!res.ok) alert(res.error);
      else refresh();
    });
  }
  function onPush(q: QuoteView, total: number) {
    if (!window.confirm(`Đặt giá bán dự án = tổng báo giá (${formatVND(total)})?`)) return;
    start(async () => {
      const res = await pushSalePrice(projectId, q.id);
      if (!res.ok) alert(res.error);
      else refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => { setError(null); setCOpen(true); }}>
            <Copy className="h-4 w-4" /> Tạo từ dự án khác
          </Button>
          <Button size="sm" onClick={() => openQuote(null)}>
            <Plus className="h-4 w-4" /> Thêm báo giá
          </Button>
        </div>
      )}

      {quotes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Chưa có báo giá nào — bấm “Thêm báo giá” hoặc “Tạo từ dự án khác”.
        </div>
      )}

      {quotes.map((q) => (
        <QuoteCard
          key={q.id}
          q={q}
          canEdit={canEdit}
          onEditQuote={() => openQuote(q)}
          onDeleteQuote={() => onDeleteQuote(q)}
          onReprice={() => onReprice(q)}
          onPush={(total) => onPush(q, total)}
          onAddPhan={() => openSection(q.id, q.sections.filter((s) => !s.parentId), null, "PHAN", "")}
          onAddSub={(phanId) =>
            openSection(q.id, q.sections.filter((s) => !s.parentId), null, "SUB", phanId)
          }
          onEditSection={(s) =>
            openSection(q.id, q.sections.filter((x) => !x.parentId), s, s.kind as "PHAN" | "SUB", s.parentId ?? "")
          }
          onDeleteSection={onDeleteSection}
          onAddItem={(sectionId) => openItem(q, sectionId, null)}
          onEditItem={(it) => openItem(q, it.sectionId, it)}
          onDeleteItem={onDeleteItem}
        />
      ))}

      {/* ---- Modal: quote header ---- */}
      <Modal open={qOpen} onClose={() => setQOpen(false)} title={qEditing ? "Sửa báo giá" : "Thêm báo giá"}>
        <form onSubmit={onQuoteSubmit} className="space-y-3">
          <Field label="Tiêu đề *">
            <Input name="title" defaultValue={qEditing?.title ?? ""} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kính gửi">
              <Input name="recipient" defaultValue={qEditing?.recipient ?? ""} />
            </Field>
            <Field label="Địa điểm">
              <Input name="location" defaultValue={qEditing?.location ?? ""} />
            </Field>
          </div>
          <Field label="Hạng mục">
            <Input name="scope" defaultValue={qEditing?.scope ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày báo giá">
              <Input
                name="quoteDate"
                type="date"
                defaultValue={qEditing?.quoteDate ? qEditing.quoteDate.slice(0, 10) : ""}
              />
            </Field>
            <Field label="Hệ số TL (đơn giá bán = giá gốc × TL)">
              <Input name="markup" type="number" step="any" defaultValue={qEditing?.markup ?? 1} />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Textarea name="note" defaultValue={qEditing?.note ?? ""} />
          </Field>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setQOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </div>
        </form>
      </Modal>

      {/* ---- Modal: section ---- */}
      <Modal open={sOpen} onClose={() => setSOpen(false)} title={sEditing ? "Sửa phần/mục" : "Thêm phần/mục"}>
        <form onSubmit={onSectionSubmit} className="space-y-3">
          <Field label="Loại *">
            <Select name="kind" value={sKind} onChange={(e) => setSKind(e.target.value as "PHAN" | "SUB")}>
              <option value="PHAN">Phần (A, B, C…)</option>
              <option value="SUB">Mục con (I, II…)</option>
            </Select>
          </Field>
          {sKind === "SUB" && (
            <Field label="Thuộc phần *">
              <Select name="parentId" value={sParent} onChange={(e) => setSParent(e.target.value)}>
                <option value="">— Chọn phần —</option>
                {sPhanOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mã (A / I) *">
              <Input name="code" defaultValue={sEditing?.code ?? ""} required />
            </Field>
            <Field label="Diện tích (m²)">
              <Input name="area" type="number" step="any" defaultValue={sEditing?.area ?? ""} />
            </Field>
          </div>
          <Field label="Tên phần/mục *">
            <Input name="name" defaultValue={sEditing?.name ?? ""} required />
          </Field>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setSOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </div>
        </form>
      </Modal>

      {/* ---- Modal: item ---- */}
      <Modal open={iOpen} onClose={() => setIOpen(false)} title={iEditing ? "Sửa dòng vật tư" : "Thêm dòng vật tư"}>
        <form onSubmit={onItemSubmit} className="space-y-3">
          <Field label="Thuộc mục *">
            <Select
              name="sectionId"
              value={f.sectionId}
              onChange={(e) => setF((p) => ({ ...p, sectionId: e.target.value }))}
            >
              {iSections.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Chọn Mã CV từ bảng đơn giá">
            <Select name="workCode" value={f.workCode} onChange={(e) => onPickCatalog(e.target.value)}>
              <option value="">— Tự nhập —</option>
              {catalog.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nội dung công việc *">
            <Input
              name="name"
              value={f.name}
              onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Đơn vị">
              <Input name="unit" value={f.unit} onChange={(e) => setF((p) => ({ ...p, unit: e.target.value }))} />
            </Field>
            <Field label="Khối lượng">
              <Input
                name="qty"
                type="number"
                step="any"
                value={f.qty}
                onChange={(e) => setF((p) => ({ ...p, qty: e.target.value }))}
              />
            </Field>
            <Field label="Quy cách">
              <Input name="spec" value={f.spec} onChange={(e) => setF((p) => ({ ...p, spec: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá gốc">
              <Input
                name="baseCost"
                type="number"
                step="any"
                value={f.baseCost}
                onChange={(e) => {
                  const v = e.target.value;
                  setF((p) => ({
                    ...p,
                    baseCost: v,
                    sellPrice: v === "" ? p.sellPrice : String(Math.round(sellFromBase(Number(v) || 0, iMarkup))),
                  }));
                }}
              />
            </Field>
            <Field label={`Đơn giá bán (TL ×${iMarkup})`}>
              <Input
                name="sellPrice"
                type="number"
                step="any"
                value={f.sellPrice}
                onChange={(e) => setF((p) => ({ ...p, sellPrice: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Input name="note" value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} />
          </Field>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </div>
        </form>
      </Modal>

      {/* ---- Modal: clone ---- */}
      <Modal open={cOpen} onClose={() => setCOpen(false)} title="Tạo báo giá từ dự án khác">
        <form onSubmit={onCloneSubmit} className="space-y-3">
          <p className="text-sm text-slate-500">
            Sao chép cấu trúc &amp; khối lượng từ báo giá đã có, rồi lấy lại đơn giá mới nhất từ bảng đơn giá.
          </p>
          <Field label="Báo giá nguồn *">
            <Select name="sourceId" defaultValue="">
              <option value="">— Chọn báo giá —</option>
              {cloneSources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Hệ số TL (để trống = giữ theo nguồn)">
            <Input name="markup" type="number" step="any" placeholder="vd 1.2" />
          </Field>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={pending}>{pending ? "Đang tạo…" : "Tạo báo giá"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function QuoteCard({
  q,
  canEdit,
  onEditQuote,
  onDeleteQuote,
  onReprice,
  onPush,
  onAddPhan,
  onAddSub,
  onEditSection,
  onDeleteSection,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: {
  q: QuoteView;
  canEdit: boolean;
  onEditQuote: () => void;
  onDeleteQuote: () => void;
  onReprice: () => void;
  onPush: (total: number) => void;
  onAddPhan: () => void;
  onAddSub: (phanId: string) => void;
  onEditSection: (s: SectionView) => void;
  onDeleteSection: (s: SectionView) => void;
  onAddItem: (sectionId: string) => void;
  onEditItem: (it: ItemView) => void;
  onDeleteItem: (it: ItemView) => void;
}) {
  const totals = useMemo(() => computeQuoteTotals(q.items), [q.items]);
  const itemsBySection = useMemo(() => {
    const m = new Map<string, ItemView[]>();
    for (const it of q.items) {
      if (!m.has(it.sectionId)) m.set(it.sectionId, []);
      m.get(it.sectionId)!.push(it);
    }
    return m;
  }, [q.items]);
  const phans = q.sections.filter((s) => !s.parentId);
  const subsOf = (phanId: string) => q.sections.filter((s) => s.parentId === phanId);

  function phanSubtotal(phanId: string): number {
    let sum = 0;
    for (const it of itemsBySection.get(phanId) ?? []) sum += lineSell(it);
    for (const sub of subsOf(phanId))
      for (const it of itemsBySection.get(sub.id) ?? []) sum += lineSell(it);
    return sum;
  }

  const colSpan = canEdit ? 8 : 7;

  function ItemRows({ items }: { items: ItemView[] }) {
    return (
      <>
        {items.map((it) => (
          <Tr key={it.id}>
            <Td className="font-mono text-xs text-slate-500">{it.workCode ?? "—"}</Td>
            <Td className="text-slate-900">
              {it.name}
              {it.spec ? <span className="text-slate-400"> · {it.spec}</span> : null}
            </Td>
            <Td className="text-slate-600">{it.unit ?? "—"}</Td>
            <Td className="text-right">{formatNumber(it.qty)}</Td>
            <Td className="text-right text-slate-500">{formatNumber(it.baseCost)}</Td>
            <Td className="text-right">{formatNumber(it.sellPrice)}</Td>
            <Td className="text-right font-medium">{formatVND(lineSell(it))}</Td>
            {canEdit && (
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEditItem(it)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => onDeleteItem(it)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Td>
            )}
          </Tr>
        ))}
      </>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-900">{q.title}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
              TL ×{q.markup ?? 1}
            </span>
          </div>
          <div className="text-sm text-slate-500">
            {q.recipient && <span>Kính gửi: {q.recipient} · </span>}
            {q.scope && <span>{q.scope} · </span>}
            {q.quoteDate ? formatDate(q.quoteDate) : "—"}
          </div>
          {q.clonedFromTitle && (
            <p className="text-xs text-slate-400">Tạo từ: {q.clonedFromTitle}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={onReprice}>
              <RefreshCw className="h-3.5 w-3.5" /> Cập nhật đơn giá
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPush(totals.sell)}>
              <ArrowUpFromLine className="h-3.5 w-3.5" /> Đẩy giá bán
            </Button>
            <Button variant="ghost" size="icon" onClick={onEditQuote}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-600 hover:bg-red-50"
              onClick={onDeleteQuote}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Table>
        <THead>
          <tr>
            <Th>Mã CV</Th>
            <Th>Nội dung công việc</Th>
            <Th>ĐVT</Th>
            <Th className="text-right">Khối lượng</Th>
            <Th className="text-right">Giá gốc</Th>
            <Th className="text-right">Đơn giá bán</Th>
            <Th className="text-right">Thành tiền</Th>
            {canEdit && <Th></Th>}
          </tr>
        </THead>
        <tbody>
          {phans.map((phan) => (
            <PhanGroup key={phan.id}>
              <Tr className="bg-slate-100/80">
                <Td className="font-semibold text-slate-800">{phan.code}</Td>
                <Td className="font-semibold text-slate-800" colSpan={canEdit ? 5 : 5}>
                  {phan.name}
                  {phan.area ? <span className="text-slate-400"> · {formatNumber(phan.area)} m²</span> : null}
                </Td>
                <Td className="text-right font-semibold text-blue-700">
                  {formatVND(phanSubtotal(phan.id))}
                </Td>
                {canEdit && (
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onAddSub(phan.id)} title="Thêm mục con">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onEditSection(phan)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => onDeleteSection(phan)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
              <ItemRows items={itemsBySection.get(phan.id) ?? []} />
              {canEdit && (
                <Tr>
                  <Td colSpan={colSpan} className="py-1">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => onAddItem(phan.id)}
                    >
                      + Thêm dòng vào {phan.code}
                    </button>
                  </Td>
                </Tr>
              )}
              {subsOf(phan.id).map((sub) => (
                <PhanGroup key={sub.id}>
                  <Tr className="bg-slate-50">
                    <Td className="font-medium text-slate-600">{sub.code}</Td>
                    <Td className="font-medium text-slate-600" colSpan={canEdit ? 6 : 6}>
                      {sub.name}
                    </Td>
                    {canEdit && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onEditSection(sub)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => onDeleteSection(sub)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                  <ItemRows items={itemsBySection.get(sub.id) ?? []} />
                  {canEdit && (
                    <Tr>
                      <Td colSpan={colSpan} className="py-1">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => onAddItem(sub.id)}
                        >
                          + Thêm dòng vào {phan.code}.{sub.code}
                        </button>
                      </Td>
                    </Tr>
                  )}
                </PhanGroup>
              ))}
            </PhanGroup>
          ))}
          {q.sections.length === 0 && (
            <Tr>
              <Td colSpan={colSpan} className="py-6 text-center text-slate-400">
                Chưa có phần nào.
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 p-4">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onAddPhan}>
            <Plus className="h-4 w-4" /> Thêm phần
          </Button>
        )}
        <dl className="min-w-[18rem] space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Tổng giá gốc</dt>
            <dd className="text-slate-700">{formatVND(totals.cost)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tổng giá bán</dt>
            <dd className="font-medium text-slate-900">{formatVND(totals.sell)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1">
            <dt className="font-medium text-slate-700">
              Lợi nhuận{totals.margin != null ? ` (${(totals.margin * 100).toFixed(1)}%)` : ""}
            </dt>
            <dd className="font-bold text-green-600">{formatVND(totals.profit)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function PhanGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
