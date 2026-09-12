import { parseViNumber } from "./utils";

/**
 * Ô số nhận cả CÔNG THỨC: gõ "=20*50" ra 1000.
 *
 * Bóc khối lượng là nhân chia suốt ngày — 12 gian × 6 m, 20 tấm × 1,2 m² — và người lập
 * đang phải mở máy tính bên cạnh rồi chép kết quả sang. Chép là chỗ sinh lỗi, và khi
 * nhìn lại bảng thì không ai biết 1.000 kia từ đâu ra.
 *
 * TỰ VIẾT BỘ PHÂN TÍCH, KHÔNG DÙNG `eval` hay `new Function`. Chuỗi này đi thẳng từ ô
 * nhập của người dùng tới máy chủ; `eval` ở đó là mở cửa cho bất kỳ mã nào chạy trong
 * tiến trình máy chủ. Bốn phép tính và cặp ngoặc thì viết tay hết ba chục dòng.
 *
 * QUY ƯỚC SỐ GIỐNG HỆT PHẦN CÒN LẠI CỦA APP: dấu chấm là phân cách nghìn, dấu phẩy là
 * thập phân. "=20.580*2" ra 41.160 chứ không phải 41,16. Cho công thức chạy theo quy
 * ước khác với ô nhập thường là cách chắc chắn để sinh ra một sai số nghìn lần.
 */

type Token = { loai: "so"; gt: number } | { loai: "dau"; gt: string };

const DAU_NHAN: Record<string, string> = { "×": "*", x: "*", "÷": "/", ":": "/" };

function tachToken(s: string): Token[] | null {
  const tk: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const n = parseViNumber(s.slice(i, j));
      if (n == null) return null;
      tk.push({ loai: "so", gt: n });
      i = j;
      continue;
    }
    const dau = DAU_NHAN[c] ?? c;
    if ("+-*/()".includes(dau)) {
      tk.push({ loai: "dau", gt: dau });
      i++;
      continue;
    }
    return null; // ký tự lạ — thà từ chối còn hơn đoán
  }
  return tk;
}

/**
 * Phân tích đệ quy xuống: biểu thức → hạng tử → đơn nguyên → nguyên tố.
 *
 * Trả `null` ở bất kỳ chỗ nào sai cú pháp. Không có thông báo lỗi chi tiết: giao diện
 * chỉ cần biết "chưa ra số" để thôi hiện kết quả, còn người gõ nhìn công thức của mình
 * là thấy ngay thiếu ngoặc ở đâu.
 */
function phanTich(tk: readonly Token[]): number | null {
  let vt = 0;

  const nhin = () => tk[vt];
  const an = (dau: string) => {
    const t = nhin();
    if (t && t.loai === "dau" && t.gt === dau) {
      vt++;
      return true;
    }
    return false;
  };

  function nguyenTo(): number | null {
    if (an("(")) {
      const v = bieuThuc();
      if (v == null || !an(")")) return null;
      return v;
    }
    const t = nhin();
    if (!t || t.loai !== "so") return null;
    vt++;
    return t.gt;
  }

  function donNguyen(): number | null {
    if (an("-")) {
      const v = donNguyen();
      return v == null ? null : -v;
    }
    if (an("+")) return donNguyen();
    return nguyenTo();
  }

  function hangTu(): number | null {
    let v = donNguyen();
    if (v == null) return null;
    for (;;) {
      if (an("*")) {
        const r = donNguyen();
        if (r == null) return null;
        v *= r;
      } else if (an("/")) {
        const r = donNguyen();
        // Chia cho 0 trả null chứ không trả Infinity: một ô khối lượng bằng vô cực
        // sẽ đi thẳng vào phép nhân thành tiền.
        if (r == null || r === 0) return null;
        v /= r;
      } else return v;
    }
  }

  function bieuThuc(): number | null {
    let v = hangTu();
    if (v == null) return null;
    for (;;) {
      if (an("+")) {
        const r = hangTu();
        if (r == null) return null;
        v += r;
      } else if (an("-")) {
        const r = hangTu();
        if (r == null) return null;
        v -= r;
      } else return v;
    }
  }

  const kq = bieuThuc();
  // Còn token thừa nghĩa là cú pháp sai ("2 3", "5)"), không phải "tính xong phần đầu".
  if (kq == null || vt !== tk.length) return null;
  return Number.isFinite(kq) ? kq : null;
}

/** Chuỗi này có phải một công thức không — để giao diện biết lúc nào hiện kết quả. */
export function laCongThuc(tho: string | null | undefined): boolean {
  return (tho ?? "").trim().startsWith("=");
}

/**
 * Đọc một ô số: công thức nếu bắt đầu bằng "=", còn lại là số thường.
 *
 * `null` = rỗng hoặc không đọc được. Chỗ gọi phải phân biệt hai trường hợp đó bằng
 * `laCongThuc` nếu cần báo lỗi khác nhau.
 */
export function tinhBieuThuc(tho: string | number | null | undefined): number | null {
  if (typeof tho === "number") return Number.isFinite(tho) ? tho : null;
  const s = (tho ?? "").trim();
  if (!s) return null;
  if (!s.startsWith("=")) return parseViNumber(s);
  const tk = tachToken(s.slice(1));
  if (tk == null || tk.length === 0) return null;
  return phanTich(tk);
}
