// Phần auth phía server (Node runtime): bcrypt + đọc cookie qua next/headers.
import "server-only";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { canAccessProject } from "./scope";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionUser,
} from "./session";
import type { Role, Resource, Action } from "./rbac";
import { can, isValidRole } from "./rbac";

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

/** Chỉ đọc + verify chữ ký cookie, chưa đối chiếu DB. */
async function readSessionCookie(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Phiên đăng nhập đã đối chiếu với DB: tài khoản còn hoạt động và `tokenVersion`
 * khớp. Nhờ vậy khóa tài khoản / đổi mật khẩu / đổi vai trò có hiệu lực NGAY,
 * không phải chờ token 7 ngày hết hạn. Vai trò luôn lấy từ DB, không tin token.
 *
 * `cache()` gộp lời gọi trong cùng một request (layout + page + action) thành 1 truy vấn.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await readSessionCookie();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { active: true, role: true, name: true, tokenVersion: true },
  });
  if (!user || !user.active) return null;
  if (user.tokenVersion !== session.tokenVersion) return null;

  return {
    ...session,
    name: user.name,
    role: isValidRole(user.role) ? user.role : "SALES",
    tokenVersion: user.tokenVersion,
  };
});

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

/** Dùng đầu Server Component của 1 trang: thiếu quyền xem -> đẩy về dashboard. */
export async function requireView(resource: Resource): Promise<SessionUser> {
  const session = await requireSession();
  if (!can(session.role as Role, resource, "view")) redirect("/");
  return session;
}

/**
 * Trang chi tiết thuộc 1 dự án: cần quyền xem theo vai trò VÀ dự án nằm trong phạm vi được giao.
 * Ngoài phạm vi -> 404 (không tiết lộ dự án có tồn tại hay không).
 */
export async function requireProjectView(
  resource: Resource,
  projectId: string
): Promise<SessionUser> {
  const session = await requireView(resource);
  if (!(await canAccessProject(session, projectId))) notFound();
  return session;
}

/**
 * Server Action ghi dữ liệu của 1 dự án: cần quyền sửa theo vai trò VÀ dự án trong phạm vi.
 * Thiếu -> ném lỗi (các action bọc trong try/catch và trả về ActionResult).
 */
export async function requireProjectPermission(
  resource: Resource,
  action: Action,
  projectId: string
): Promise<SessionUser> {
  const session = await requirePermission(resource, action);
  if (!(await canAccessProject(session, projectId))) {
    throw new Error(OUT_OF_SCOPE);
  }
  return session;
}

export const OUT_OF_SCOPE = "Bạn không được phân công dự án này.";

/**
 * Kiểm tra quyền + phạm vi dự án cho Server Action, KHÔNG ném lỗi.
 * Trả về `null` khi hợp lệ; ngược lại trả về ActionResult lỗi để action `return` thẳng.
 *
 *   const denied = await denyProject("project", "edit", projectId, "Bạn không có quyền gán NCC.");
 *   if (denied) return denied;
 */
export async function denyProject(
  resource: Resource,
  action: Action,
  projectId: string,
  fallback: string
): Promise<{ ok: false; error: string } | null> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  if (!can(session.role as Role, resource, action)) return { ok: false, error: fallback };
  if (!(await canAccessProject(session, projectId))) {
    return { ok: false, error: OUT_OF_SCOPE };
  }
  return null;
}
