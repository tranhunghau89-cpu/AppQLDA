import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { isValidRole } from "@/lib/rbac";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Email hoặc mật khẩu không đúng" },
      { status: 401 }
    );
  }

  const role = isValidRole(user.role) ? user.role : "SALES";
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
  });

  return NextResponse.json({ ok: true });
}
