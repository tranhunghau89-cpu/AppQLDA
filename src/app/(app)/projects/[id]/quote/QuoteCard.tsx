"use client";

import { useMemo, useState, useTransition } from "react";
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
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select } from "@/components/ui/form";
import { Table, THead, Th } from "@/components/ui/table";
import { formatVND, formatDate, parseViNumber } from "@/lib/utils";
import { computeQuoteTotals, sectionSubtotals } from "@/lib/quote";
import { duongDanIn, type ChuBaoGia } from "@/lib/quoteOwner";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { QuoteRows } from "./QuoteRows";
import {
  apBoHangMucVaoDuToan,
  capNhatGiaTuThuVien,
  deleteQuote,
  deleteSection,
  deleteItem,
  pushSalePrice,
  xemTruocApBoHangMuc,
  type XemTruocApBo,
} from "./actions";
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
  boHangMucs,
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
  boHangMucs: {
    id: string;
    ma: string;
    ten: string;
    loaiCongTrinh: string | null;
    soPhan: number;
    soDong: number;
  }[];
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
  const [moApBo, setMoApBo] = useState(false);
  const [boChon, setBoChon] = useState("");
  const [loiApBo, setLoiApBo] = useState<string | null>(null);
  const [xemTruocBo, setXemTruocBo] = useState<XemTruocApBo | null>(null);
  // Diện tích từng phần, gõ thô theo kiểu Việt ("1.250,5") rồi mới gạn thành số.
  const [dienTich, setDienTich] = useState<Record<string, string>>({});

  const totals = useMemo(() => computeQuoteTotals(q.items), [q.items]);
  const soDongTroiGia = useMemo(
    () => q.items.filter((it) => it.coTroiGia && !it.giaSuaTay).length,
    [q.items]
  );
  const soDongSuaTay = useMemo(
    () => q.items.filter((it) => it.giaSuaTay).length,
    [q.items]
  );
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
    const loi =
      soDongTroiGia === 0
        ? "Không dòng nào lệch giá so với thư viện. Vẫn cập nhật?"
        : `Cập nhật ${soDongTroiGia} dòng đang lệch giá về đúng đơn giá thư viện hiện hành?`;
    const themVeSuaTay =
      soDongSuaTay > 0
        ? ` ${soDongSuaTay} dòng đã sửa tay sẽ được GIỮ NGUYÊN.`
        : "";
    // Truyền nhãn: mặc định của hộp xác nhận là nút đỏ "Xóa" vì đa số lời gọi là xóa.
    // Một thao tác cập nhật giá mà hỏi bằng nút "Xóa" màu đỏ là làm người dùng sợ sai chỗ.
    if (
      !(await confirm(loi + themVeSuaTay, {
        title: "Cập nhật giá từ thư viện",
        confirmLabel: "Cập nhật",
        danger: false,
      }))
    )
      return;
    run(() => capNhatGiaTuThuVien(chu, q.id));
  }
  function onChonBo(id: string) {
    setBoChon(id);
    setXemTruocBo(null);
    setDienTich({});
    setLoiApBo(null);
    if (!id) return;
    start(async () => {
      const res = await xemTruocApBoHangMuc(chu, q.id, id);
      if (!res.ok) setLoiApBo(res.error);
      else setXemTruocBo(res.data);
    });
  }

  function onApBo() {
    if (!boChon) {
      setLoiApBo("Chọn một bộ hạng mục.");
      return;
    }
    // Diện tích gõ vào là chuỗi; gạn thành số ở đây rồi mới gửi, để server nhận đúng
    // một kiểu dữ liệu chứ không phải vừa chuỗi vừa số tùy lúc.
    const soDienTich: Record<string, number | null> = {};
    for (const [ma, v] of Object.entries(dienTich)) soDienTich[ma] = parseViNumber(v);
    start(async () => {
      const res = await apBoHangMucVaoDuToan(chu, q.id, boChon, soDienTich);
      if (!res.ok) {
        setLoiApBo(res.error);
        return;
      }
      setMoApBo(false);
      const them = res.canhBao.length > 0 ? ` (${res.canhBao.length} cảnh báo)` : "";
      toast.success(`Đã dựng ${res.soPhan} phần và ${res.soDong} dòng${them}.`);
      router.refresh();
    });
  }

  async function onPush() {
    if (
      !(await confirm(`Đặt giá bán dự án = tổng báo giá (${formatVND(totals.sell)})?`, {
        title: "Đẩy giá bán sang dự án",
        confirmLabel: "Đẩy giá bán",
        danger: false,
      }))
    )
      return;
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
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
              {q.khuVucTen ?? "Giá chung"}
            </span>
            {soDongTroiGia > 0 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                {soDongTroiGia} dòng lệch giá thư viện
              </span>
            )}
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
              {/* Áp được cả vào bản ĐÃ có nội dung: chỉ THÊM phần còn thiếu, phần
                  trùng mã giữ nguyên. Bước xem trước nói rõ thêm gì, bỏ qua gì. */}
              {boHangMucs.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setBoChon("");
                    setXemTruocBo(null);
                    setDienTich({});
                    setLoiApBo(null);
                    setMoApBo(true);
                  }}
                >
                  <Layers className="h-3.5 w-3.5" /> Áp bộ hạng mục
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onGenerateClient}>
                <FileOutput className="h-3.5 w-3.5" /> Tạo báo giá gửi khách
              </Button>
              {/* Đẩy giá bán cần một dự án có thật để ghi vào; ở cơ hội thì chưa có. */}
              {chu.loai === "DU_AN" && (
                <Button variant="outline" size="sm" onClick={onPush}>
                  <ArrowUpFromLine className="h-3.5 w-3.5" /> Đẩy giá bán
                </Button>
              )}
              <Button
                variant={soDongTroiGia > 0 ? "secondary" : "outline"}
                size="sm"
                onClick={onReprice}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Cập nhật giá từ thư viện
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

      <Modal
        open={moApBo}
        onClose={() => setMoApBo(false)}
        title="Áp bộ hạng mục chuẩn"
      >
        <div className="space-y-3">
          <Field label="Chọn bộ *">
            <Select value={boChon} onChange={(e) => onChonBo(e.target.value)}>
              <option value="">— Chọn bộ hạng mục —</option>
              {boHangMucs.map((b) => (
                <option key={b.id} value={b.id} disabled={b.soPhan === 0}>
                  {b.ma} — {b.ten}
                  {b.loaiCongTrinh ? ` (${b.loaiCongTrinh})` : ""} · {b.soPhan} phần,{" "}
                  {b.soDong} dòng
                </option>
              ))}
            </Select>
          </Field>

          {xemTruocBo && (
            <>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Phần sẽ dựng</th>
                      <th className="px-3 py-2 text-right font-medium">Dòng</th>
                      <th className="px-3 py-2 text-right font-medium">Diện tích (m²)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {xemTruocBo.phanSeThem.map((p) => (
                      <tr key={p.ma}>
                        <td className="px-3 py-1.5 text-slate-800">
                          <span className="mr-1.5 font-mono text-slate-400">{p.ma}</span>
                          {p.ten}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{p.soDong}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            value={dienTich[p.ma] ?? ""}
                            onChange={(e) =>
                              setDienTich((cu) => ({ ...cu, [p.ma]: e.target.value }))
                            }
                            inputMode="decimal"
                            placeholder="—"
                            className="w-28 rounded border border-slate-200 px-1.5 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Diện tích là <strong>mẫu số của đơn giá m²</strong> trên bản gửi khách:
                đơn giá hạng mục = tổng giá bán của phần ÷ diện tích phần đó. Mái, vách
                và canopy mỗi thứ một diện tích, nên điền ngay ở đây. Để trống cũng
                được — sửa sau trong từng phần.
              </p>

              {xemTruocBo.phanBoQua.length > 0 && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Bản dự toán đã có phần{" "}
                  <strong>{xemTruocBo.phanBoQua.join(", ")}</strong> — giữ nguyên, không
                  áp đè.
                </p>
              )}
            </>
          )}

          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Đơn giá lấy từ <strong>thư viện</strong> theo khu vực{" "}
            <strong>{q.khuVucTen ?? "chung"}</strong> của bản dự toán, không lấy số mặc
            định đã soạn từ lâu trong bộ. Khối lượng để trống cho người lập điền.
          </p>
          {loiApBo && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{loiApBo}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMoApBo(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={onApBo} disabled={!boChon || !xemTruocBo}>
              Áp bộ hạng mục
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
