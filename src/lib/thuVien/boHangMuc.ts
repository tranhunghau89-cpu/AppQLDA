// Dựng khung dự toán và khuôn bản gửi khách từ một bộ hạng mục — logic THUẦN,
// không đụng Prisma.
//
// Một bộ hạng mục mang HAI mặt trên cùng một "phần": mặt chi phí (các dòng công tác
// để tính giá vốn) và mặt gửi khách (một dòng hạng mục in cho chủ đầu tư). Hai hàm
// dưới đây bóc ra từng mặt.

import type { LineSeed } from "@/lib/quoteTemplate";
import { tinhKhoiLuongDanXuat } from "./danXuat";

/** Một phần trong bộ — vừa là khuôn QuoteSection, vừa là khuôn ClientQuoteLine. */
export interface PhanKhung {
  id: string;
  ma: string;
  ten: string;
  loai: string; // PHAN | SUB
  parentId: string | null;
  sortOrder: number;

  inChoKhach: boolean;
  partCode: string;
  partName: string;
  maKhach: string | null;
  tenKhachHang: string | null;
  moTaKhachHang: string | null;
  donViKhach: string | null;
  donGiaKhach: number | null;
  ghiChuKhach: string | null;
  tags: string[];
  steelFrameKey: string | null;
}

/** Một dòng công tác trong bộ. */
export interface DongKhung {
  id: string;
  phanId: string | null;
  congTacId: string | null;
  congTacVatTuId: string | null;
  maCongTac: string | null;
  ten: string;
  donVi: string | null;
  donGiaMacDinh: number | null;
  khoiLuongMacDinh: number | null;
  /** Khối lượng trên một đơn vị diện tích của phần chứa dòng này. */
  suatKhoiLuong: number | null;
  /** Dòng này nạp khối lượng vào tham số tên này (KCT_KG, TON_M2...). */
  napThamSo: string | null;
  /** Dòng này LẤY khối lượng từ tham số tên này — khác null là dòng dẫn xuất. */
  layTuThamSo: string | null;
  heSoQuyDoi: number | null;
  sortOrder: number;
}

export interface PhanDuToan {
  ma: string;
  ten: string;
  loai: string;
  /** Mã của phần cha; null = phần gốc. */
  maCha: string | null;
  sortOrder: number;
}

export interface DongDuToan {
  /** Mã phần chứa dòng này. */
  phanMa: string;
  congTacId: string | null;
  congTacVatTuId: string | null;
  maCongTac: string | null;
  ten: string;
  donVi: string | null;
  qty: number | null;
  donGia: number | null;
  /** Khối lượng trên một đơn vị diện tích của phần; null = không tỉ lệ diện tích. */
  suatKhoiLuong: number | null;
  napThamSo: string | null;
  layTuThamSo: string | null;
  heSoQuyDoi: number | null;
  sortOrder: number;
}

export interface KhungDuToan {
  phan: PhanDuToan[];
  dong: DongDuToan[];
  canhBao: string[];
}

/** So mã phần bỏ qua dấu cách và hoa thường — cùng luật với `deriveLines`. */
const chuanHoaMa = (s: string) => s.trim().toUpperCase();

export interface KetQuaLocPhan {
  khung: KhungDuToan;
  /** Mã phần bị bỏ vì bản dự toán đã có phần mang mã đó. */
  boQua: string[];
}

/**
 * Bỏ khỏi khung những phần mà bản dự toán ĐÃ có.
 *
 * Áp một bộ hạng mục vào bản đã có nội dung là việc thường: người lập gõ vài dòng
 * rồi mới nhớ ra có bộ chuẩn. Luật là THÊM phần còn thiếu và không đụng gì tới phần
 * đã có — người dùng đoán được kết quả mà không sợ mất khối lượng đã nhập.
 *
 * Phần con của một phần bị bỏ thì cũng bỏ: cha nó không được tạo, mà gắn nó vào phần
 * cùng mã do người dùng tự tạo là tự ý diễn giải một thứ họ không yêu cầu.
 */
