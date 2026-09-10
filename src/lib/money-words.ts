// Đọc số tiền thành chữ tiếng Việt — báo giá và hợp đồng in ra luôn phải có dòng
// "Bằng chữ:". Hàm THUẦN, không phụ thuộc gì, nên test được đầy đủ.

const CHU_SO = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** Hàng của ba nhóm dưới tỷ. Phần từ tỷ trở lên xử lý riêng — xem `docTienVietNam`. */
const HANG = ["", "nghìn", "triệu"];

const TY = 1_000_000_000;

/**
 * Đọc một nhóm 3 chữ số.
 *
 * `dayDu` = nhóm này đứng SAU một nhóm khác, nên phải đọc đủ cả chữ số 0 ở đầu:
 * 1.000.005 là "một triệu không trăm linh năm", không phải "một triệu năm".
 */
export function docBaSo(n: number, dayDu: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donVi = n % 10;
  const ra: string[] = [];

  if (tram > 0 || dayDu) ra.push(CHU_SO[tram], "trăm");

  if (chuc === 0) {
    // "linh" chỉ xuất hiện khi có hàng trăm đứng trước.
    if (donVi > 0 && (tram > 0 || dayDu)) ra.push("linh", CHU_SO[donVi]);
    else if (donVi > 0) ra.push(CHU_SO[donVi]);
  } else if (chuc === 1) {
    ra.push("mười");
    if (donVi === 5) ra.push("lăm");
    else if (donVi > 0) ra.push(CHU_SO[donVi]);
  } else {
    ra.push(CHU_SO[chuc], "mươi");
    // Ba biến âm bắt buộc của tiếng Việt: 21 "mốt", 24 "tư", 25 "lăm".
    if (donVi === 1) ra.push("mốt");
    else if (donVi === 4) ra.push("tư");
    else if (donVi === 5) ra.push("lăm");
    else if (donVi > 0) ra.push(CHU_SO[donVi]);
  }

  return ra.join(" ");
}

/**
 * Đọc một số nguyên nhỏ hơn một tỷ.
 *
 * `coPhanTruoc` = phía trước đã có chữ (ví dụ phần "tỷ"), nên nhóm đầu cũng phải đọc
 * đủ: 1.000.000.005 là "một tỷ không trăm linh năm".
 */
export function docDuoiTy(n: number, coPhanTruoc: boolean): string {
  const nhom: number[] = [];
  let x = n;
  while (x > 0) {
    nhom.push(x % 1000);
    x = Math.floor(x / 1000);
  }

  const phan: string[] = [];
  for (let i = nhom.length - 1; i >= 0; i--) {
    // Nhóm toàn số 0 thì bỏ hẳn: 1.000.000 là "một triệu", không phải
    // "một triệu không trăm không nghìn".
    if (nhom[i] === 0) continue;
    const doc = docBaSo(nhom[i], i < nhom.length - 1 || coPhanTruoc);
    phan.push(HANG[i] ? `${doc} ${HANG[i]}` : doc);
  }
  return phan.join(" ");
}

/**
 * Đọc số tiền thành chữ, viết hoa chữ đầu, kết thúc bằng "đồng".
 *
 * Làm tròn tới đồng — hợp đồng không ghi số lẻ dưới đồng, và để số thập phân lọt vào
 * dòng "bằng chữ" thì còn khó hiểu hơn là làm tròn.
 *
 * Điểm dễ sai: từ tỷ trở lên KHÔNG chia tiếp thành "nghìn tỷ", "triệu tỷ". Tiếng Việt
 * gộp toàn bộ phần trên 10⁹ thành một con số rồi mới đọc "tỷ" — 1.500.000.000.000 là
 * "một nghìn năm trăm tỷ", không phải "một nghìn tỷ năm trăm tỷ".
 */
export function docTienVietNam(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";

  const am = n < 0;
  const x = Math.round(Math.abs(n));
  if (x === 0) return "Không đồng";
  // Trên mức này Number đã mất chính xác từng đồng, đọc ra chữ là nói dối.
  if (x > Number.MAX_SAFE_INTEGER) return "";

  const soTy = Math.floor(x / TY);
  const con = x % TY;

  const phan: string[] = [];
  if (soTy > 0) phan.push(`${docDuoiTy(soTy, false)} tỷ`);
  if (con > 0) phan.push(docDuoiTy(con, soTy > 0));

  const s = phan.join(" ").replace(/\s+/g, " ").trim();
  const hoa = s.charAt(0).toUpperCase() + s.slice(1);
  return am ? `Âm ${s} đồng` : `${hoa} đồng`;
}
