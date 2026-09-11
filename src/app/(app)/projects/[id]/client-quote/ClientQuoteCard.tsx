"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Printer, FileText, ListChecks, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { formatVND, formatNumber, formatDate } from "@/lib/utils";
import { computeClientQuoteTotals, lineAmount, partTotals, sumStageDays } from "@/lib/clientQuote";
import { docTienVietNam } from "@/lib/money-words";
import { CLIENT_QUOTE_STATUS_MAP, QUOTE_SPEC_GROUP_MAP } from "@/lib/constants";
import { clearPriceOverride, deleteClientQuote, deleteLine, deleteSpec } from "./actions";
import type { ClientQuoteView, LineView, SpecView } from "./types";

export function ClientQuoteCard({
  q,
  projectId,
  canEdit,
  onEdit,
  onAddLine,
  onEditLine,
  onAddSpec,
  onEditSpec,
  onEditTerms,
}: {
  q: ClientQuoteView;
  projectId: string;
  canEdit: boolean;
  onEdit: () => void;
  onAddLine: () => void;
  onEditLine: (l: LineView) => void;
  onAddSpec: (groupCode: string) => void;
  onEditSpec: (s: SpecView) => void;
  onEditTerms: () => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  const tong = useMemo(
    () => computeClientQuoteTotals(q.lines, q.vatPercent),
    [q.lines, q.vatPercent]
  );
  const tienPhan = useMemo(() => partTotals(q.lines), [q.lines]);
  const trangThai = CLIENT_QUOTE_STATUS_MAP[q.status];

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  async function onDelete() {
    if (!(await confirm(`Xóa báo giá "${q.title}"? (kèm toàn bộ hạng mục & điều khoản)`))) return;
    run(() => deleteClientQuote(projectId, q.id));
  }
  async function onDeleteLine(l: LineView) {
    if (!(await confirm(`Xóa hạng mục "${l.name}"?`))) return;
    run(() => deleteLine(projectId, l.id));
  }
  async function onDeleteSpec(s: SpecView) {
    if (!(await confirm(`Xóa vật liệu "${s.name}"?`))) return;
    run(() => deleteSpec(projectId, s.id));
  }

  // Gom dòng theo phần, giữ nguyên thứ tự xuất hiện đầu tiên của mỗi phần.
  const phans: { code: string; name: string; lines: LineView[] }[] = [];
  for (const l of q.lines) {
    let p = phans.find((x) => x.code === l.partCode);
    if (!p) {
      p = { code: l.partCode, name: l.partName, lines: [] };
      phans.push(p);
    }
    p.lines.push(l);
  }

  const nhomVatLieu = ["A", "B"].map((g) => ({
    code: g,
    label: QUOTE_SPEC_GROUP_MAP[g]?.label ?? g,
    rows: q.specs.filter((s) => s.groupCode === g),
  }));

  const colSpan = canEdit ? 7 : 6;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            {q.quoteNo && <span className="font-mono text-sm text-slate-500">{q.quoteNo}</span>}
            <span className="font-semibold text-slate-900">{q.title}</span>
            <Badge tone={trangThai?.tone ?? "slate"}>{trangThai?.label ?? q.status}</Badge>
          </div>
          <div className="text-sm text-slate-500">
            {q.recipient && <span>Kính gửi: {q.recipient} · </span>}
            {q.scope && <span>{q.scope} · </span>}
            {q.quoteDate ? formatDate(q.quoteDate) : "—"}
            {q.expiryDate ? ` · hiệu lực đến ${formatDate(q.expiryDate)}` : ""}
          </div>
          {(q.derivedFromTitle || q.clonedFromTitle) && (
            <p className="text-xs text-slate-400">
              {q.derivedFromTitle && `Sinh từ báo giá chi tiết: ${q.derivedFromTitle}`}
              {q.clonedFromTitle && `Tạo từ: ${q.clonedFromTitle}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* In được thì ai xem được cũng nên in được — không gắn với quyền sửa. */}
          <Link
            href={`/projects/${projectId}/client-quote/${q.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> In / PDF
          </Link>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={onEditTerms}>
                <ListChecks className="h-3.5 w-3.5" /> Điều khoản
              </Button>
              <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Sửa báo giá">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                onClick={onDelete}
                aria-label="Xóa báo giá"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ---- Bảng báo giá theo hạng mục ---- */}
      <Table>
        <THead>
          <tr>
            <Th className="w-12">STT</Th>
            <Th>Nội dung công việc</Th>
            <Th className="w-16">ĐVT</Th>
            <Th className="w-28 text-right">Khối lượng</Th>
            <Th className="w-28 text-right">Đơn giá</Th>
            <Th className="w-32 text-right">Thành tiền</Th>
            {canEdit && <Th></Th>}
          </tr>
        </THead>
        <tbody>
          {q.lines.length === 0 && (
            <Tr>
              <Td colSpan={colSpan} className="py-6 text-center text-slate-400">
                Chưa có hạng mục nào.
              </Td>
            </Tr>
          )}
          {phans.map((phan) => (
            <PhanGroup key={phan.code}>
              <Tr className="bg-slate-100/80">
                <Td className="font-semibold text-slate-800">{phan.code}</Td>
                <Td className="font-semibold text-slate-800" colSpan={4}>
                  {phan.name}
                </Td>
                <Td className="text-right font-semibold text-blue-700">
                  {formatVND(tienPhan.get(phan.code) ?? 0)}
                </Td>
                {canEdit && <Td />}
              </Tr>
              {phan.lines.map((l) => (
                <Tr key={l.id}>
                  <Td className="text-slate-500">{l.code ?? "—"}</Td>
                  <Td className="text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{l.name}</span>
                      {l.priceOverridden && (
                        <Badge tone="amber" title="Đơn giá đã sửa tay">
                          đè giá
                        </Badge>
                      )}
                    </div>
                    {l.detail && (
                      <div className="whitespace-pre-line text-xs text-slate-400">{l.detail}</div>
                    )}
                    {l.note && <div className="text-xs text-slate-400">{l.note}</div>}
                  </Td>
                  <Td className="text-slate-600">{l.unit ?? "—"}</Td>
                  <Td className="text-right">{formatNumber(l.qty)}</Td>
                  <Td className="text-right">{formatNumber(l.unitPrice)}</Td>
                  <Td className="text-right font-medium">{formatVND(lineAmount(l))}</Td>
                  {canEdit && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {l.priceOverridden && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Bỏ đè giá"
                            aria-label="Bỏ đè giá"
                            onClick={() => run(() => clearPriceOverride(projectId, l.id))}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Sửa hạng mục"
                          onClick={() => onEditLine(l)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-50"
                          aria-label="Xóa hạng mục"
                          onClick={() => onDeleteLine(l)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </PhanGroup>
          ))}
        </tbody>
      </Table>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 p-4">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onAddLine}>
            <Plus className="h-4 w-4" /> Thêm hạng mục
          </Button>
        )}
        <dl className="min-w-[20rem] space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Cộng trước thuế</dt>
            <dd className="text-slate-700">{formatVND(tong.beforeVat)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Thuế VAT {q.vatPercent ?? 0}%</dt>
            <dd className="text-slate-700">{formatVND(tong.vat)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1">
            <dt className="font-medium text-slate-700">Tổng giá trị sau thuế</dt>
            <dd className="font-bold text-blue-700">{formatVND(tong.withVat)}</dd>
          </div>
          <p className="pt-1 text-right text-xs italic text-slate-500">
            {docTienVietNam(tong.withVat)}
          </p>
        </dl>
      </div>

      {/* ---- Vật liệu & thông số kỹ thuật ---- */}
      <details className="border-t border-slate-100 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Vật liệu áp dụng và thông số kỹ thuật ({q.specs.length} dòng)
        </summary>
        <div className="mt-3 space-y-4">
          {nhomVatLieu.map((nhom) => (
            <div key={nhom.code}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">
                  {nhom.code}. {nhom.label}
                </h4>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onAddSpec(nhom.code)}>
                    <Plus className="h-3.5 w-3.5" /> Thêm
                  </Button>
                )}
              </div>
              <Table>
                <THead>
                  <tr>
                    <Th>Nội dung</Th>
                    <Th>Thông số kỹ thuật</Th>
                    <Th>Ghi chú và xuất xứ</Th>
                    {canEdit && <Th></Th>}
                  </tr>
                </THead>
                <tbody>
                  {nhom.rows.length === 0 && (
                    <Tr>
                      <Td colSpan={canEdit ? 4 : 3} className="py-4 text-center text-slate-400">
                        Chưa có dòng nào.
                      </Td>
                    </Tr>
                  )}
                  {nhom.rows.map((s) => (
                    <Tr key={s.id}>
                      <Td className="text-slate-900">{s.name}</Td>
                      <Td className="italic text-slate-600">{s.spec ?? "—"}</Td>
                      <Td className="italic text-slate-600">{s.origin ?? "—"}</Td>
                      {canEdit && (
                        <Td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Sửa vật liệu"
                              onClick={() => onEditSpec(s)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:bg-red-50"
                              aria-label="Xóa vật liệu"
                              onClick={() => onDeleteSpec(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        </div>
      </details>

      {/* ---- Điều khoản tóm tắt ---- */}
      <div className="border-t border-slate-100 p-4 text-sm text-slate-600">
        <span className="font-medium text-slate-700">Điều khoản: </span>
        thi công {sumStageDays(q.stages)} ngày ({q.stages.length} chặng) · bảo hành{" "}
        {q.warrantyMonths ?? "—"} tháng · bảo trì {q.maintenanceMonths ?? "—"} tháng · hiệu lực{" "}
        {q.validDays ?? "—"} ngày · thanh toán {q.payments.length} đợt
      </div>
    </div>
  );
}

function PhanGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