export function locPhanConThieu(
  khung: KhungDuToan,
  maDaCo: readonly string[]
): KetQuaLocPhan {
  const daCo = new Set(maDaCo.map(chuanHoaMa));
  const boQua = new Set<string>();

  // Phần gốc trước, rồi tới con — mảng `phan` đã xếp cha trước con từ dungKhungDuToan.
  for (const p of khung.phan) {
    const chaBiBo = p.maCha != null && boQua.has(chuanHoaMa(p.maCha));
    if (daCo.has(chuanHoaMa(p.ma)) || chaBiBo) boQua.add(chuanHoaMa(p.ma));
  }

  const giu = khung.phan.filter((p) => !boQua.has(chuanHoaMa(p.ma)));
  const maGiu = new Set(giu.map((p) => chuanHoaMa(p.ma)));
  const dong = khung.dong.filter((d) => maGiu.has(chuanHoaMa(d.phanMa)));

  const canhBao = [...khung.canhBao];
  if (boQua.size > 0) {
    canhBao.push(
      `${boQua.size} phần đã có sẵn trong bản dự toán — giữ nguyên, không áp đè: ` +
        [...boQua].join(", ")
    );
  }

  return {
    khung: { phan: giu, dong, canhBao },
    boQua: [...boQua],
  };
}

/**
 * Bóc bộ hạng mục thành khung để dựng một bản dự toán mới.
 *
 * Trả về quan hệ cha–con và quan hệ dòng–phần bằng MÃ chứ không bằng id: chỗ gọi tạo
 * các phần trước rồi mới biết id thật của chúng, nên khuôn phải nói bằng thứ nó biết.
 *
 * Dòng không bám được vào phần nào thì BỎ, kèm cảnh báo — `QuoteItem` bắt buộc có
 * `sectionId`, tạo dòng mồ côi là làm vỡ ràng buộc ngay lúc ghi.
 */
export function dungKhungDuToan(
  phanNguon: readonly PhanKhung[],
  dongNguon: readonly DongKhung[]
): KhungDuToan {
  const canhBao: string[] = [];

  // Sao chép trước khi sắp xếp: hàm thuần không sửa mảng của người gọi.
  const phanTheoThuTu = [...phanNguon].sort((a, b) => a.sortOrder - b.sortOrder);

  const maCuaId = new Map<string, string>();
  const daDungMa = new Set<string>();
  const phan: PhanDuToan[] = [];

  for (const p of phanTheoThuTu) {
    if (daDungMa.has(p.ma)) {
      // Ràng buộc duy nhất trong CSDL đã chặn, nhưng dữ liệu chuyển đổi hoặc nhập
      // Excel có thể lọt; giữ cái đầu để khung vẫn dựng được.
      canhBao.push(`Hai phần cùng mã "${p.ma}" — chỉ giữ phần đầu tiên.`);
      // Dòng của phần bị bỏ vẫn về đúng mã đó, nên vẫn ghi vào bảng tra.
      maCuaId.set(p.id, p.ma);
      continue;
    }
    daDungMa.add(p.ma);
    maCuaId.set(p.id, p.ma);
    phan.push({
      ma: p.ma,
      ten: p.ten,
      loai: p.loai,
      maCha: null, // điền ở vòng sau, khi đã biết mã của mọi phần
      sortOrder: p.sortOrder,
    });
  }

  const theoMa = new Map(phan.map((p) => [p.ma, p]));
  for (const p of phanTheoThuTu) {
    if (p.loai !== "SUB" || !p.parentId) continue;
    const con = theoMa.get(p.ma);
    if (!con) continue; // phần trùng mã đã bị bỏ
    const maCha = maCuaId.get(p.parentId);
    if (!maCha || !theoMa.has(maCha)) {
      canhBao.push(`Mục "${p.ma}" trỏ tới phần cha không còn — đưa lên thành phần gốc.`);
      con.loai = "PHAN";
      continue;
    }
    con.maCha = maCha;
  }

  const dong: DongDuToan[] = [];
  for (const d of [...dongNguon].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const phanMa = d.phanId ? maCuaId.get(d.phanId) : undefined;
    if (!phanMa || !theoMa.has(phanMa)) {
      canhBao.push(`Dòng "${d.ten}" không thuộc phần nào — bỏ qua.`);
      continue;
    }
    dong.push({
      phanMa,
      congTacId: d.congTacId,
      congTacVatTuId: d.congTacVatTuId,
      maCongTac: d.maCongTac,
      ten: d.ten,
      donVi: d.donVi,
      qty: d.khoiLuongMacDinh,
      suatKhoiLuong: d.suatKhoiLuong,
      napThamSo: d.napThamSo,
      layTuThamSo: d.layTuThamSo,
      heSoQuyDoi: d.heSoQuyDoi,
      donGia: d.donGiaMacDinh,
      sortOrder: d.sortOrder,
    });
  }

  return { phan, dong, canhBao };
}

