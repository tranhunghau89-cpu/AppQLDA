"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, getSession, hashPassword } from "@/lib/auth";
import { isValidRole } from "@/lib/rbac";

export type ActionResult = { ok: true } | { ok: false; error: string };

const base = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  name: z.string().trim().min(1, "Tên không được để trống"),
  role: z.string().refine(isValidRole, "Vai trò không hợp lệ"),
  active: z.boolean(),
  password: z.string().optional(),
});

function fields(form: FormData) {
  return {
    email: String(form.get("email") ?? ""),
    name: String(form.get("name") ?? ""),
    role: String(form.get("role") ?? "SALES"),
    active: form.get("active") === "on" || form.get("active") === "true",
    password: String(form.get("password") ?? ""),
  };
}

export async function saveUser(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("user", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền quản lý người dùng." };
  }

  const parsed = base.safeParse(fields(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    if (id) {
      const data: Record<string, unknown> = {
        email: d.email,
        name: d.name,
        role: d.role,
        active: d.active,
      };
      if (d.password && d.password.length > 0) {
        if (d.password.length < 6)
          return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự." };
        data.passwordHash = await hashPassword(d.password);
      }
      await db.user.update({ where: { id }, data });
    } else {
      if (!d.password || d.password.length < 6)
        return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự khi tạo mới." };
      await db.user.create({
        data: {
          email: d.email,
          name: d.name,
          role: d.role,
          active: d.active,
          passwordHash: await hashPassword(d.password),
        },
      });
    }
  } catch (e) {
    if (String(e).includes("Unique"))
      return { ok: false, error: `Email "${d.email}" đã tồn tại.` };
    return { ok: false, error: "Lỗi lưu người dùng." };
  }

  revalidatePath("/users");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  try {
    await requirePermission("user", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa người dùng." };
  }
  const me = await getSession();
  if (me?.userId === id)
    return { ok: false, error: "Không thể xóa tài khoản đang đăng nhập." };

  await db.user.delete({ where: { id } });
  revalidatePath("/users");
  return { ok: true };
}
