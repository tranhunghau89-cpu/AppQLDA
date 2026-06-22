// Phần auth phía server (Node runtime): bcrypt + đọc cookie qua next/headers.
import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionUser,
} from "./session";
import type { Role, Resource, Action } from "./rbac";
import { can } from "./rbac";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Dùng trong Server Component/Action: bắt buộc đăng nhập. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Bắt buộc đăng nhập + có quyền; thiếu quyền -> ném lỗi (chặn ở server action). */
export async function requirePermission(
  resource: Resource,
  action: Action
): Promise<SessionUser> {
  const session = await requireSession();
  if (!can(session.role as Role, resource, action)) {
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
  }
  return session;
}
