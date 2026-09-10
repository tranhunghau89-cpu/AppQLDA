"use client";

import * as React from "react";
import { Button } from "./button";
import { Modal } from "./modal";

export interface ConfirmOptions {
  title?: string;
  /** Nhãn nút đồng ý. Mặc định "Xóa" vì đa số lời gọi là xác nhận xóa. */
  confirmLabel?: string;
  /** true = nút đồng ý màu đỏ. Mặc định true. */
  danger?: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

/**
 * Hộp thoại xác nhận thay cho `window.confirm()`.
 * Dùng gần như thay thế trực tiếp:
 *
 *   if (!(await confirm(`Xóa CĐT "${c.name}"?`))) return;
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm phải nằm trong <ConfirmProvider>");
  return ctx;
}

interface PendingRequest extends ConfirmOptions {
  message: string;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingRequest | null>(null);

  const confirm = React.useCallback<ConfirmFn>(
    (message, options) =>
      new Promise<boolean>((resolve) => {
        setPending({ message, ...options, resolve });
      }),
    []
  );

  function tra(ketQua: boolean) {
    pending?.resolve(ketQua);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => tra(false)}
        title={pending?.title ?? "Xác nhận"}
        footer={
          <>
            <Button variant="outline" onClick={() => tra(false)}>
              Hủy
            </Button>
            <Button
              variant={pending?.danger === false ? "primary" : "danger"}
              onClick={() => tra(true)}
            >
              {pending?.confirmLabel ?? "Xóa"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">{pending?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}
