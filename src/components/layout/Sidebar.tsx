"use client";

import { useSyncExternalStore } from "react";
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
  ChevronDown,
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
  Library,
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
  /** Đường dẫn khác cũng thuộc mục này — trang con không có mục riêng trên menu. */
  khopThem?: string[];
}

interface NavGroup {
  /** Tên nhóm; `null` = mục đứng một mình trên đầu, không có tiêu đề, không gập. */
  ten: string | null;
  items: NavItem[];
}

/**
 * Menu chia theo NHỊP LÀM VIỆC, không theo tên bảng dữ liệu: bán hàng trước hợp đồng,
 * thi công sau hợp đồng, tiền bạc, rồi những thứ tra cứu và ít khi động tới.
 *
 * Hai mươi hai mục xếp phẳng thì không ai đọc — mắt chỉ quét được một danh sách ngắn.
 */
const NAV: NavGroup[] = [
  {
    ten: null,
    items: [{ href: "/", label: "Tổng quan", icon: LayoutDashboard }],
  },
  {
    ten: "Bán hàng",
    items: [
      {
        href: "/khach-hang",
        label: "Khách hàng (CRM)",
        icon: UserSearch,
        resource: "customer",
        // Trang dự toán/báo giá của một cơ hội nằm dưới /co-hoi nhưng vẫn là việc
        // của khu này — không đánh dấu thì vào đó menu trông như không ở đâu cả.
        khopThem: ["/co-hoi"],
      },
      { href: "/quotes", label: "Dự toán chào giá", icon: Receipt, resource: "quote" },
      { href: "/client-quotes", label: "Báo giá gửi khách", icon: FileText, resource: "quote" },
    ],
  },
  {
    ten: "Dự án",
    items: [
      { href: "/projects", label: "Dự án", icon: FolderKanban, resource: "project" },
      { href: "/weekly", label: "Tiến độ", icon: CalendarRange, resource: "progress" },
      { href: "/gantt", label: "Kế hoạch (Gantt)", icon: GanttChart, resource: "progress" },
      { href: "/approvals", label: "Phê duyệt", icon: CheckCheck },
    ],
  },
  {
    ten: "Chi phí & hợp đồng",
    items: [
      { href: "/estimates", label: "Dự toán thi công & chi phí", icon: Calculator, resource: "estimate" },
      { href: "/contracts", label: "Hợp đồng & Báo giá", icon: FileSignature, resource: "contract" },
      { href: "/purchases", label: "Đơn hàng & Mua hàng", icon: ShoppingCart, resource: "purchase" },
      { href: "/costs", label: "Tổng hợp chi phí", icon: Wallet, resource: "cost" },
      { href: "/debts", label: "Công nợ", icon: HandCoins, resource: "debt" },
      { href: "/reports", label: "Báo cáo theo kỳ", icon: BarChart3, resource: "cost" },
    ],
  },
  {
    ten: "Danh mục",
    items: [
      {
        href: "/thu-vien",
        label: "Thư viện đơn giá",
        icon: Library,
        resource: "thuVien",
      },
      { href: "/customers", label: "Chủ đầu tư", icon: Building2, resource: "customer" },
      { href: "/suppliers", label: "Nhà cung cấp", icon: Truck, resource: "supplier" },
      { href: "/tools", label: "Tra cứu & Bóc KL", icon: Ruler },
      {
        href: "/estimate-templates",
        label: "Mẫu dự toán",
        icon: LayoutTemplate,
        resource: "template",
      },
      {
        href: "/quote-templates",
        label: "Mẫu báo giá",
        icon: LayoutTemplate,
        resource: "template",
      },
    ],
  },
  {
    ten: "Hệ thống",
    items: [
      { href: "/import", label: "Nhập từ Excel", icon: Upload, resource: "import" },
      { href: "/audit", label: "Nhật ký thay đổi", icon: History, resource: "audit" },
      { href: "/users", label: "Người dùng", icon: Users, resource: "user" },
    ],
  },
];

