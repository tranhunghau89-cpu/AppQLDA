// Khi nào thanh tải trang phải chạy — logic THUẦN, không đụng DOM.
//
// Người dùng bấm một nút rồi không thấy gì trong vài giây là bấm lại, hoặc tưởng app
// treo. Thanh tải trang trả lời đúng một câu: "đã nhận lệnh, đang làm". Hai hàm dưới
// đây quyết định sự kiện nào đáng trả lời câu đó.

export interface CuBamLienKet {
  href: string | null;
  target: string | null;
  coDownload: boolean;
  /** Nút chuột: 0 = trái. */
  nut: number;
  coPhimBoTro: boolean;
  /** URL đầy đủ của trang đang mở. */
  hienTai: string;
}

/**
 * Cú bấm này có đưa sang một trang KHÁC của chính app, trong cùng tab không.
 *
 * Bỏ qua: mở tab mới (target, Ctrl/⌘/Shift), tải file, liên kết ra ngoài, API (xuất
 * Excel là tải file chứ không đổi trang), và liên kết chỉ đổi phần # — những cú đó
 * không có trang nào để chờ, bật thanh lên là nó chạy mãi.
 */
export function laBamChuyenTrang(c: CuBamLienKet): boolean {
  if (!c.href || c.nut !== 0 || c.coPhimBoTro || c.coDownload) return false;
  if (c.target && c.target !== "_self") return false;
  let den: URL, tu: URL;
  try {
    tu = new URL(c.hienTai);
    den = new URL(c.href, tu);
  } catch {
    return false;
  }
  if (den.origin !== tu.origin) return false;
  if (den.protocol !== "http:" && den.protocol !== "https:") return false;
  if (den.pathname.startsWith("/api/")) return false;
  return den.pathname !== tu.pathname || den.search !== tu.search;
}

/**
 * Yêu cầu mạng này có phải việc người dùng đang CHỜ không.
 *
 * Next gửi hai loại yêu cầu đáng chờ, nhận ra bằng header của chính nó: tải dữ liệu trang
 * (`rsc`) và gọi server action (`next-action`, tức mọi nút Lưu/Xoá/Áp bộ…). Tải trước
 * ngầm (`next-router-prefetch`) thì KHÔNG — nó chạy khi liên kết vừa lọt vào màn hình,
 * người dùng chưa bấm gì cả.
 */
export function laYeuCauCanCho(headers: Record<string, string> | null | undefined): boolean {
  if (!headers) return false;
  const k = new Set(Object.keys(headers).map((x) => x.toLowerCase()));
  if (k.has("next-router-prefetch") || k.has("next-router-segment-prefetch")) return false;
  return k.has("rsc") || k.has("next-action");
}
