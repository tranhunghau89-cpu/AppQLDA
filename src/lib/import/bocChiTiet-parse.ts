// Bóc tách bảng khối lượng chi tiết — phần THUẦN, không chạm DB và không "server-only",
// nên chạy được cả trong test lẫn script kiểm tra ngoài Next. Phần đọc file + ghi DB
// nằm ở bocChiTiet.ts.
//
// Phòng kỹ thuật gửi hai loại bảng, và cả hai đều phải đọc được:
//
//   KẾT CẤU — thống kê xuất từ bản vẽ. Một dòng là một mã cấu kiện:
//     AC1.1 · 12 cái · PL6*700 · Cot · dài 6336 · 12,77 m²/cái · 351,91 kg/cái · SS400
//
//   TÔN — bảng bóc tấm theo trục. Một dòng là một cỡ tấm, gom dưới các dòng tiêu đề trục:
//     I. TRỤC Y1, Y5   →   V1.1 · dài 3.170 · 112 tấm
//
// KHÔNG ĐỌC THEO VỊ TRÍ CỘT CỐ ĐỊNH. Hai mẫu này do người soạn tay, và cột bị chèn thêm
// là chuyện thường. Dò theo NHÃN ở dòng tiêu đề, rồi mới đọc dữ liệu bên dưới.
import { norm, num, text, type SheetLike } from "./cells";

export type { SheetLike };

export type LoaiBang = "KET_CAU" | "TON";

export interface DongBoc {
  /** Nhóm hiển thị: tiêu đề trục của bảng tôn, hoặc tên cấu kiện của bảng kết cấu. */
  nhom: string | null;
  maSo: string | null;
  quyCach: string | null;
  tenCauKien: string | null;
  soLuong: number | null;
  /** mm */
  dai: number | null;
  /** kg mỗi cái */
  klDon: number | null;
  /** m² mỗi cái */
  dienTichDon: number | null;
  vatTu: string | null;
  ghiChu: string | null;
}

export interface KetQuaBocChiTiet {
  loai: LoaiBang | null;
  /** Dòng tiêu đề của bảng — "NX_K26L56" hoặc "K26L56". */
  tenCongTrinh: string | null;
  /** "TÔN VÁCH" — bảng kết cấu không có. */
  hangMuc: string | null;
  diaDiem: string | null;
  dong: DongBoc[];
  canhBao: string[];
}

/** Bao nhiêu dòng đầu được quét để tìm dòng tiêu đề. Đủ rộng cho khối thông tin trên. */
const QUET_TIEU_DE = 30;

/** Ô trống thì trả null thay vì chuỗi rỗng — DB nên giữ null, không giữ "". */
const chu = (v: unknown): string | null => {
  const t = text(v as never);
  return t === "" ? null : t;
};

/**
 * Dò cột theo nhãn ở dòng tiêu đề.
 *
 * So bằng `norm` (bỏ dấu, bỏ khoảng trắng, thường hoá) vì cùng một cột được viết
 * "Chiều dài (mm)", "CHIEU DAI", "Chiều Dài" tuỳ file.
 */
function doCot(
  ws: SheetLike,
  dongTieuDe: number,
  soCot: number
): Map<string, number> {
  const m = new Map<string, number>();
  for (let c = 1; c <= soCot; c++) {
    const n = norm(text(ws.getCell(dongTieuDe, c).value));
    if (n && !m.has(n)) m.set(n, c);
  }
  return m;
}

/** Cột đầu tiên khớp một trong các nhãn. */
function cot(m: Map<string, number>, ...nhan: string[]): number | null {
  for (const n of nhan) {
    const c = m.get(n);
    if (c != null) return c;
  }
  // Khớp chứa: "chieudaimm" chứa "chieudai".
  for (const n of nhan) {
    for (const [k, c] of m) if (k.includes(n)) return c;
  }
  return null;
}

interface TieuDe {
  loai: LoaiBang;
  dong: number;
  cot: Map<string, number>;
}

