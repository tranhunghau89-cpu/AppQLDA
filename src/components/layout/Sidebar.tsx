"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  CalendarRange,
  GanttChart,
  Ruler,
  CheckCheck,
  Calculator,
  FileSignature,
  FileText,
  ShoppingCart,
  Wallet,
  Receipt,
  HandCoins,
  Building2,
  UserSearch,
  Truck,
  Users,
  LayoutTemplate,
  History,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Role, type Resource } from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  resource?: Resource; // nếu có, lọc theo quyền view
}

const NAV: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/projects", label: "Dự án", icon: FolderKanban, resource: "project" },
  { href: "/weekly", label: "Tiến độ", icon: CalendarRange, resource: "progress" },
  { href: "/gantt", label: "Kế hoạch (Gantt)", icon: GanttChart, resource: "progress" },
  { href: "/estimates", label: "Dự toán & chi phí", icon: Calculator, resource: "estimate" },
  { href: "/contracts", label: "Hợp đồng & Báo giá", icon: FileSignature, resource: "contract" },
  { href: "/purchases", label: "Đơn hàng & Mua hàng", icon: ShoppingCart, resource: "purchase" },
  { href: "/quotes", label: "Đơn giá & Báo giá", icon: Receipt, resource: "quote" },
  { href: "/client-quotes", label: "Báo giá gửi khách", icon: FileText, resource: "quote" },
  { href: "/costs", label: "Tổng hợp chi phí", icon: Wallet, resource: "cost" },
  { href: "/debts", label: "Công nợ", icon: HandCoins, resource: "debt" },
  { href: "/reports", label: "Báo cáo theo kỳ", icon: BarChart3, resource: "cost" },
  { href: "/khach-hang", label: "Khách hàng (CRM)", icon: UserSearch, resource: "customer" },
  { href: "/customers", label: "Chủ đầu tư", icon: Building2, resource: "customer" },
  { href: "/suppliers", label: "Nhà cung cấp", icon: Truck, resource: "supplier" },
  { href: "/tools", label: "Tra cứu & Bóc KL", icon: Ruler },
  { href: "/approvals", label: "Phê duyệt", icon: CheckCheck },
  { href: "/estimate-templates", label: "Mẫu dự toán", icon: LayoutTemplate, resource: "template" },
  { href: "/quote-templates", label: "Mẫu báo giá", icon: LayoutTemplate, resource: "template" },
  { href: "/import", label: "Nhập từ Excel", icon: Upload, resource: "import" },
  { href: "/audit", label: "Nhật ký thay đổi", icon: History, resource: "audit" },
  { href: "/users", label: "Người dùng", icon: Users, resource: "user" },
];

export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: Role;
  /** Ngăn kéo đang mở (chỉ có tác dụng dưới lg). */
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      id="sidebar-chinh"
      aria-label="Điều hướng chính"
      className={cn(
        // Điện thoại/tablet: ngăn kéo trượt từ trái, nằm trên nội dung.
        "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "-translate-x-full",
        // Desktop: cột cố định như cũ, luôn hiện.
        "lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:translate-x-0"
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Xây Dựng Dubai" className="h-10 w-10 object-contain" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-bold text-blue-600">XÂY DỰNG DUBAI</div>
          <div className="text-[11px] text-slate-400">Trao giá trị vững bền</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng menu"
          className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.filter((i) => !i.resource || can(role, i.resource, "view")).map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
