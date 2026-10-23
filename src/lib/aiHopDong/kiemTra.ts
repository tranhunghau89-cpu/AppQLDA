// Kiểm tra bản nháp hợp đồng sau khi AI đọc (plan/34 mục 4). Hàm THUẦN.
//
// Đây là chỗ bắt lỗi chính: AI đọc nhầm một chữ số thì chính nó không biết, nhưng con
// số sai sẽ không cộng/nhân ra khớp với các con số khác trên cùng hợp đồng. Màn duyệt
// chạy lại hàm này mỗi lần người dùng sửa, nên nó nhận BẢN NHÁP chứ không nhận kết quả AI.
import { lineAmount } from "@/lib/contract";
import { docTienVietNam } from "@/lib/money-words";
import { norm } from "@/lib/text";
import type { BanNhapHopDong } from "./chuanHoa";

/** do = chặn nút Ghi tới khi người dùng xác nhận; vang = chỉ nhắc. */
export type MucDo = "do" | "vang";

export interface CanhBao {
  /** Khoá ô trên form: "signDate", "hangMuc.2.amount", "dot.1.phanTram"... */
  truong: string;
  mucDo: MucDo;
  noiDung: string;
}

export interface NguCanhKiemTra {
  /** Số HĐ đã có trong dự án này. */
  soHopDongDaCo: string[];
  /** Từ khoá nhận ra công ty mình trong tên Bên B, vd ["dubai"]. */
  tuKhoaCongTy: string[];
  homNay: Date;
}

/**
 * Sai số chấp nhận khi so hai số tiền. Hợp đồng làm tròn tới đồng ở từng dòng nên tổng
 * có thể lệch vài đồng; lệch quá 1.000đ thì gần như chắc là đọc sai chữ số.
 */
export const SAI_SO_DONG = 1_000;

const lech = (a: number, b: number) => Math.abs(a - b) > SAI_SO_DONG;

const tien = (n: number) => Math.round(n).toLocaleString("vi-VN");

/**
 * Đưa câu "bằng chữ" về dạng so được: bỏ dấu, bỏ chữ thừa, và gộp các cách đọc tương
 * đương — "lăm"/"năm", "tư"/"bốn", "lẻ"/"linh", "ngàn"/"nghìn". (Sau khi bỏ dấu thì
 * "mốt"/"một" và "mươi"/"mười" đã tự trùng nhau.)
 */
export function chuanHoaBangChu(s: string): string {
  const DONG_NGHIA: Record<string, string> = { lam: "nam", tu: "bon", le: "linh", ngan: "nghin" };
  const BO = new Set(["bang", "chu", "dong", "chan", "vnd"]);
  return s
    // "Việt Nam đồng": bỏ cả cụm trước khi tách từ, không thì chữ "nam" thành số 5.
    .replace(/vi[eệ]t\s*nam/gi, " ")
    .split(/[\s,.:;()–-]+/)
    .map((w) => norm(w))
    .filter((w) => w && !BO.has(w))
    .map((w) => DONG_NGHIA[w] ?? w)
    .join(" ");
}

/** Câu bằng chữ có khớp với một trong các số tiền không. */
export function bangChuKhop(bangChu: string, cacSo: (number | null)[]): boolean {
  const c = chuanHoaBangChu(bangChu);
  return cacSo.some((n) => n != null && chuanHoaBangChu(docTienVietNam(n)) === c);
}

