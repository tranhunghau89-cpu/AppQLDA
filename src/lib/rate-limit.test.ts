import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkLimit,
  clearLimit,
  clientIp,
  recordFailure,
  resetAllLimits,
} from "./rate-limit";

const OPTS = { max: 3, windowMs: 60_000, blockMs: 60_000 };

beforeEach(() => {
  resetAllLimits();
  vi.useRealTimers();
});

describe("checkLimit / recordFailure", () => {
  it("khóa mới thì không bị chặn", () => {
    expect(checkLimit("k")).toEqual({ blocked: false, retryAfter: 0 });
  });

  it("chưa đủ số lần sai thì chưa chặn", () => {
    expect(recordFailure("k", OPTS).blocked).toBe(false);
    expect(recordFailure("k", OPTS).blocked).toBe(false);
    expect(checkLimit("k").blocked).toBe(false);
  });

  it("đủ số lần sai thì chặn và báo thời gian còn lại", () => {
    recordFailure("k", OPTS);
    recordFailure("k", OPTS);
    const r = recordFailure("k", OPTS);
    expect(r.blocked).toBe(true);
    expect(r.retryAfter).toBe(60);
    expect(checkLimit("k").blocked).toBe(true);
  });

  it("các khóa khác nhau đếm độc lập", () => {
    recordFailure("a", OPTS);
    recordFailure("a", OPTS);
    recordFailure("a", OPTS);
    expect(checkLimit("a").blocked).toBe(true);
    expect(checkLimit("b").blocked).toBe(false);
  });

  it("đăng nhập thành công xóa bộ đếm", () => {
    recordFailure("k", OPTS);
    recordFailure("k", OPTS);
    clearLimit("k");
    expect(recordFailure("k", OPTS).blocked).toBe(false);
    expect(recordFailure("k", OPTS).blocked).toBe(false);
    expect(checkLimit("k").blocked).toBe(false);
  });

  it("hết thời gian chặn thì mở lại", () => {
    vi.useFakeTimers();
    recordFailure("k", OPTS);
    recordFailure("k", OPTS);
    recordFailure("k", OPTS);
    expect(checkLimit("k").blocked).toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(checkLimit("k").blocked).toBe(false);
  });

  it("số lần sai rải rác ngoài cửa sổ thời gian không cộng dồn", () => {
    vi.useFakeTimers();
    recordFailure("k", OPTS);
    recordFailure("k", OPTS);
    vi.advanceTimersByTime(61_000); // quá windowMs -> bộ đếm reset
    expect(recordFailure("k", OPTS).blocked).toBe(false);
    expect(checkLimit("k").blocked).toBe(false);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });

  it("lấy IP đầu tiên trong x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("rơi về x-real-ip khi không có x-forwarded-for", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("không có header nào -> unknown", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
