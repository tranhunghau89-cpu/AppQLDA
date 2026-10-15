"use server";

import { db } from "@/lib/db";
import { createSession, hashPassword, requireSession, verifyPassword } from "@/lib/auth";

export type DoiMatKhauResult = { ok: true } | { ok: false; error: string };

export async function doiMatKhau(form: FormData): Promise<DoiMatKhauResult> {
  const session = await requireSession();
  const cu = String(form.get("cu") ?? "");
  const moi = String(form.get("moi") ?? "");
  const nhapLai = String(form.get("nhapLai") ?? "");

  if (moi.length < 6) return { ok: false, error: "Mật khẩu mới tối thiểu 6 ký tự." };
  if (moi !== nhapLai) return { ok: false, error: "Nhập lại mật khẩu mới không khớp." };
  if (moi === cu) return { ok: false, error: "Mật khẩu mới phải khác mật khẩu hiện tại." };

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await verifyPassword(cu, user.passwordHash)))
    return { ok: false, error: "Mật khẩu hiện tại không đúng." };

  // Tăng tokenVersion để đăng xuất các thiết bị khác, rồi cấp lại phiên cho thiết bị này.
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(moi),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
  await createSession({ ...session, tokenVersion: updated.tokenVersion });
  return { ok: true };
}
