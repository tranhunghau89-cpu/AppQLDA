import { tinhBieuThuc } from "@/lib/bieuThuc";

/**
 * Khối lượng theo CÔNG THỨC THAM CHIẾU DÒNG trong dự toán thi công: "Lắp phụ kiện" =
 * [6.1] + [7.1] + [8.1] (máng + diềm + ống). Logic THUẦN, không đụng Prisma.
 *
 * Người dùng gõ theo SỐ THỨ TỰ đang hiện ("6.1" = nhóm 6, dòng 1 của hạng mục), nhưng
 * lưu theo ID dòng: "[@ckx…]". Số thứ tự đổi mỗi khi chèn, xoá, kéo dòng; lưu số thứ tự
 * thì thêm một dòng vào nhóm 3 là mọi công thức phía dưới trỏ lệch mà không ai hay.
 * Hiển thị thì dịch ngược id → số thứ tự hiện tại.
 *
 * Phạm vi tham chiếu là MỘT hạng mục — số thứ tự lặp lại giữa các hạng mục.
 */

const THAM_CHIEU_MA = /\[\s*(\d+(?:\.\d+)?)\s*\]/g;
const THAM_CHIEU_ID = /\[@([A-Za-z0-9_-]+)\]/g;

export const coThamChieuMa = (s: string) => /\[\s*\d+(?:\.\d+)?\s*\]/.test(s);
export const coThamChieuId = (s: string | null | undefined) => !!s && /\[@[A-Za-z0-9_-]+\]/.test(s);

/** "=[6.1]+[7.1]" → "=[@id1]+[@id2]". Mã không có trong hạng mục thì báo lỗi, không đoán. */
export function maSangId(
  tho: string,
  maToiId: ReadonlyMap<string, string>
): { ok: true; congThuc: string } | { ok: false; error: string } {
  const thieu: string[] = [];
  const congThuc = tho.trim().replace(THAM_CHIEU_MA, (_, ma: string) => {
    const id = maToiId.get(ma);
    if (!id) {
      thieu.push(ma);
      return "[?]";
    }
    return `[@${id}]`;
  });
  if (thieu.length) return { ok: false, error: `Không có dòng ${thieu.join(", ")} trong hạng mục này.` };
  return { ok: true, congThuc: congThuc.startsWith("=") ? congThuc : `=${congThuc}` };
}

/** "=[@id1]+[@id2]" → "=[6.1]+[7.1]" theo số thứ tự hiện tại; dòng đã xoá hiện "[?]". */
export function idSangMa(congThuc: string, idToiMa: ReadonlyMap<string, string>): string {
  return congThuc.replace(THAM_CHIEU_ID, (_, id: string) => `[${idToiMa.get(id) ?? "?"}]`);
}

export function idThamChieu(congThuc: string): string[] {
  return [...congThuc.matchAll(THAM_CHIEU_ID)].map((m) => m[1]);
}

/** Số theo quy ước của `tinhBieuThuc`: phẩy thập phân, không dấu nghìn. */
const soVN = (v: number) => {
  const s = (Math.round(v * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, "");
  return s.replace(".", ",");
};

/**
 * Tính công thức với KL hiện tại của các dòng được tham chiếu. Dòng tham chiếu chưa có KL
 * tính là 0; dòng đã bị xoá thì trả null — con số thiếu một vế là con số sai.
 */
export function tinhCongThucDong(
  congThuc: string,
  klTheoId: ReadonlyMap<string, number | null>
): number | null {
  let mat = false;
  const bt = congThuc.replace(THAM_CHIEU_ID, (_, id: string) => {
    if (!klTheoId.has(id)) {
      mat = true;
      return "0";
    }
    return soVN(klTheoId.get(id) ?? 0);
  });
  if (mat) return null;
  return tinhBieuThuc(bt.startsWith("=") ? bt : `=${bt}`);
}

/**
 * Công thức có vòng (A dùng B, B dùng A, hoặc dùng chính nó) không? Kiểm lúc LƯU để vòng
 * không bao giờ vào được CSDL — phép tính lại sau đó khỏi phải phòng.
 */
export function coVong(
  idDong: string,
  congThucMoi: string,
  congThucKhac: ReadonlyMap<string, string>
): boolean {
  const theo = new Map(congThucKhac);
  theo.set(idDong, congThucMoi);
  const dangDi = new Set<string>();
  const xong = new Set<string>();
  const di = (id: string): boolean => {
    if (dangDi.has(id)) return true;
    if (xong.has(id)) return false;
    dangDi.add(id);
    for (const t of idThamChieu(theo.get(id) ?? "")) if (di(t)) return true;
    dangDi.delete(id);
    xong.add(id);
    return false;
  };
  return di(idDong);
}
