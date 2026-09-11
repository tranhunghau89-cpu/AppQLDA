"use client";

import { Input, Select, Textarea, Field } from "@/components/ui/form";

export interface HeaderState {
  name: string;
  buildingType: string;
  description: string;
  active: boolean;
  vatPercent: string;
  validDays: string;
  warrantyMonths: string;
  maintenanceMonths: string;
  loadRoof: string;
  loadHanging: string;
  loadFloor: string;
  lineDetail: string;
  greeting: string;
  closing: string;
  colorNote: string;
  volumeNote: string;
  excludeNote: string;
}

export type SetHeader = <K extends keyof HeaderState>(k: K, v: HeaderState[K]) => void;

/**
 * Phần đầu của mẫu: nhận dạng, các con số điều khoản, và những đoạn chữ in ra.
 *
 * `loaiCongTrinh` là danh sách loại công trình đang có thật trong dữ liệu dự án —
 * gõ đúng chuỗi đó thì mẫu mới được chọn sẵn khi lập báo giá (xem matchTemplate).
 */
export function HeaderFields({
  h,
  set,
  loaiCongTrinh,
}: {
  h: HeaderState;
  set: SetHeader;
  loaiCongTrinh: string[];
}) {
  const so = (k: keyof HeaderState, label: string, hint?: string) => (
    <Field label={label}>
      <Input
        value={h[k] as string}
        onChange={(e) => set(k, e.target.value as HeaderState[typeof k])}
        inputMode="decimal"
        placeholder={hint}
      />
    </Field>
  );
  const chu = (k: keyof HeaderState, label: string, rows = 2) => (
    <Field label={label}>
      <Textarea
        rows={rows}
        value={h[k] as string}
        onChange={(e) => set(k, e.target.value as HeaderState[typeof k])}
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="Tên mẫu *">
            <Input value={h.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
        </div>
        <Field label="Loại công trình">
          <Input
            list="loai-cong-trinh"
            value={h.buildingType}
            onChange={(e) => set("buildingType", e.target.value)}
            placeholder="Để trống = mẫu dùng chung"
          />
        </Field>
        <Field label="Trạng thái">
          <Select
            value={h.active ? "1" : "0"}
            onChange={(e) => set("active", e.target.value === "1")}
          >
            <option value="1">Đang dùng</option>
            <option value="0">Ẩn</option>
          </Select>
        </Field>
        <div className="sm:col-span-4">
          <Field label="Mô tả">
            <Input value={h.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </div>

      <datalist id="loai-cong-trinh">
        {loaiCongTrinh.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {so("vatPercent", "Thuế VAT (%)", "10")}
        {so("validDays", "Hiệu lực (ngày)", "7")}
        {so("warrantyMonths", "Bảo hành (tháng)", "12")}
        {so("maintenanceMonths", "Bảo trì (tháng)", "120")}
        {so("loadRoof", "Hoạt tải mái (kg/m²)", "10")}
        {so("loadHanging", "Tải treo (kg/m²)", "30")}
        {so("loadFloor", "Tải sàn (kg/m²)", "150")}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {chu("lineDetail", "Mô tả chung cho mọi hạng mục")}
        {chu("closing", "Lời kết")}
        <div className="lg:col-span-2">{chu("greeting", "Lời mở đầu", 3)}</div>
        {chu("colorNote", "Ghi chú màu sắc")}
        {chu("volumeNote", "Ghi chú khối lượng tạm tính")}
        <div className="lg:col-span-2">{chu("excludeNote", "Ghi chú loại trừ")}</div>
      </div>
    </div>
  );
}