/**
 * Bóc mặt GỬI KHÁCH của bộ thành các dòng hạng mục cho bản báo giá gửi chủ đầu tư.
 *
 * Trả đúng hình dạng `LineSeed` mà `apDungMau`/`deriveLines` đang dùng, nên đường sinh
 * báo giá khách không phải sửa — chỉ đổi NGUỒN của nó từ bảng mẫu cũ sang bộ hạng mục.
 *
 * `sourceSectionCode` chính là mã phần nội bộ: đó là cách bản gửi khách suy đơn giá m²
 * từ đúng phần giá vốn tương ứng.
 */
export function dungKhuonGuiKhach(phanNguon: readonly PhanKhung[]): LineSeed[] {
  return [...phanNguon]
    .filter((p) => p.inChoKhach)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({
      partCode: p.partCode,
      partName: p.partName,
      code: p.maKhach,
      name: p.tenKhachHang ?? p.ten,
      detail: p.moTaKhachHang,
      unit: p.donViKhach,
      note: p.ghiChuKhach,
      defaultUnitPrice: p.donGiaKhach,
      tags: p.tags,
      sourceSectionCode: p.ma,
      steelFrameKey: p.steelFrameKey,
    }));
}

// ----- Thư viện khối lượng -----

/**
 * Rót khối lượng vào các dòng theo suất × diện tích phần.
 *
 * Dòng có suất và phần có diện tích thì khối lượng được TÍNH; ngoài ra giữ nguyên
 * `qty` sẵn có (số tuyệt đối trong bộ, cho những dòng không tỉ lệ diện tích như
 * "vận chuyển: 2 chuyến").
 *
 * Diện tích ≤ 0 coi như chưa khai — nhân với 0 cho ra khối lượng 0, mà 0 và "chưa
 * biết" là hai chuyện khác nhau khi người lập nhìn bảng.
 */
export function ropKhoiLuongTheoDienTich(
  dong: readonly DongDuToan[],
  dienTich: Readonly<Record<string, number | null | undefined>>
): DongDuToan[] {
  return dong.map((d) => {
    if (d.suatKhoiLuong == null || !Number.isFinite(d.suatKhoiLuong)) return { ...d };
    const dt = dienTich[d.phanMa];
    if (dt == null || !Number.isFinite(dt) || dt <= 0) return { ...d };
    const kl = d.suatKhoiLuong * dt;
    return { ...d, qty: Number.isFinite(kl) ? kl : d.qty };
  });
}

/**
 * Điền khối lượng cho các dòng DẪN XUẤT, sau khi các dòng nguồn đã có khối lượng.
 *
 * Phải chạy SAU `ropKhoiLuongTheoDienTich`: vận chuyển lấy từ số kg thép, mà số kg thép
 * chỉ có sau khi nhân suất với diện tích.
 *
 * Dòng dẫn xuất chưa đủ nguồn thì để nguyên khối lượng cũ (thường là trống) chứ không
 * ghi 0 đè lên — 0 trên một dòng dự toán nghĩa là "làm không công".
 */
