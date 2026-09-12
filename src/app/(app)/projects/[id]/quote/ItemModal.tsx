"use client";

import { useState, useTransition } from "react";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { sellFromBase } from "@/lib/quote";
import { formatNumber, formatQty } from "@/lib/utils";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";
import { ModalActions } from "./ModalActions";
import { goiYDonGia, saveItem, type GoiYGia } from "./actions";
import type { ChuBaoGia } from "@/lib/quoteOwner";
import type { CatalogOption, ItemView, SectionView } from "./types";

export interface ItemModalState {
  quoteId: string;
  markup: number;
  sections: SectionView[];
  editing: ItemView | null;
  /** Mục vừa được bấm thêm dòng — dùng khi thêm mới. */
  defaultSectionId: string;
}

/** Nhãn trong ô chọn mục: mục con hiện kèm mã của phần cha. */
function leafLabel(sections: SectionView[], s: SectionView): string {
  if (s.kind === "SUB") {
    const parent = sections.find((x) => x.id === s.parentId);
    return `${parent?.code ?? ""}.${s.code} — ${s.name}`;
  }
  return `${s.code} — ${s.name}`;
}

export function ItemModal({
  chu,
  catalog,
  state,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  catalog: CatalogOption[];
  state: ItemModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const { editing, markup, sections, quoteId } = state;
  const [f, setF] = useState({
    sectionId: editing?.sectionId ?? state.defaultSectionId,
    workCode: editing?.workCode ?? "",
    congTacId: editing?.congTacId ?? "",
    congTacVatTuId: editing?.congTacVatTuId ?? "",
    name: editing?.name ?? "",
    unit: editing?.unit ?? "",
    qty: editing?.qty != null ? String(editing.qty) : "",
    baseCost: editing?.baseCost != null ? String(editing.baseCost) : "",
    sellPrice: editing?.sellPrice != null ? String(editing.sellPrice) : "",
    spec: editing?.spec ?? "",
    note: editing?.note ?? "",
  });
  const [goiY, setGoiY] = useState<GoiYGia | null>(null);
  const [, startGoiY] = useTransition();
  const { error, pending, run } = useActionForm(onDone);

  const congTac = catalog.find((c) => c.congTacId === f.congTacId) ?? null;

  /**
   * Kết quả công thức, hiện ngay dưới ô trong lúc gõ.
   *
   * Máy chủ mới là nơi tính con số được lưu — ở đây chỉ soi trước, để người lập thấy
   * "=20*50" ra 1.000 trước khi bấm lưu chứ không phải sau.
   */
  const ketQuaCongThuc = laCongThuc(f.qty)
    ? (() => {
        const v = tinhBieuThuc(f.qty);
        return v == null
          ? { hopLe: false, chu: "Công thức chưa hợp lệ." }
          : { hopLe: true, chu: `= ${formatQty(v)}` };
      })()
    : null;

  /** Rót giá thư viện vào ô giá gốc và tính luôn đơn giá bán theo hệ số TL. */
  function apGia(donGia: number | null) {
    if (donGia === null) return;
    setF((p) => ({
      ...p,
      baseCost: String(donGia),
      sellPrice: String(Math.round(sellFromBase(donGia, markup))),
    }));
  }

  /**
   * Hỏi server giá đề xuất cho tổ hợp (công tác, biến thể) trong khu vực của BẢN dự
   * toán này. Không tự tính ở trình duyệt: khu vực thuộc về từng bản, và nhân bản luật
   * chọn giá ra hai nơi là cách chắc chắn để hai nơi lệch nhau.
   */
  function hoiGoiY(congTacId: string, bienTheId: string) {
    if (!congTacId) {
      setGoiY(null);
      return;
    }
    startGoiY(async () => {
      const res = await goiYDonGia(chu, quoteId, congTacId, bienTheId || null);
      if (!res.ok) {
        setGoiY(null);
        return;
      }
      setGoiY(res.goiY);
      apGia(res.goiY.donGia);
    });
  }

  /** Chọn công tác thì rót sẵn tên/đơn vị, chọn biến thể mặc định, rồi hỏi giá. */
  function onChonCongTac(congTacId: string) {
    if (!congTacId) {
      setF((p) => ({ ...p, congTacId: "", congTacVatTuId: "", workCode: "" }));
      setGoiY(null);
      return;
    }
    const c = catalog.find((x) => x.congTacId === congTacId);
    if (!c) return;
    const macDinh = c.bienThe.find((b) => b.laMacDinh)?.id ?? "";
    setF((p) => ({
      ...p,
      congTacId,
      congTacVatTuId: macDinh,
      workCode: c.code,
      name: c.name,
      unit: c.unit ?? "",
    }));
    hoiGoiY(congTacId, macDinh);
  }

  function onChonBienThe(bienTheId: string) {
    setF((p) => ({ ...p, congTacVatTuId: bienTheId }));
    hoiGoiY(f.congTacId, bienTheId);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveItem(chu, quoteId, editing?.id ?? null, form));
  }

  const daLechGoiY =
    goiY?.donGia != null &&
    f.baseCost !== "" &&
    Math.abs(Number(f.baseCost) - goiY.donGia) >= 1;

  return (
    <Modal open onClose={onClose} title={editing ? "Sửa dòng vật tư" : "Thêm dòng vật tư"}>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="congTacId" value={f.congTacId} />
        <input type="hidden" name="congTacVatTuId" value={f.congTacVatTuId} />
        <input type="hidden" name="workCode" value={f.workCode} />

        <Field label="Thuộc mục *">
          <Select
            name="sectionId"
            value={f.sectionId}
            onChange={(e) => setF((p) => ({ ...p, sectionId: e.target.value }))}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {leafLabel(sections, s)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Chọn công tác từ thư viện">
          <Select value={f.congTacId} onChange={(e) => onChonCongTac(e.target.value)}>
            <option value="">— Tự nhập —</option>
            {catalog.map((c) => (
              <option key={c.congTacId} value={c.congTacId}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {congTac && congTac.bienThe.length > 0 && (
          <Field label="Vật liệu">
            <Select
              value={f.congTacVatTuId}
              onChange={(e) => onChonBienThe(e.target.value)}
            >
              <option value="">Không chọn vật liệu cụ thể</option>
              {congTac.bienThe.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.ten}
                  {b.laMacDinh ? " (mặc định)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {goiY && (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
            {goiY.donGia === null ? (
              <span className="text-amber-700">
                Thư viện chưa có đơn giá cho công tác này — nhập tay bên dưới.
              </span>
            ) : (
              <>
                <span className="text-slate-600">Thư viện đề xuất </span>
                <span className="font-semibold text-blue-700">
                  {formatNumber(goiY.donGia)}
                </span>
                <span className="text-slate-500"> — {goiY.nhan}</span>
                {daLechGoiY && (
                  <button
                    type="button"
                    onClick={() => apGia(goiY.donGia)}
                    className="ml-2 font-medium text-blue-700 underline"
                  >
                    Dùng giá này
                  </button>
                )}
              </>
            )}
            {goiY.canhBao.map((c) => (
              <p key={c} className="mt-1 text-xs text-amber-700">
                {c}
              </p>
            ))}
          </div>
        )}

        <Field label="Nội dung công việc *">
          <Input
            name="name"
            value={f.name}
            onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Đơn vị">
            <Input
              name="unit"
              value={f.unit}
              onChange={(e) => setF((p) => ({ ...p, unit: e.target.value }))}
            />
          </Field>
          {/*
            Dòng dẫn xuất: khóa ô khối lượng. Vận chuyển KCT bằng tổng kg thép của phần
            ấy, và máy chủ tính lại mỗi lần một dòng thép đổi — cho gõ rồi ghi đè ngay
            sau đó thì người lập tưởng mình nhập sai chứ không biết là bị tính lại.
            Vẫn gửi `qty` lên để lệnh lưu không hụt trường, nhưng nó không được dùng.
          */}
          <Field label="Khối lượng">
            {/*
              Ô CHỮ chứ không phải type="number": ô số của trình duyệt không cho gõ dấu
              "=", mà đó chính là cách mở một công thức.
            */}
            <Input
              name="qty"
              inputMode="text"
              placeholder="Số, hoặc =20*50"
              value={f.qty}
              readOnly={!!editing?.layTuThamSo}
              title={
                editing?.layTuThamSo
                  ? `Khối lượng lấy từ các dòng nạp "${editing.layTuThamSo}" trong cùng phần — sửa ở dòng nguồn.`
                  : undefined
              }
              className={editing?.layTuThamSo ? "bg-slate-100 text-slate-500" : undefined}
              onChange={(e) => setF((p) => ({ ...p, qty: e.target.value }))}
            />
            {editing?.layTuThamSo ? (
              <p className="text-xs text-slate-500">
                Tự tính từ các dòng nguồn trong cùng phần.
              </p>
            ) : (
              ketQuaCongThuc && (
                <p
                  className={`text-xs ${
                    ketQuaCongThuc.hopLe ? "text-blue-700" : "text-red-600"
                  }`}
                >
                  {ketQuaCongThuc.chu}
                </p>
              )
            )}
          </Field>
          <Field label="Quy cách">
            <Input
              name="spec"
              value={f.spec}
              onChange={(e) => setF((p) => ({ ...p, spec: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  sellPrice:
                    v === ""
                      ? p.sellPrice
                      : String(Math.round(sellFromBase(Number(v) || 0, markup))),
                }));
              }}
            />
          </Field>
          <Field label={`Đơn giá bán (TL ×${markup})`}>
            <Input
              name="sellPrice"
              type="number"
              step="any"
              value={f.sellPrice}
              onChange={(e) => setF((p) => ({ ...p, sellPrice: e.target.value }))}
            />
          </Field>
        </div>
        {daLechGoiY && (
          <p className="text-xs text-slate-500">
            Giá gốc đang khác đề xuất của thư viện → dòng này sẽ được đánh dấu{" "}
            <strong>đã sửa tay</strong>, và nút &quot;Cập nhật giá từ thư viện&quot; sẽ
            bỏ qua nó.
          </p>
        )}
        <Field label="Ghi chú">
          <Input
            name="note"
            value={f.note}
            onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))}
          />
        </Field>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
