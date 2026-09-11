"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Printer,
  RefreshCw,
  ArrowUpFromLine,
  Receipt,
  FileOutput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, THead, Th } from "@/components/ui/table";
import { formatVND, formatDate } from "@/lib/utils";
import { computeQuoteTotals, sectionSubtotals } from "@/lib/quote";
import { duongDanIn, type ChuBaoGia } from "@/lib/quoteOwner";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { QuoteRows } from "./QuoteRows";
import { deleteQuote, deleteSection, deleteItem, repriceQuote, pushSalePrice } from "./actions";
import type { ItemView, QuoteView, SectionView } from "./types";

/**
 * Một thẻ báo giá: đầu thẻ, bảng, tổng cuối thẻ.
 *
 * Thẻ tự lo các thao tác không cần form (xóa, cập nhật đơn giá, đẩy giá bán) —
 * chúng chỉ cần một hộp xác nhận. Những gì cần form thì gọi ngược lên
 * QuoteEditor để mở hộp thoại tương ứng.
 */
export function QuoteCard({
  q,
  chu,
  canEdit,
  onEditQuote,
  onGenerateClient,
  onAddPhan,
  onAddSub,
  onEditSection,
  onAddItem,
  onEditItem,
}: {
  q: QuoteView;
  chu: ChuBaoGia;
  canEdit: boolean;
  onEditQuote: () => void;
  onGenerateClient: () => void;
  onAddPhan: () => void;
  onAddSub: (phanId: string) => void;
  onEditSection: (s: SectionView) => void;
  onAddItem: (sectionId: string) => void;
  onEditItem: (it: ItemView) => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  const totals = useMemo(() => computeQuoteTotals(q.items), [q.items]);
  const tienPhanCua = useMemo(() => sectionSubtotals(q.sections, q.items), [q.sections, q.items]);

  /** Chạy một action không có form: lỗi thì báo toast, xong thì tải lại. */
  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  async function onDeleteQuote() {
    if (!(await confirm(`Xóa báo giá "${q.title}"? (kèm toàn bộ phần & dòng)`))) return;
    run(() => deleteQuote(chu, q.id));
  }
  async function onDeleteSection(s: SectionView) {
    if (!(await confirm(`Xóa "${s.code} — ${s.name}"? (kèm dòng bên trong)`))) return;
    run(() => deleteSection(chu, s.id));
  }
  async function onDeleteItem(it: ItemView) {
    if (!(await confirm(`Xóa dòng "${it.name}"?`))) return;
    run(() => deleteItem(chu, it.id));
  }
  async function onReprice() {
    if (!(await confirm("Cập nhật lại giá gốc từ bảng đơn giá (đơn giá bán = giá gốc × TL)?")))
      return;
    run(() => repriceQuote(chu, q.id));
  }
  async function onPush() {
    if (!(await confirm(`Đặt giá bán dự án = tổng báo giá (${formatVND(totals.sell)})?`))) return;
    run(() => pushSalePrice(chu, q.id));
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
        <div className="flex flex-wrap items-center gap-1.5">
          {/* In được thì ai xem được cũng nên in được — không gắn với quyền sửa. */}
          <Link
            href={duongDanIn(chu, q.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> In / PDF
          </Link>
          {canEdit && (
            <>
              {/* Hai nút này cần một dự án có thật để ghi vào; ở cơ hội thì chưa có. */}
              {chu.loai === "DU_AN" && (
                <>
                  <Button variant="outline" size="sm" onClick={onGenerateClient}>
                    <FileOutput className="h-3.5 w-3.5" /> Tạo báo giá gửi khách
                  </Button>
                  <Button variant="outline" size="sm" onClick={onPush}>
                    <ArrowUpFromLine className="h-3.5 w-3.5" /> Đẩy giá bán
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={onReprice}>
                <RefreshCw className="h-3.5 w-3.5" /> Cập nhật đơn giá
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
            </>
          )}
        </div>
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
          <QuoteRows
            sections={q.sections}
            items={q.items}
            canEdit={canEdit}
            tienPhan={(phanId) => tienPhanCua.get(phanId) ?? 0}
            h={{ onAddSub, onEditSection, onDeleteSection, onAddItem, onEditItem, onDeleteItem }}
          />
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
