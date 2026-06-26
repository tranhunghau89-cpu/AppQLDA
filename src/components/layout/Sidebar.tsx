"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarRange,
  Calculator,
  FileSignature,
  ShoppingCart,
  Wallet,
  Receipt,
  Building2,
  Truck,
  Users,
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
  { href: "/weekly", label: "Tiến độ tuần", icon: CalendarRange, resource: "progress" },
  { href: "/estimates", label: "Dự toán & chi phí", icon: Calculator, resource: "estimate" },
  { href: "/contracts", label: "Hợp đồng & Báo giá", icon: FileSignature, resource: "contract" },
  { href: "/purchases", label: "Đơn hàng & Mua hàng", icon: ShoppingCart, resource: "purchase" },
  { href: "/quotes", label: "Đơn giá & Báo giá", icon: Receipt, resource: "quote" },
  { href: "/costs", label: "Tổng hợp chi phí", icon: Wallet, resource: "cost" },
  { href: "/customers", label: "Chủ đầu tư", icon: Building2, resource: "customer" },
  { href: "/suppliers", label: "Nhà cung cấp", icon: Truck, resource: "supplier" },
  { href: "/users", label: "Người dùng", icon: Users, resource: "user" },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
          QL
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">QLDA Thép</div>
          <div className="text-xs text-slate-400">Kết cấu thép</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
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
