"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";
import { doiMatKhau } from "./actions";

export function DoiMatKhauForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await doiMatKhau(new FormData(e.currentTarget));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Mật khẩu hiện tại">
        <Input name="cu" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Mật khẩu mới (tối thiểu 6 ký tự)">
        <Input name="moi" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Field label="Nhập lại mật khẩu mới">
        <Input name="nhapLai" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Đang lưu…" : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}