/**
 * Tìm dòng tiêu đề và nhận ra đây là bảng loại nào.
 *
 * Nhận dạng bằng TỔ HỢP nhãn chứ không bằng một nhãn: "SL" một mình xuất hiện ở đủ thứ
 * bảng, còn "STT + chiều dài + SL" thì chỉ có ở bảng bóc tôn.
 */
function timTieuDe(ws: SheetLike): TieuDe | null {
  const soCot = ws.columnCount ?? 20;
  const het = Math.min(ws.rowCount, QUET_TIEU_DE);
  for (let r = 1; r <= het; r++) {
    const m = doCot(ws, r, soCot);
    const co = (...n: string[]) => n.every((x) => cot(m, x) != null);

    if (co("maso", "quicach") && (cot(m, "kldon") != null || cot(m, "tongkl") != null)) {
      return { loai: "KET_CAU", dong: r, cot: m };
    }
    if (co("stt", "chieudai", "sl")) {
      return { loai: "TON", dong: r, cot: m };
    }
  }
  return null;
}

/** Giá trị của ô ngay bên phải ô mang nhãn này, trong khối thông tin đầu bảng. */
function ganNhan(ws: SheetLike, nhan: string, denDong: number): string | null {
  const soCot = ws.columnCount ?? 20;
  for (let r = 1; r <= denDong; r++) {
    for (let c = 1; c <= soCot; c++) {
      if (!norm(text(ws.getCell(r, c).value)).startsWith(nhan)) continue;
      for (let k = c + 1; k <= soCot; k++) {
        const v = chu(ws.getCell(r, k).value);
        if (v) return v;
      }
    }
  }
  return null;
}

/** Dòng "Tổng cộng" ở cuối bảng — đọc tiếp là cộng đôi. */
function laDongTong(s: string): boolean {
  const n = norm(s);
  return n.startsWith("tongcong") || n === "tong" || n.startsWith("congtong");
}

/**
 * Dòng tiêu đề nhóm của bảng tôn: "I. TRỤC Y1, Y5" — có chữ nhưng không có số lượng.
 *
 * Nhận bằng "không có số" chứ bằng chữ "trục": người soạn có thể gom theo "MÁI TRƯỚC",
 * "TƯỜNG HỒI" thay vì theo trục, mà vẫn là cùng một vai trò.
 */
function laDongNhom(ten: string | null, soLuong: number | null, dai: number | null): boolean {
  return !!ten && soLuong == null && dai == null;
}

export function bocBangChiTiet(ws: SheetLike): KetQuaBocChiTiet {
  const canhBao: string[] = [];
  const td = timTieuDe(ws);
  if (!td) {
    return {
      loai: null,
      tenCongTrinh: null,
      hangMuc: null,
      diaDiem: null,
      dong: [],
      canhBao: [
        "Không nhận ra bảng này. Cần một dòng tiêu đề có “Mã Số + Qui Cách + KL Đơn” " +
          "(bảng thống kê kết cấu) hoặc “STT + Chiều dài + SL” (bảng bóc tôn).",
      ],
    };
  }

  const tenCongTrinh = ganNhan(ws, "congtrinh", td.dong) ?? ganNhan(ws, "tenct", td.dong);
  const hangMuc = ganNhan(ws, "hangmuc", td.dong);
  const diaDiem = ganNhan(ws, "diadiem", td.dong);

  const dong: DongBoc[] =
    td.loai === "KET_CAU" ? bocKetCau(ws, td, canhBao) : bocTon(ws, td, canhBao);

  if (dong.length === 0) canhBao.push("Không đọc được dòng dữ liệu nào dưới dòng tiêu đề.");

  return { loai: td.loai, tenCongTrinh, hangMuc, diaDiem, dong, canhBao };
}

