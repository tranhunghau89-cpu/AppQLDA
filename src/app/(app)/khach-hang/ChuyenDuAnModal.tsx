"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../projects/[id]/quote/ModalActions";
import { goiYChuDauTu, type ChuDauTuCoSan } from "@/lib/coHoiChuyenDuAn";
import { chuyenSangDuAn } from "./coHoiActions";
import type { CoHoiRow } from "./CoHoiPanel";

/**
 * Hộp thoại "Đã ký hợp đồng — chuyển sang dự án".
 *
 * Hỏi đúng hai việc kế hoạch đã chốt: chủ đầu tư nào, và mã dự án là gì. Mã chỉ nhập ở
 * đây — cả giai đoạn chào giá trước đó không tốn mã nào.
 */
export function ChuyenDuAnModal({
  coHoi,
  tenKhach,
  chuDauTu,
  onClose,
}: {
  coHoi: CoHoiRow;
  tenKhach: string;
  chuDauTu: ChuDauTuCoSan[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [cach, setCach] = useState<"MOI" | "CO_SAN">("MOI");
  const { error, pending, run } = useActionForm(() => {
    onClose();
    router.refresh();
  });

  // Gợi ý chủ đầu tư trùng tên — chỉ để nhắc, người dùng vẫn phải tự chọn.
  const goiY = useMemo(() => goiYChuDauTu(chuDauTu, tenKhach), [chuDauTu, tenKhach]);
  const conLai = useMemo(
    () => chuDauTu.filter((c) => !goiY.some((g) => g.id === c.id)),
    [chuDauTu, goiY]
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => chuyenSangDuAn(coHoi.id, form));
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Đã ký hợp đồng — chuyển sang dự án">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sau bước này, <b>{coHoi.tenCongTrinh}</b> trở thành một dự án: dự toán và báo
          giá theo sang đó, khách thành chủ đầu tư. Không có nút hoàn tác.
        </p>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">1. Chủ đầu tư</div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="cachChuDauTu"
              value="MOI"
              checked={cach === "MOI"}
              onChange={() => setCach("MOI")}
            />
            Tạo chủ đầu tư mới từ thông tin khách
          </label>

          {cach === "MOI" && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <Field label="Tên chủ đầu tư *">
                <Input name="cdtName" defaultValue={tenKhach} required />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Người đại diện">
                  <Input name="cdtContactPerson" />
                </Field>
                <Field label="Điện thoại">
                  <Input name="cdtPhone" />
                </Field>
              </div>
              <Field label="Địa chỉ pháp lý">
                <Input name="cdtAddress" placeholder="Ghi theo giấy đăng ký kinh doanh" />
              </Field>
              <p className="text-xs text-slate-400">
                Những ô này là thứ hợp đồng cần mà CRM chưa hỏi tới. Bỏ trống cũng được,
                điền sau ở khu Chủ đầu tư.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="cachChuDauTu"
              value="CO_SAN"
              checked={cach === "CO_SAN"}
              onChange={() => setCach("CO_SAN")}
            />
            Áp vào chủ đầu tư đã có
          </label>

          {cach === "CO_SAN" && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <Field label="Chọn chủ đầu tư *">
                <Select name="customerId" defaultValue={goiY[0]?.id ?? ""}>
                  <option value="">— Chọn chủ đầu tư —</option>
                  {goiY.length > 0 && (
                    <optgroup label="Có thể là khách này">
                      {goiY.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Tất cả">
                    {conLai.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
              </Field>
              {goiY.length > 0 && (
                <p className="text-xs text-slate-500">
                  Có {goiY.length} chủ đầu tư tên gần giống — kiểm lại mã số thuế trước
                  khi áp, áp nhầm là mọi hợp đồng sau đó treo sai pháp nhân.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800">2. Dự án</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Mã dự án *">
              <Input name="code" required placeholder="N037" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Tên dự án">
                <Input name="projectName" defaultValue={coHoi.tenCongTrinh} />
              </Field>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Diện tích, loại công trình và K/L/H chép thẳng từ công trình chào giá — chúng
            đã dùng để tính giá rồi. Giá bán lấy tổng sau thuế của báo giá đã chốt.
          </p>
        </div>

        <ModalActions
          error={error}
          pending={pending}
          onCancel={onClose}
          submitLabel="Tạo dự án"
          pendingLabel="Đang tạo…"
        />
      </form>
    </Modal>
  );
}