export function kiemTraHopDong(b: BanNhapHopDong, ng: NguCanhKiemTra): CanhBao[] {
  const ra: CanhBao[] = [];
  const them = (truong: string, mucDo: MucDo, noiDung: string) => ra.push({ truong, mucDo, noiDung });
  const h = b.hopDong;

  // --- Trường bắt buộc khi ghi (contractSchema) ---
  if (!h.contractNo.trim()) them("contractNo", "vang", "Không đọc được số hợp đồng, cần nhập tay.");
  if (!h.subject.trim()) them("subject", "vang", "Không đọc được trích yếu (V/v), cần nhập tay.");
  if (!h.partyAName.trim()) them("partyAName", "vang", "Không đọc được tên Bên A, cần nhập tay.");

  // --- Từng dòng hạng mục ---
  b.hangMuc.forEach((d, i) => {
    const k = `hangMuc.${i}`;
    if (d.amount == null && (d.qty == null || d.unitPrice == null)) {
      them(`${k}.amount`, "do", `Dòng ${i + 1}: thiếu thành tiền, và thiếu khối lượng hoặc đơn giá để tính.`);
    } else if (d.amount != null && d.qty != null && d.unitPrice != null && lech(d.qty * d.unitPrice, d.amount)) {
      them(
        `${k}.amount`,
        "do",
        `Dòng ${i + 1}: KL × đơn giá = ${tien(d.qty * d.unitPrice)}, nhưng thành tiền ghi ${tien(d.amount)}.`
      );
    }
  });
  if (b.hangMucTuDong) {
    them("hangMuc", "vang", "Hợp đồng không có bảng hạng mục: đã tạo một dòng trọn gói bằng giá trị trước VAT.");
  }

  // --- Tổng, VAT, bằng chữ ---
  const tong = b.hangMuc.reduce((s, d) => s + lineAmount(d), 0);
  const { giaTriTruocVat: truoc, giaTriSauVat: sau, giaTriBangChu } = b.doiChieu;
  if (b.hangMuc.length > 0 && truoc != null && lech(tong, truoc)) {
    them("giaTriTruocVat", "do", `Cộng các hạng mục ra ${tien(tong)}, nhưng HĐ ghi giá trị trước VAT ${tien(truoc)}.`);
  }
  if (truoc != null && sau != null && h.vatPercent != null && lech(truoc * (1 + h.vatPercent / 100), sau)) {
    them(
      "giaTriSauVat",
      "do",
      `${tien(truoc)} + VAT ${h.vatPercent}% = ${tien(truoc * (1 + h.vatPercent / 100))}, nhưng HĐ ghi ${tien(sau)}.`
    );
  }
  if (giaTriBangChu && !bangChuKhop(giaTriBangChu, [sau, truoc, tong])) {
    them("giaTriBangChu", "do", `Số tiền bằng chữ "${giaTriBangChu}" không khớp với số tiền nào trên HĐ.`);
  }

  // --- Đợt thanh toán ---
  const dot = b.dotThanhToan;
  if (dot.length > 0 && dot.every((d) => d.phanTram != null)) {
    const pt = dot.reduce((s, d) => s + (d.phanTram ?? 0), 0);
    if (Math.abs(pt - 100) > 0.01) them("dot", "vang", `Các đợt thanh toán cộng lại ${pt}%, không phải 100%.`);
  }
  if (dot.length > 0 && dot.every((d) => d.soTien != null)) {
    const st = dot.reduce((s, d) => s + (d.soTien ?? 0), 0);
    if (![sau, truoc].some((v) => v != null && !lech(st, v))) {
      them("dot", "vang", `Các đợt thanh toán cộng lại ${tien(st)}, không khớp giá trị HĐ.`);
    }
  }

  // --- Ngày ---
  for (const k of b.ngayKhongHopLe) them(k, "do", "AI đọc ra một ngày không hợp lệ, cần nhập lại.");
  if (h.signDate && h.effectiveDate && h.effectiveDate < h.signDate) {
    them("effectiveDate", "vang", "Ngày hiệu lực trước ngày ký.");
  }
  const xa = new Date(ng.homNay.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  if (h.signDate && h.signDate > xa) them("signDate", "vang", "Ngày ký ở tương lai, kiểm lại năm.");

  // --- Các bên, trùng số ---
  const benB = b.doiChieu.tenBenB;
  if (benB && !ng.tuKhoaCongTy.some((t) => norm(benB).includes(norm(t)))) {
    them("tenBenB", "vang", `Bên B là "${benB}", không phải công ty mình — có thể là HĐ thầu phụ hoặc đảo bên.`);
  }
  if (h.contractNo && ng.soHopDongDaCo.some((s) => norm(s) === norm(h.contractNo))) {
    them("contractNo", "vang", `Dự án đã có hợp đồng số ${h.contractNo}. Ghi tiếp sẽ tạo thêm một HĐ trùng số.`);
  }

  // --- AI tự nhận không chắc ---
  for (const k of b.tinCayThap) them(k, "vang", "AI không chắc chỗ này (chữ mờ hoặc khó đọc), hãy đối chiếu file gốc.");

  return ra;
}