function bocKetCau(ws: SheetLike, td: TieuDe, canhBao: string[]): DongBoc[] {
  const c = td.cot;
  const cMaSo = cot(c, "maso")!;
  const cSl = cot(c, "soluong", "sl");
  const cQuyCach = cot(c, "quicach", "quycach");
  const cTen = cot(c, "tencaukien", "caukien");
  const cDai = cot(c, "dai", "chieudai");
  // "Diện Tích" là của MỘT cái, "Tổng DT" là của cả dòng — lấy nhầm là nhân hai lần.
  const cDt = cot(c, "dientich");
  const cKl = cot(c, "kldon");
  const cVatTu = cot(c, "vattu");
  const cGhiChu = cot(c, "ghichu", "mabv");

  if (cSl == null) canhBao.push("Không thấy cột số lượng — mọi dòng sẽ thiếu số lượng.");
  if (cKl == null) canhBao.push("Không thấy cột “KL Đơn” — đầu mục tính theo kg sẽ không cộng được.");

  const ds: DongBoc[] = [];
  for (let r = td.dong + 1; r <= ws.rowCount; r++) {
    const maSo = chu(ws.getCell(r, cMaSo).value);
    const soLuong = cSl == null ? null : num(ws.getCell(r, cSl).value);
    if (!maSo && soLuong == null) continue; // dòng trống xen giữa
    if (maSo && laDongTong(maSo)) break;

    ds.push({
      // Bảng kết cấu gom theo TÊN CẤU KIỆN: Cot, Keo, GiangDoc, ChongLat.
      nhom: cTen == null ? null : chu(ws.getCell(r, cTen).value),
      maSo,
      quyCach: cQuyCach == null ? null : chu(ws.getCell(r, cQuyCach).value),
      tenCauKien: cTen == null ? null : chu(ws.getCell(r, cTen).value),
      soLuong,
      dai: cDai == null ? null : num(ws.getCell(r, cDai).value),
      klDon: cKl == null ? null : num(ws.getCell(r, cKl).value),
      dienTichDon: cDt == null ? null : num(ws.getCell(r, cDt).value),
      vatTu: cVatTu == null ? null : chu(ws.getCell(r, cVatTu).value),
      ghiChu: cGhiChu == null ? null : chu(ws.getCell(r, cGhiChu).value),
    });
  }
  return ds;
}

function bocTon(ws: SheetLike, td: TieuDe, canhBao: string[]): DongBoc[] {
  const c = td.cot;
  const cTen = cot(c, "tenhangquycach", "tenhang", "quycach");
  const cDai = cot(c, "chieudai");
  const cSl = cot(c, "sl", "soluong");
  const cGhiChu = cot(c, "ghichu");

  if (cTen == null) {
    canhBao.push("Không thấy cột “Tên hàng, quy cách”.");
    return [];
  }
  if (cSl == null) canhBao.push("Không thấy cột SL — mọi dòng sẽ thiếu số lượng.");

  /**
   * Dòng chữ đỏ ngay trên bảng mô tả quy cách của TOÀN bộ bảng ("TÔN … DÀY 0.4MM, CÁN
   * 09 SÓNG…"). Ghi lại vào từng dòng: lặp một chuỗi 27 lần rẻ hơn nhiều so với một
   * bảng chi tiết mà nhìn vào không biết đang bóc loại tôn nào.
   */
  let quyCachChung: string | null = null;
  let nhom: string | null = null;
  const ds: DongBoc[] = [];

  for (let r = td.dong + 1; r <= ws.rowCount; r++) {
    const ten = chu(ws.getCell(r, cTen).value);
    const soLuong = cSl == null ? null : num(ws.getCell(r, cSl).value);
    const dai = cDai == null ? null : num(ws.getCell(r, cDai).value);
    if (!ten && soLuong == null && dai == null) continue;
    if (ten && laDongTong(ten)) break;

    if (laDongNhom(ten, soLuong, dai)) {
      // Dòng chữ đầu tiên trước khi có nhóm nào là dòng quy cách chung.
      if (quyCachChung == null && ds.length === 0 && nhom == null && norm(ten!).includes("day"))
        quyCachChung = ten;
      else nhom = ten;
      continue;
    }

    ds.push({
      nhom,
      maSo: ten,
      quyCach: quyCachChung,
      tenCauKien: null,
      soLuong,
      dai,
      klDon: null,
      dienTichDon: null,
      vatTu: null,
      ghiChu: cGhiChu == null ? null : chu(ws.getCell(r, cGhiChu).value),
    });
  }
  return ds;
}
