"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { tuGanDonHang } from "@/lib/donHang/tuGan";

export type KetQua =
  { ok: true; soDong: number; soMonGan: number } | { ok: false; error: string };

/**
 * Ghép một lượt các TÊN dự toán thi công gõ tay ("Bulong liên kết", "Xà gồ"…) với công
 * tác Thư viện đơn giá, áp cho MỌI dự án.
 *
 * Chỉ ghi `congTacId` — giữ nguyên tên, đơn giá, khối lượng của dự toán cũ: nối nguồn
 * không được làm đổi số tiền của dự án đang chạy. Muốn lấy giá thư viện thì dùng nút
 * "Đối chiếu thư viện" trong từng dự toán, nơi người dùng xem trước từng dòng.
 *
 * Dòng do hệ thống tính (`layTuThamSo`: vận chuyển, lắp dựng theo kg thép) và dòng đã
 * nối thì không đụng. Xong thì tự gắn món đơn hàng cùng công tác ở các dự án bị ảnh hưởng.
 */
export async function apGhepTen(
  cap: { ten: string; congTacId: string }[],
): Promise<KetQua> {
  const s = await getSession();
  if (
    !s ||
    !can(s.role as Role, "thuVien", "edit") ||
    !can(s.role as Role, "estimate", "edit")
  ) {
    return {
      ok: false,
      error: "Cần quyền sửa thư viện và dự toán để ghép cho mọi dự án.",
    };
  }
  const hopLe = cap.filter((c) => c.ten.trim() && c.congTacId);
  if (hopLe.length === 0)
    return { ok: false, error: "Chưa chọn công tác cho tên nào." };
  const ct = await db.congTac.findMany({
    where: {
      id: { in: [...new Set(hopLe.map((c) => c.congTacId))] },
      active: true,
    },
    select: { id: true },
  });
  const conDung = new Set(ct.map((c) => c.id));

  let soDong = 0;
  const duAn = new Set<string>();
  for (const c of hopLe) {
    if (!conDung.has(c.congTacId)) continue;
    const where = { name: c.ten, congTacId: null, layTuThamSo: null };
    const ds = await db.estimateItem.findMany({
      where,
      select: { projectId: true },
    });
    if (ds.length === 0) continue;
    const r = await db.estimateItem.updateMany({
      where,
      data: { congTacId: c.congTacId },
    });
    soDong += r.count;
    for (const d of ds) duAn.add(d.projectId);
  }
  let soMonGan = 0;
  for (const p of duAn) {
    soMonGan += await tuGanDonHang(p);
    revalidatePath(`/projects/${p}/estimate`);
    revalidatePath(`/projects/${p}/purchase`);
  }
  revalidatePath("/thu-vien/ghep-ten");
  return { ok: true, soDong, soMonGan };
}