const KHOA_LUU = "qlda:nhom-menu-dong";

// Nhóm nào đang gập — chỉ là tiện nghi của riêng máy người xem, nên để ở localStorage.
//
// Đọc qua `useSyncExternalStore` chứ không phải `useEffect` + `setState`: máy chủ không
// có localStorage, mà lần dựng đầu tiên ở trình duyệt phải giống hệt máy chủ. Kho nhỏ
// dưới đây lo đúng việc đó, và giữ NGUYÊN tham chiếu khi chuỗi lưu không đổi — trả về
// Set mới mỗi lần đọc là vòng dựng lại vô tận.
const RONG: ReadonlySet<string> = new Set<string>();
let chuoiCu: string | null = null;
let setCu: ReadonlySet<string> = RONG;
const nguoiNghe = new Set<() => void>();

function docNhomDong(): ReadonlySet<string> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KHOA_LUU);
  } catch {
    // Trình duyệt chặn lưu trữ (cửa sổ ẩn danh, chặn site data) — coi như mở hết.
  }
  if (raw !== chuoiCu) {
    chuoiCu = raw;
    try {
      const m = raw ? (JSON.parse(raw) as unknown) : [];
      setCu = Array.isArray(m) ? new Set(m.filter((x) => typeof x === "string")) : RONG;
    } catch {
      setCu = RONG;
    }
  }
  return setCu;
}

function theoDoi(fn: () => void): () => void {
  nguoiNghe.add(fn);
  return () => nguoiNghe.delete(fn);
}

function ghiNhomDong(sau: ReadonlySet<string>) {
  const json = JSON.stringify([...sau]);
  try {
    window.localStorage.setItem(KHOA_LUU, json);
    chuoiCu = json;
  } catch {
    // Không ghi được thì vẫn gập trong phiên này; để chuoiCu khớp cái đọc lên (null)
    // để lần đọc sau không phân tích lại và trả về Set khác.
    chuoiCu = null;
  }
  setCu = sau;
  for (const fn of nguoiNghe) fn();
}

function dangO(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  const duongDan = [item.href, ...(item.khopThem ?? [])];
  return duongDan.some((p) => pathname.startsWith(p));
}

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
  // Lần dựng ở máy chủ: chưa gập nhóm nào. Trình duyệt đọc tiếp từ localStorage.
  const dong = useSyncExternalStore(theoDoi, docNhomDong, () => RONG);

  function gap(ten: string) {
    const sau = new Set(dong);
    if (sau.has(ten)) sau.delete(ten);
    else sau.add(ten);
    ghiNhomDong(sau);
  }

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

      <nav className="flex-1 overflow-y-auto p-3">
        {NAV.map((nhom) => {
          const items = nhom.items.filter((i) => !i.resource || can(role, i.resource, "view"));
          // Cả nhóm bị quyền lọc sạch thì bỏ luôn tiêu đề — không để lại tiêu đề trống.
          if (items.length === 0) return null;

          const coTrangDangXem = items.some((i) => dangO(pathname, i));
          // Nhóm chứa trang đang xem luôn mở, kể cả khi người dùng đã gập nó: gập rồi
          // bấm sang trang trong đó mà menu vẫn đóng thì trông như mình lạc chỗ nào.
          const moRong = nhom.ten === null || coTrangDangXem || !dong.has(nhom.ten);
          const idND = `nhom-${nhom.ten ?? "dau"}`;

          return (
            <div key={nhom.ten ?? "dau"} className="mb-1">
              {nhom.ten && (
                <button
                  type="button"
                  onClick={() => gap(nhom.ten!)}
                  aria-expanded={moRong}
                  aria-controls={idND}
                  className="mt-3 flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      moRong ? "" : "-rotate-90"
                    )}
                    aria-hidden="true"
                  />
                  {nhom.ten}
                </button>
              )}

              <div id={idND} hidden={!moRong} className="space-y-1">
                {items.map((item) => {
                  const active = dangO(pathname, item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
