"use client";

import { Button } from "@/components/ui/button";

/** Dải nút Hủy / Lưu + ô báo lỗi — giống nhau ở mọi hộp thoại của module báo giá. */
export function ModalActions({
  error,
  pending,
  onCancel,
  submitLabel = "Lưu",
  pendingLabel = "Đang lưu…",
}: {
  error: string | null;
  pending: boolean;
  onCancel: () => void;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </>
  );
}
