import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { isValidRole } from "@/lib/rbac";
import { checkLimit, clearLimit, clientIp, recordFailure } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const BAD_CREDENTIALS = "Email hoặc mật khẩu không đúng";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Chặn dò mật khẩu: đếm theo IP và theo email để không thể né bằng cách đổi
  // email (cùng IP) hay đổi IP (cùng email).
  const ipKey = `ip:${clientIp(req)}`;
  const emailKey = `email:${email.toLowerCase()}`;
  for (const key of [ipKey, emailKey]) {
    const limit = checkLimit(key);
    if (limit.blocked) {
      return NextResponse.json(
        {
          error: `Bạn đã thử sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(
            limit.retryAfter / 60
          )} phút.`,
        },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    recordFailure(ipKey);
    recordFailure(emailKey);
    console.warn(`[auth] đăng nhập thất bại: ${email} từ ${clientIp(req)}`);
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
  }

  clearLimit(ipKey);
  clearLimit(emailKey);

  const role = isValidRole(user.role) ? user.role : "SALES";
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    tokenVersion: user.tokenVersion,
  });

  return NextResponse.json({ ok: true });
}
