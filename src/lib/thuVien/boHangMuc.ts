// Dựng khung dự toán và khuôn bản gửi khách từ một bộ hạng mục — logic THUẦN,
// không đụng Prisma.
//
// Một bộ hạng mục mang HAI mặt trên cùng một "phần": mặt chi phí (các dòng công tác
// để tính giá vốn) và mặt gửi khách (một dòng hạng mục in cho chủ đầu tư). Hai hàm
// dưới đây bóc ra từng mặt.

import type { LineSeed } from "@/lib/quoteTemplate";

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
  sortOrder: number;
}

export interface KhungDuToan {
  phan: PhanDuToan[];
  dong: DongDuToan[];
  canhBao: string[];
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
