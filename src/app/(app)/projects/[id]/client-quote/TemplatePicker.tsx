"use client";

import { Select, Field } from "@/components/ui/form";
import type { TemplateOption } from "@/lib/quoteTemplatePick";

/**
 * Ô chọn mẫu báo giá — chỉ có nghĩa lúc TẠO, nên hộp thoại sửa không dựng nó.
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
  if (templates.length === 0) return null;

  return (
    <Field label="Mẫu báo giá">
      <Select name="templateId" defaultValue={goiY ?? ""}>
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
  );
}
