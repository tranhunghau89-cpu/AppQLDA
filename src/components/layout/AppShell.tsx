"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ConfirmProvider } from "@/components/ui/confirm";
import { ToastProvider } from "@/components/ui/toast";
import type { Role } from "@/lib/rbac";

/**
 * Khung ứng dụng — giữ trạng thái mở/đóng của sidebar.
 *
 * < lg : sidebar là ngăn kéo trượt từ trái, mở bằng nút ☰ trên Topbar; trang cuộn
 *        tự nhiên (không khóa chiều cao) để dùng được trên điện thoại.
 * ≥ lg : sidebar cố định bên trái như cũ, Topbar dính trên đầu.
 */
export function AppShell({
  role,
  name,
  children,
}: {
  role: Role;
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Lưu trang lúc mở ngăn kéo thay vì một cờ boolean: chuyển trang là `open` tự
  // thành false, không cần effect đồng bộ (tránh render dây chuyền).
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (v: boolean) => setOpenedAt(v ? pathname : null);

  // Esc để đóng + khóa cuộn nền khi ngăn kéo đang mở.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppFrame open={open} setOpen={setOpen} role={role} name={name}>
          {children}
        </AppFrame>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppFrame({
  open,
  setOpen,
  role,
  name,
  children,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  role: Role;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full bg-slate-50">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar role={role} open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={name} role={role} onOpenMenu={() => setOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
