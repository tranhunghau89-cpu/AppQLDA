"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarRange,
  CheckCheck,
  Calculator,
  ChevronDown,
  FileSignature,
  ShoppingCart,
  Wallet,
  Receipt,
  HandCoins,
  Building2,
  UserSearch,
  Users,
  Library,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Role, type Resource } from "@/lib/rbac";
import { laTrangChaoGia } from "@/lib/duongDanChaoGia";
import {
  TAB_CHAO_GIA,
  TAB_CHI_PHI,
  TAB_DOI_TAC,
  TAB_TIEN_DO,
  TAB_TIEN_ICH,
  tabDuocXem,
  type MucTab,
} from "./TabTrang";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  resource?: Resource; // nếu có, lọc theo quyền view
  /** Đường dẫn khác cũng thuộc mục này — trang con không có mục riêng trên menu. */
  khopThem?: string[];
  /**
   * Mục này GIÀNH lấy những trang mà hàm này nhận — thắng mọi khớp theo tiền tố của mục
   * khác. Dành cho trang nằm dưới đường dẫn của một mục nhưng thuộc về mục khác.
   */
  gianh?: (pathname: string) => boolean;
  /**
   * Mục gộp: các trang con, mỗi trang một quyền. Mục hiện khi xem được ÍT NHẤT một trang,
   * và bấm vào mở trang đầu tiên người này được xem — không mở một trang báo thiếu quyền.
   */
  tabs?: readonly MucTab[];
}

interface NavGroup {
  /** Tên nhóm; `null` = mục đứng một mình trên đầu, không có tiêu đề, không gập. */
  ten: string | null;
  items: NavItem[];
}

/**
 * Menu chia theo NHỊP LÀM VIỆC, không theo tên bảng dữ liệu: bán hàng trước hợp đồng,
 * thi công và tiền bạc sau hợp đồng, rồi những thứ tra cứu và ít khi động tới.
 *
 * Mắt chỉ quét được một danh sách ngắn. Nên những trang là HAI CÁCH NHÌN cùng một việc
 * dùng chung một mục, chuyển qua lại bằng tab ở đầu trang (`TabTrang`):
 *   Chào giá          = dự toán chào giá · báo giá gửi khách
 *   Tiến độ           = theo tuần · Gantt
 *   Chi phí & báo cáo = tổng hợp · theo kỳ
 *   Chủ đầu tư & NCC  = chủ đầu tư · nhà cung cấp
 *   Tiện ích          = tra cứu & bóc KL · nhập từ Excel · nhật ký thay đổi
 * và Bộ hạng mục chuẩn không còn mục riêng vì Thư viện đơn giá đã có lối vào nó.
 *
 * Mục gộp mở tab ĐẦU TIÊN người dùng được xem và khớp thêm các tab còn lại — đọc từ chính bộ tab, để
 * menu và thanh tab không bao giờ nói hai điều khác nhau.
 */
const mucGop = (tabs: readonly MucTab[]) => ({
  href: tabs[0].href,
  khopThem: tabs.slice(1).map((t) => t.href),
  tabs,
});

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
      // Dự toán chào giá và báo giá gửi khách của từng dự án/cơ hội mang đường dẫn
      // /projects/… và /co-hoi/…, nhưng thuộc về mục này chứ không phải "Dự án".
      { ...mucGop(TAB_CHAO_GIA), label: "Chào giá", icon: Receipt, gianh: laTrangChaoGia },
    ],
  },
  {
    ten: "Thi công",
    items: [
      { href: "/projects", label: "Dự án", icon: FolderKanban, resource: "project" },
      { ...mucGop(TAB_TIEN_DO), label: "Tiến độ", icon: CalendarRange },
      { href: "/approvals", label: "Phê duyệt", icon: CheckCheck },
      { href: "/estimates", label: "Dự toán thi công & chi phí", icon: Calculator, resource: "estimate" },
      { href: "/contracts", label: "Hợp đồng & Báo giá", icon: FileSignature, resource: "contract" },
      { href: "/purchases", label: "Đơn hàng & Mua hàng", icon: ShoppingCart, resource: "purchase" },
      { ...mucGop(TAB_CHI_PHI), label: "Chi phí & báo cáo", icon: Wallet },
      { href: "/debts", label: "Công nợ", icon: HandCoins, resource: "debt" },
    ],
  },
  {
    ten: "Danh mục & hệ thống",
    items: [
      {
        href: "/thu-vien",
        label: "Thư viện đơn giá",
        icon: Library,
        resource: "thuVien",
        // /thu-vien/* (vật tư, khu vực, bộ hạng mục) đã khớp theo tiền tố. Hai đường dẫn
        // mẫu cũ đã gộp vào Bộ hạng mục; giữ để bookmark cũ vẫn sáng đúng mục.
        khopThem: ["/estimate-templates", "/quote-templates"],
      },
      { ...mucGop(TAB_DOI_TAC), label: "Chủ đầu tư & NCC", icon: Building2 },
      { ...mucGop(TAB_TIEN_ICH), label: "Tiện ích", icon: Wrench },
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
  // Trang đã có mục khác giành thì chỉ mục đó sáng.
  const mucGianh = NAV.flatMap((n) => n.items).find((i) => i.gianh?.(pathname));
  if (mucGianh) return mucGianh === item;
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
          const items = nhom.items.flatMap((i): NavItem[] => {
            if (i.tabs) {
              const hien = tabDuocXem(i.tabs, role);
              if (hien.length === 0) return [];
              return [{ ...i, href: hien[0].href }];
            }
            return !i.resource || can(role, i.resource, "view") ? [i] : [];
          });
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
