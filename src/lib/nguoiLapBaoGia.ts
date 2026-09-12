// Thông tin người phụ trách in trên bản báo giá gửi khách, lấy từ TÀI KHOẢN.
import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

export interface ThongTinNguoiLap {
  salesName: string;
  salesPhone: string | null;
  salesEmail: string;
}

/**
 * Ba dòng "Người phụ trách / SĐT / Email" của người đang lập báo giá.
 *
 * Gom về một chỗ vì có tới ba đường tạo bản gửi khách (sinh từ dự toán, tạo từ cơ hội,
 * tạo tay) — và trước đây đường "sinh từ dự toán" quên gán cả ba, nên mọi bản sinh ra
 * từ đó đều hiện "còn 3 ô chưa điền" và người lập phải gõ lại từng bản.
 *
 * Tên và email có sẵn trong phiên; số điện thoại phải hỏi cơ sở dữ liệu vì phiên đăng
 * nhập không mang nó. Chưa khai số thì trả null — bản in thiếu dòng SĐT, và quản trị
 * viên điền số vào tài khoản là mọi bản sau tự có.
 */
export async function thongTinNguoiLap(
  actor: SessionUser
): Promise<ThongTinNguoiLap> {
  const u = await db.user.findUnique({
    where: { id: actor.userId },
    select: { phone: true },
  });
  return {
    salesName: actor.name,
    salesPhone: u?.phone?.trim() || null,
    salesEmail: actor.email,
  };
}
