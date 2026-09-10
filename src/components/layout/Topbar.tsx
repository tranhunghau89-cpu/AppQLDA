import { LogOut, Menu } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { GlobalSearch } from "./GlobalSearch";

export function Topbar({
  name,
  role,
  onOpenMenu,
}: {
  name: string;
  role: Role;
  /** Mở ngăn kéo điều hướng — chỉ hiện dưới lg. */
  onOpenMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Mở menu"
        aria-controls="sidebar-chinh"
        className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Ô tìm kiếm đứng riêng bên trái để trên điện thoại nó không bị đẩy khỏi màn
          hình khi tên người dùng dài. */}
      <div className="min-w-0">
        <GlobalSearch />
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4">
        <div className="hidden min-w-0 text-right leading-tight sm:block">
          <div className="truncate text-sm font-medium text-slate-900">{name}</div>
          <div className="truncate text-xs text-slate-400">{ROLE_LABEL[role]}</div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            aria-label="Đăng xuất"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-slate-100 sm:px-3"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </form>
      </div>
    </header>
  );
}
