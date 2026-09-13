import Link from "next/link";
import { can, type Resource, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Thanh tab ở đầu những trang đã GỘP chung một mục menu.
 *
 * Menu gọn lại bằng cách để hai trang cùng chung một lối vào — "Tiến độ" mở ra bảng theo
 * tuần, và từ đó sang được Gantt. Thanh tab này là cái cầu nối: không có nó thì gộp menu
 * là GIẤU mất một trang.
 *
 * Đường dẫn của từng trang giữ nguyên, nên bookmark và liên kết cũ vẫn chạy.
 *
 * Mỗi bộ tab khai ở đây MỘT lần và menu bên trái đọc lại chính nó (`Sidebar.tsx`), để
 * "trang nào thuộc mục nào" không bị khai hai nơi rồi lệch nhau.
 */

export interface MucTab {
  href: string;
  label: string;
  resource: Resource;
}

export const TAB_CHAO_GIA: readonly MucTab[] = [
  { href: "/quotes", label: "Dự toán", resource: "quote" },
  { href: "/client-quotes", label: "Báo giá gửi khách", resource: "quote" },
];

export const TAB_TIEN_DO: readonly MucTab[] = [
  { href: "/weekly", label: "Theo tuần", resource: "progress" },
  { href: "/gantt", label: "Gantt", resource: "progress" },
];

export const TAB_CHI_PHI: readonly MucTab[] = [
  { href: "/costs", label: "Tổng hợp", resource: "cost" },
  { href: "/reports", label: "Theo kỳ", resource: "cost" },
];

export function TabTrang({
  tabs,
  hienTai,
  role,
}: {
  tabs: readonly MucTab[];
  /** href của trang đang mở — so khớp đúng, không theo tiền tố. */
  hienTai: string;
  role: string;
}) {
  // Lọc theo quyền dù các cặp hiện tại cùng quyền: một tab bấm vào báo "không có quyền"
  // là lỗi dễ lọt khi ai đó gộp thêm một cặp khác quyền về sau.
  const hien = tabs.filter((t) => can(role as Role, t.resource, "view"));
  // Chỉ còn một tab thì thanh tab chỉ là một nút tự trỏ về chính nó.
  if (hien.length < 2) return null;

  return (
    // mb-3 chứ không phải lề âm: Tailwind v4 dựng space-y bằng lề DƯỚI của phần tử phía
    // trên, nên lề âm ở đây đè mất khoảng cách và tiêu đề trang dính lên vạch tab.
    <nav aria-label="Chế độ xem" className="mb-3 flex gap-1 border-b border-slate-200">
      {hien.map((t) => {
        const dangMo = t.href === hienTai;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={dangMo ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              dangMo
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
