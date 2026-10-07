"use client";

import { useState } from "react";
import { Select, Field } from "@/components/ui/form";
import { formatVND } from "@/lib/utils";
import type { TemplateOption } from "@/lib/quoteTemplatePick";

/**
 * Ô chọn mẫu báo giá — chỉ có nghĩa lúc TẠO, nên hộp thoại sửa không dựng nó.
 *
 * Chọn mẫu xong thì hiện các phần của bộ để người lập tích chọn phần nào thành hạng
 * mục trên báo giá (Canopy, cửa lùa… chỉ có ở một số công trình). Tích sẵn theo cờ
 * "in cho khách" của bộ.
 *
 * Chưa có mẫu nào thì không hiện gì cả: báo giá vẫn lập được bằng giá trị mặc định,
 * hiện một ô rỗng chỉ làm người dùng tưởng mình quên chọn.
 */
export function TemplatePicker({
  templates,
  goiY,
}: {
  templates: TemplateOption[];
  goiY: string | null;
}) {
  const macDinhCua = (id: string) =>
    (templates.find((t) => t.id === id)?.phan ?? []).filter((p) => p.macDinh).map((p) => p.ma);
  const [templateId, setTemplateId] = useState(goiY ?? "");
  // Giữ lựa chọn bằng state và gửi qua MỘT ô ẩn — không trông vào việc FormData nhặt
  // các ô tích (đã có lần lựa chọn rơi mất, báo giá lập ra không có hạng mục nào).
  const [chon, setChon] = useState<string[]>(() => macDinhCua(goiY ?? ""));
  if (templates.length === 0) return null;

  const mau = templates.find((t) => t.id === templateId);
  const phan = mau?.phan ?? [];

  function doiMau(id: string) {
    setTemplateId(id);
    setChon(macDinhCua(id));
  }

  return (
    <div className="space-y-3">
      <Field label="Mẫu báo giá">
        <Select
          name="templateId"
          value={templateId}
          onChange={(e) => doiMau(e.target.value)}
        >
          <option value="">— Không dùng mẫu (giá trị mặc định) —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.buildingType ? ` — ${t.buildingType}` : ""}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-600">
          Điền sẵn bảng vật liệu, tiến độ thi công, tiến độ thanh toán và các đoạn chữ —
          chọn xong thì phần dưới thường không phải sửa gì.
        </p>
      </Field>

      {phan.length > 0 && (
        <fieldset className="rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Hạng mục đưa vào báo giá
          </legend>
          <input type="hidden" name="coChonPhan" value="1" />
          <input type="hidden" name="phanChonCsv" value={chon.join(",")} />
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {phan.map((p) => (
              <label key={p.ma} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={chon.includes(p.ma)}
                  onChange={(e) =>
                    setChon((c) =>
                      e.target.checked ? [...c, p.ma] : c.filter((x) => x !== p.ma)
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span className="flex-1">{p.ten}</span>
                <span className="text-xs text-slate-500">
                  {p.donGia != null ? `${formatVND(p.donGia)}/${p.donVi ?? "m2"}` : "chưa có giá"}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Đơn giá mẫu điền sẵn — khối lượng điền sau trên bảng hạng mục, đơn giá sửa được.
          </p>
        </fieldset>
      )}
    </div>
  );
}
