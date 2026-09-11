"use client";

import { useState, useTransition } from "react";

/**
 * Kết quả mà mọi server action trong app trả về. Khai lại ở đây (thay vì import
 * từ một file actions cụ thể) để hook này không phụ thuộc vào module nào —
 * `{ ok: true }` kèm thêm trường phụ vẫn gán được vào kiểu này.
 */
export type ActionOutcome = { ok: true } | { ok: false; error: string };

/**
 * Gói lại đúng cái vòng "gửi form → chờ → lỗi thì hiện, xong thì đóng & tải lại"
 * mà mọi hộp thoại trong app đều lặp y hệt nhau.
 *
 * `onDone` chạy khi action trả về ok — thường là `() => { onClose(); router.refresh(); }`.
 * Action không bao giờ ném lỗi (quy ước của repo), nên ở đây không có try/catch.
 */
export function useActionForm(onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, start] = useTransition();

  function run(fn: () => Promise<ActionOutcome>) {
    setError(null);
    setPending(true);
    start(async () => {
      const res = await fn();
      setPending(false);
      if (!res.ok) setError(res.error);
      else onDone();
    });
  }

  return { error, pending, run, clear: () => setError(null) };
}
