import { requireSession } from "@/lib/auth";
import { ROLE_LABEL, isValidRole, type Role } from "@/lib/rbac";
import { NOI_DUNG_SO_TAY } from "./noiDung";
import styles from "./soTay.module.css";

/** Phần của từng vai trò trong sổ tay — neo `id` trong noiDung.ts. */
const PHAN_THEO_VAI_TRO: Record<Role, string> = {
  ADMIN: "#bgd",
  SALES: "#kd",
  ENGINEERING: "#kt",
  PROCUREMENT: "#vt",
  ACCOUNTING: "#ke-toan",
};

/**
 * Sổ tay hướng dẫn sử dụng, đọc ngay trong app.
 *
 * Ai đăng nhập cũng đọc được CẢ sổ tay, không lọc theo quyền: người kinh doanh cần biết
 * vật tư làm gì với dự toán của mình, và bảng "Ai được làm gì" chỉ có ích khi thấy đủ.
 * Chỉ thêm một lối tắt tới đúng phần của phòng người đang xem.
 */
export default async function HuongDanPage() {
  const session = await requireSession();
  const vaiTro = isValidRole(session.role) ? session.role : null;

  return (
    <div className="mx-auto max-w-6xl">
      {vaiTro && (
        <p className={styles.phanCuaBan}>
          <span>Bạn đang đăng nhập với vai trò {ROLE_LABEL[vaiTro]}.</span>
          <a href={PHAN_THEO_VAI_TRO[vaiTro]}>Tới phần hướng dẫn của bạn →</a>
        </p>
      )}
      {/* HTML tĩnh do dự án viết (xem noiDung.ts) — không chứa dữ liệu người dùng. */}
      <div className={styles.goc} dangerouslySetInnerHTML={{ __html: NOI_DUNG_SO_TAY }} />
    </div>
  );
}
