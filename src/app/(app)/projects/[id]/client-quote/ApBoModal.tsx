"use client";

import { useState } from "react";
import { Select, Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";
import { formatVND } from "@/lib/utils";
import { ModalActions } from "../quote/ModalActions";
import { apBoHangMuc } from "./actions";
import type { TemplateOption } from "@/lib/quoteTemplatePick";
import type { ChuBaoGia } from "@/lib/quoteOwner";

interface Dong {
  chon: boolean;
  qty: string;
  donGia: string;
}

/** 1250000 -> "1.250.000" — chấm phân nhóm nghìn cho dễ đọc. */
function dinhDang(n: number): string {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

/** Đọc một ô: trống -> null; công thức "=20*50" hoặc số kiểu Việt; sai -> NaN. */
function docO(s: string): number | null {
  if (!s.trim()) return null;
  return tinhBieuThuc(s) ?? NaN;
}

/**
 * Ô số: nhận số có chấm nghìn hoặc công thức bắt đầu bằng "=". Rời ô thì số thường
 * được chấm lại cho dễ đọc; công thức giữ nguyên và hiện kết quả ngay bên dưới.
 */
function OSo({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ct = laCongThuc(value);
  const kq = value.trim() ? tinhBieuThuc(value) : null;
  return (
    <div>
      <Input
        inputMode="decimal"
        className="h-8 text-right"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!ct && kq != null) onChange(dinhDang(kq));
        }}
      />
      {ct && (
        <span
          className={`block text-right text-xs ${kq == null ? "text-red-600" : "text-slate-500"}`}
        >
          {kq == null ? "công thức sai" : `= ${dinhDang(kq)}`}
        </span>
      )}
    </div>
  );
}

/** Mẫu mặc định: mẫu gợi ý nếu nó có hạng mục, không thì mẫu đầu tiên có hạng mục. */
function mauMacDinh(templates: TemplateOption[], goiY: string | null): string {
  const coPhan = (t: TemplateOption) => (t.phan?.length ?? 0) > 0;
  const g = templates.find((t) => t.id === goiY);
  if (g && coPhan(g)) return g.id;
  return templates.find(coPhan)?.id ?? templates[0]?.id ?? "";
}

function dongMoi(t: TemplateOption | undefined): Record<string, Dong> {
  const r: Record<string, Dong> = {};
  for (const p of t?.phan ?? []) {
    r[p.ma] = {
      chon: p.macDinh,
      qty: "",
      donGia: p.donGia != null ? dinhDang(p.donGia) : "",
    };
  }
  return r;
}

/**
 * Chọn bộ hạng mục, tích hạng mục, điền khối lượng (và chỉnh đơn giá) ngay tại đây —
 * thêm hết vào báo giá một lần. Gõ khối lượng vào dòng nào là dòng đó tự được chọn.
 *
 * Giữ lựa chọn bằng state rồi gửi thẳng mảng cho action, không đọc ô tích qua FormData.
 */
export function ApBoModal({
  chu,
  quoteId,
  templates,
  goiY,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  quoteId: string;
  templates: TemplateOption[];
  goiY: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);
  const [templateId, setTemplateId] = useState(() =>
    mauMacDinh(templates, goiY),
  );
  const mau = templates.find((t) => t.id === templateId);
  const [dong, setDong] = useState(() => dongMoi(mau));

  function doiMau(id: string) {
    setTemplateId(id);
    setDong(dongMoi(templates.find((t) => t.id === id)));
  }

  function sua(ma: string, patch: Partial<Dong>) {
    setDong((d) => ({ ...d, [ma]: { ...d[ma], ...patch } }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(async () => {
      if (!templateId) return { ok: false, error: "Chọn một bộ hạng mục." };
      const chon: {
        ma: string;
        qty: number | null;
        unitPrice: number | null;
      }[] = [];
      for (const p of mau?.phan ?? []) {
        const d = dong[p.ma];
        if (!d?.chon) continue;
        const qty = docO(d.qty);
        const unitPrice = docO(d.donGia);
        if (Number.isNaN(qty) || Number.isNaN(unitPrice)) {
          return { ok: false, error: `Số không hợp lệ ở hạng mục "${p.ten}".` };
        }
        chon.push({ ma: p.ma, qty, unitPrice });
      }
      if (chon.length === 0)
        return { ok: false, error: "Chưa chọn hạng mục nào." };
      return apBoHangMuc(chu, quoteId, templateId, chon);
    });
  }

  const phan = mau?.phan ?? [];

  return (
    <Modal open onClose={onClose} size="lg" title="Áp bộ hạng mục">
      <form onSubmit={onSubmit} className="space-y-4">
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có bộ hạng mục nào — tạo trong Thư viện đơn giá → Bộ hạng mục.
          </p>
        ) : (
          <Field label="Bộ hạng mục">
            <Select value={templateId} onChange={(e) => doiMau(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.buildingType ? ` — ${t.buildingType}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {phan.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="w-10 px-2 py-2 text-left font-medium">STT</th>
                  <th className="px-2 py-2 text-left font-medium">Hạng mục</th>
                  <th className="w-14 px-2 py-2 text-left font-medium">ĐVT</th>
                  <th className="w-28 px-2 py-2 text-right font-medium">
                    Khối lượng
                  </th>
                  <th className="w-36 px-2 py-2 text-right font-medium">
                    Đơn giá
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {phan.map((p, i) => {
                  const d = dong[p.ma] ?? { chon: false, qty: "", donGia: "" };
                  return (
                    <tr key={p.ma} className={d.chon ? "" : "text-slate-400"}>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={d.chon}
                          onChange={(e) =>
                            sua(p.ma, { chon: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          aria-label={`Chọn ${p.ten}`}
                        />
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => sua(p.ma, { chon: !d.chon })}
                        >
                          {p.ten}
                        </button>
                        {p.donGia != null && (
                          <span className="block text-xs text-slate-400">
                            mẫu {formatVND(p.donGia)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">{p.donVi ?? "m2"}</td>
                      <td className="px-2 py-1.5 align-top">
                        <OSo
                          value={d.qty}
                          placeholder="0"
                          onChange={(v) =>
                            sua(p.ma, {
                              qty: v,
                              chon: d.chon || v.trim() !== "",
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <OSo
                          value={d.donGia}
                          placeholder="nhập tay"
                          onChange={(v) => sua(p.ma, { donGia: v })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          templates.length > 0 && (
            <p className="text-sm text-slate-500">
              Bộ này chưa khai hạng mục gửi khách.
            </p>
          )
        )}

        <p className="text-xs text-slate-500">
          Gõ khối lượng là dòng tự được chọn; nhập được công thức, vd “=20*50”.
          Khối lượng để trống thì điền sau trên bảng. Các hạng mục được thêm vào
          cuối bảng, giữ nguyên những dòng đang có.
        </p>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
