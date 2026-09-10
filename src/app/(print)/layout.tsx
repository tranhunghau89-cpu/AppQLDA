/**
 * Bố cục cho các trang in — cố ý KHÔNG dùng AppShell.
 *
 * Sidebar, thanh trên, nút thêm nhanh đều vô nghĩa trên giấy; bọc chúng lại rồi ẩn
 * bằng CSS in thì vẫn phải tải và dựng cả cây đó. Ở ngoài nhóm `(app)` thì trang in
 * gọn hẳn, mà vẫn được `proxy.ts` chặn đăng nhập và từng trang tự gọi
 * `requireProjectView` để kiểm tra quyền theo dự án.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 print:bg-white">{children}</div>;
}
