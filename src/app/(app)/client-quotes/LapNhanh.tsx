"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../projects/[id]/quote/ModalActions";
import { lapBaoGiaNhanh } from "./actions";

export interface KhachOption {
  id: string;
  tenCty: string;
  coHoi: { id: string; tenCongTrinh: string }[];
}

export interface MauOption {
  id: string;
  name: string;
  buildingType: string | null;
}

/**
 * Lập báo giá ngay từ danh sách, không phải đi vòng qua khu Khách hàng.
 *
 * Hỏi ba việc theo đúng thứ tự nhân viên kinh doanh nghĩ: khách nào, công trình nào,
 * mẫu nào. Khách hoặc công trình chưa có thì gõ thẳng vào đây, hệ thống dựng hộ.
 */
export function LapNhanh({
  khach,
  mau,
  canTaoKhach,
}: {
  khach: KhachOption[];
  mau: MauOption[];
  /** Không có quyền sửa CRM thì chỉ chọn được khách/công trình đã có. */
  canTaoKhach: boolean;
}) {
  const router = useRouter();
  const [mo, setMo] = useState(false);

  return (
    <>
      <Button onClick={() => setMo(true)}>
        <Plus className="h-4 w-4" /> Lập báo giá
      </Button>
      {mo && (
        <HopThoai
          khach={khach}
          mau={mau}
          canTaoKhach={canTaoKhach}
          onClose={() => setMo(false)}
          onDone={(coHoiId) => {
            setMo(false);
            // Đưa thẳng vào trang báo giá vừa lập — việc tiếp theo là điền hạng mục.
            router.push(`/co-hoi/${coHoiId}/client-quote`);
          }}
        />
      )}
    </>
  );
}

function HopThoai({
  khach,
  mau,
  canTaoKhach,
  onClose,
  onDone,
}: {
  khach: KhachOption[];
  mau: MauOption[];
  canTaoKhach: boolean;
  onClose: () => void;
  onDone: (coHoiId: string) => void;
}) {
  // Chưa có khách nào thì đường "chọn khách có sẵn" là ngõ cụt — mở thẳng ở chế độ mới.
  const [khachMode, setKhachMode] = useState<"CO_SAN" | "MOI">(
    khach.length > 0 || !canTaoKhach ? "CO_SAN" : "MOI"
  );
  const [khachHangId, setKhachHangId] = useState(khach[0]?.id ?? "");
  const [coHoiMode, setCoHoiMode] = useState<"CO_SAN" | "MOI">("MOI");

  const { error, pending, run } = useActionForm(() => {});
  const [dangGui, setDangGui] = useState(false);

  const congTrinh = useMemo(
    () => khach.find((k) => k.id === khachHangId)?.coHoi ?? [],
    [khach, khachHangId]
  );

  // Khách mới thì chưa có công trình nào; khách có sẵn mà chưa công trình nào cũng vậy.
  const chonDuocCongTrinh = khachMode === "CO_SAN" && congTrinh.length > 0;
  const modeThat = chonDuocCongTrinh ? coHoiMode : "MOI";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("coHoiMode", modeThat);
    setDangGui(true);
    run(async () => {
      const res = await lapBaoGiaNhanh(form);
      if (res.ok) onDone(res.coHoiId);
      else setDangGui(false);
      return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
    });
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Lập báo giá gửi khách">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* ---------- 1. Khách ---------- */}
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">1. Khách hàng</legend>
          <input type="hidden" name="khachMode" value={khachMode} />

          {canTaoKhach && (
            <div className="flex flex-wrap gap-1.5">
              <Chip
                chon={khachMode === "CO_SAN"}
                onClick={() => setKhachMode("CO_SAN")}
                tat={khach.length === 0}
              >
                Khách đã có
              </Chip>
              <Chip chon={khachMode === "MOI"} onClick={() => setKhachMode("MOI")}>
                Khách mới
              </Chip>
            </div>
          )}

          {khachMode === "CO_SAN" ? (
            khach.length === 0 ? (
              <p className="text-sm text-slate-400">
                Chưa có khách nào trong phạm vi của bạn.
              </p>
            ) : (
              <Field label="Chọn khách *">
                <Select
                  name="khachHangId"
                  value={khachHangId}
                  onChange={(e) => setKhachHangId(e.target.value)}
                >
                  {khach.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.tenCty}
                      {k.coHoi.length > 0 ? ` (${k.coHoi.length} công trình)` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            )
          ) : (
            <div className="space-y-3">
              <Field label="Tên khách hàng *">
                <Input name="khachTen" placeholder="Công ty CP ABC" autoFocus />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Người liên hệ">
                  <Input name="khachNguoiLienHe" />
                </Field>
                <Field label="Điện thoại">
                  <Input name="khachPhone" />
                </Field>
              </div>
              <p className="text-xs text-slate-400">
                Khách mới vào thẳng khu Khách hàng (CRM) và do bạn phụ trách. Ghi thêm
                thông tin trao đổi ở đó sau.
              </p>
            </div>
          )}
        </fieldset>

        {/* ---------- 2. Công trình ---------- */}
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">
            2. Công trình chào giá
          </legend>

          {chonDuocCongTrinh && (
            <div className="flex flex-wrap gap-1.5">
              <Chip chon={coHoiMode === "CO_SAN"} onClick={() => setCoHoiMode("CO_SAN")}>
                Công trình đã có
              </Chip>
              <Chip chon={coHoiMode === "MOI"} onClick={() => setCoHoiMode("MOI")}>
                Công trình mới
              </Chip>
            </div>
          )}

          {modeThat === "CO_SAN" ? (
            <Field label="Chọn công trình *">
              <Select name="coHoiId" defaultValue={congTrinh[0]?.id ?? ""}>
                {congTrinh.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tenCongTrinh}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="space-y-3">
              <Field label="Tên công trình *">
                <Input name="coHoiTen" placeholder="Nhà xưởng Hồng Ngự" />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Địa điểm">
                  <Input name="coHoiDiaDiem" />
                </Field>
                <Field label="Loại công trình">
                  <Input name="coHoiBuildingType" placeholder="Nhà xưởng" />
                </Field>
                <Field label="Diện tích (m²)">
                  <Input name="coHoiArea" type="number" step="any" />
                </Field>
              </div>
              <p className="text-xs text-slate-400">
                Diện tích là mẫu số khi suy đơn giá m² từ dự toán chi tiết. Chưa biết thì
                để trống, điền sau cũng được.
              </p>
            </div>
          )}
        </fieldset>

        {/* ---------- 3. Báo giá ---------- */}
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">3. Bản báo giá</legend>
          <Field label="Tiêu đề">
            <Input name="title" placeholder="Để trống = “Báo giá ” + tên công trình" />
          </Field>
          {mau.length > 0 && (
            <Field label="Mẫu báo giá">
              <Select name="templateId" defaultValue={mau[0]?.id ?? ""}>
                <option value="">— Không dùng mẫu (giá trị mặc định) —</option>
                {mau.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.buildingType ? ` — ${m.buildingType}` : ""}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-400">
                Điền sẵn bảng vật liệu, tiến độ thi công, tiến độ thanh toán và các đoạn
                chữ.
              </p>
            </Field>
          )}
        </fieldset>

        <ModalActions
          error={error}
          pending={pending || dangGui}
          onCancel={onClose}
          submitLabel="Lập báo giá"
          pendingLabel="Đang lập…"
        />
      </form>
    </Modal>
  );
}
