import { LogOut } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/rbac";

export function Topbar({ name, role }: { name: string; role: Role }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium text-slate-900">{name}</div>
          <div className="text-xs text-slate-400">{ROLE_LABEL[role]}</div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </form>
      </div>
    </header>
  );
}