export function ropKhoiLuongDanXuat(
  phan: readonly PhanDuToan[],
  dong: readonly DongDuToan[]
): DongDuToan[] {
  // Hàm thuần bên `danXuat.ts` làm việc theo id; ở đây mã phần chính là định danh.
  const kq = tinhKhoiLuongDanXuat(
    dong.map((d, i) => ({
      id: String(i),
      sectionId: d.phanMa,
      qty: d.qty,
      napThamSo: d.napThamSo,
      layTuThamSo: d.layTuThamSo,
      heSoQuyDoi: d.heSoQuyDoi,
    })),
    phan.map((p) => ({ id: p.ma, parentId: p.maCha }))
  );
  return dong.map((d, i) => {
    const tinh = kq.get(String(i));
    if (!tinh || tinh.khoiLuong == null) return { ...d };
    return { ...d, qty: tinh.khoiLuong };
  });
}

/** Một dòng của bản dự toán dùng làm mẫu để rút suất. */
export interface DongMauSuat {
  phanMa: string;
  maCongTac: string | null;
  qty: number | null;
}

export interface SuatRutRa {
  phanMa: string;
  maCongTac: string;
  suat: number;
}

export interface KetQuaRutSuat {
  suat: SuatRutRa[];
  canhBao: string[];
}

/** Khóa nhận dạng một dòng công tác trong một phần. */
const khoaDong = (phanMa: string, maCongTac: string) =>
  `${chuanHoaMa(phanMa)}|${chuanHoaMa(maCongTac)}`;

/**
 * Rút suất khối lượng từ một bản dự toán ĐÃ LÀM: suất = khối lượng ÷ diện tích phần.
 *
 * Nhận dạng dòng bằng cặp (mã phần, mã công tác) chứ không bằng tên: tên là chữ tự
 * do người lập gõ lại mỗi công trình một kiểu, còn mã công tác là khóa của thư viện.
 *
 * Cặp khóa xuất hiện NHIỀU LẦN trong cùng một phần thì bỏ kèm cảnh báo, không cộng
 * dồn: hai dòng cùng mã trong một phần thường là người lập tách ra theo vị trí, và
 * cộng lại rồi chia đều sẽ cho một con số không ai kiểm chứng được.
 */
export function rutSuatKhoiLuong(
  dong: readonly DongMauSuat[],
  dienTich: Readonly<Record<string, number | null | undefined>>
): KetQuaRutSuat {
  const theoKhoa = new Map<string, DongMauSuat[]>();
  for (const d of dong) {
    if (!d.maCongTac) continue;
    const k = khoaDong(d.phanMa, d.maCongTac);
    const ds = theoKhoa.get(k);
    if (ds) ds.push(d);
    else theoKhoa.set(k, [d]);
  }

  const suat: SuatRutRa[] = [];
  const canhBao: string[] = [];
  let thieuDienTich = 0;
  let thieuKhoiLuong = 0;

  for (const ds of theoKhoa.values()) {
    if (ds.length > 1) {
      canhBao.push(`Mã ${ds[0].maCongTac} xuất hiện ${ds.length} lần trong phần ${ds[0].phanMa} — bỏ qua.`);
      continue;
    }
    const d = ds[0];
    if (d.qty == null || !Number.isFinite(d.qty)) {
      thieuKhoiLuong++;
      continue;
    }
    const dt = dienTich[d.phanMa];
    if (dt == null || !Number.isFinite(dt) || dt <= 0) {
      thieuDienTich++;
      continue;
    }
    const s = d.qty / dt;
    if (!Number.isFinite(s)) continue;
    suat.push({ phanMa: d.phanMa, maCongTac: d.maCongTac!, suat: s });
  }

  if (thieuKhoiLuong > 0) canhBao.push(`${thieuKhoiLuong} dòng chưa có khối lượng — không rút được suất.`);
  if (thieuDienTich > 0) canhBao.push(`${thieuDienTich} dòng thuộc phần chưa khai diện tích — không rút được suất.`);

  return { suat, canhBao };
}
