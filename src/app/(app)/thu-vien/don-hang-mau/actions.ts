"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Thư viện dùng chung toàn công ty — sửa cần quyền sửa thư viện. */
async function deny(): Promise<ActionResult | null> {
  const s = await getSession();
  if (!s || !can(s.role as Role, "thuVien", "edit")) {
    return { ok: false, error: "Chỉ người quản lý thư viện mới sửa được đơn hàng mẫu." };
  }
  return null;
}

export async function doiTenMau(mauId: string, ten: string): Promise<ActionResult> {
  const d = await deny();
  if (d) return d;
  const name = ten.trim();
  if (!name) return { ok: false, error: "Tên mẫu không được để trống." };
  await db.purchaseOrderTemplate.updateMany({ where: { id: mauId }, data: { name } });
  revalidatePath("/thu-vien/don-hang-mau");
  return { ok: true };
}

export async function xoaMau(mauId: string): Promise<ActionResult> {
  const d = await deny();
  if (d) return d;
  await db.purchaseOrderTemplate.deleteMany({ where: { id: mauId } });
  revalidatePath("/thu-vien/don-hang-mau");
  return { ok: true };
}

/** Xoá một số dòng của mẫu — một dòng, cả một quy cách hoặc cả một nhóm. */
export async function xoaDongMau(mauId: string, itemIds: string[]): Promise<ActionResult> {
  const d = await deny();
  if (d) return d;
  // Prisma bỏ qua điều kiện undefined — chặn trước để không lỡ xoá rộng.
  const ids = (Array.isArray(itemIds) ? itemIds : []).filter(
    (x): x is string => typeof x === "string" && x.length > 0
  );
  if (typeof mauId !== "string" || !mauId) return { ok: false, error: "Thiếu mã mẫu." };
  if (ids.length === 0) return { ok: false, error: "Chưa chọn dòng cần xoá." };
  await db.purchaseOrderTemplateItem.deleteMany({
    where: { templateId: mauId, id: { in: ids } },
  });
  revalidatePath("/thu-vien/don-hang-mau");
  return { ok: true };
}
