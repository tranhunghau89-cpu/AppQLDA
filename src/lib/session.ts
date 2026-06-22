// Phần session edge-safe: chỉ dùng jose (chạy được trong middleware/Edge).
// KHÔNG import next/headers hay bcrypt ở đây.
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./rbac";

export const SESSION_COOKIE = "qlda_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET chưa được cấu hình");
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE;
