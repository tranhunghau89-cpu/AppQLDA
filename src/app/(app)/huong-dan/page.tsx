import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { isValidRole } from "@/lib/rbac";
import { CAC_PHAN, docKhoaPhan, htmlPhan, phanMacDinh } from "./phan";
import styles from "./soTay.module.css";

/**
 * Sổ tay hướng dẫn sử dụng, đọc ngay trong app.
 *
 * Ai đăng nhập cũng đọc được CẢ sổ tay, không lọc theo quyền: người kinh doanh cần biết
 * vật tư làm gì với dự toán của mình, và bảng "Ai được làm gì" chỉ có ích khi thấy đủ.
 * Nhưng mỗi lần chỉ mở MỘT phần (tab "Chung" hoặc một phòng ban, theo `?phong=`) để sổ
 * tay không dài như một cuốn sách; vào không chọn thì mở sẵn phần của vai trò mình.
 */
export default async function HuongDanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireSession();
  const vaiTro = isValidRole(session.role) ? session.role : null;
  const dangMo = docKhoaPhan((await searchParams).phong) ?? phanMacDinh(vaiTro);

  return (
    <div className="mx-auto max-w-6xl">
      <nav className={styles.cacTab} aria-label="Phần của sổ tay">
        {CAC_PHAN.map((p) => (
          <Link
            key={p.khoa}
            href={`/huong-dan?phong=${p.khoa}`}
            className={p.khoa === dangMo ? styles.tabMo : undefined}
            aria-current={p.khoa === dangMo ? "page" : undefined}
          >
            {p.ten}
            {p.vaiTro && p.vaiTro === vaiTro && <span className={styles.cuaBan}>của bạn</span>}
          </Link>
        ))}
      </nav>
      {/* HTML tĩnh do dự án viết (xem noiDung.ts) — không chứa dữ liệu người dùng. */}
      <div className={styles.goc} dangerouslySetInnerHTML={{ __html: htmlPhan(dangMo) }} />
    </div>
  );
}
