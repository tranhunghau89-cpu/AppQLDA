// Giới hạn số lần thử theo khóa (IP / email) — chống dò mật khẩu tự động.
//
// Lưu trong bộ nhớ tiến trình: đơn giản, không cần hạ tầng thêm. Hạn chế: mỗi
// instance serverless đếm riêng và bộ đếm mất khi instance bị thu hồi. Với app
// nội bộ vài chục người dùng, mức này đủ để chặn dò tự động; nếu sau này cần
// chắc chắn hơn thì chuyển sang bảng DB hoặc Redis.
import "server-only";

interface Bucket {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();

/** Dọn các bucket đã hết hạn để Map không phình vô hạn. */
function sweep(now: number, windowMs: number) {
  for (const [k, b] of buckets) {
    if (b.blockedUntil <= now && now - b.firstAt > windowMs) buckets.delete(k);
  }
}

export interface RateLimitResult {
  /** true nếu đang bị chặn — KHÔNG xử lý request. */
  blocked: boolean;
  /** Số giây còn lại của lệnh chặn (0 nếu không bị chặn). */
  retryAfter: number;
}

/**
 * Kiểm tra khóa `key` có đang bị chặn không. Chỉ đọc, không tăng bộ đếm —
 * gọi trước khi xử lý; gọi `recordFailure` sau khi biết là thất bại.
 */
export function checkLimit(key: string): RateLimitResult {
  const b = buckets.get(key);
  const now = Date.now();
  if (b && b.blockedUntil > now) {
    return { blocked: true, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  return { blocked: false, retryAfter: 0 };
}

/**
 * Ghi nhận 1 lần thất bại. Quá `max` lần trong `windowMs` -> chặn `blockMs`.
 * Trả về trạng thái sau khi ghi nhận.
 */
export function recordFailure(
  key: string,
  { max = 10, windowMs = 15 * 60_000, blockMs = 15 * 60_000 } = {}
): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  let b = buckets.get(key);
  if (!b || now - b.firstAt > windowMs) {
    b = { count: 0, firstAt: now, blockedUntil: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count >= max) {
    b.blockedUntil = now + blockMs;
    b.count = 0;
    b.firstAt = now;
    return { blocked: true, retryAfter: Math.ceil(blockMs / 1000) };
  }
  return { blocked: false, retryAfter: 0 };
}

/** Xóa bộ đếm sau khi đăng nhập thành công. */
export function clearLimit(key: string): void {
  buckets.delete(key);
}

/** Dùng cho test: xóa toàn bộ trạng thái. */
export function resetAllLimits(): void {
  buckets.clear();
}

/** Lấy IP client từ header proxy (Vercel đặt x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
