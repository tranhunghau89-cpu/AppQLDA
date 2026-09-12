// Nhà cung cấp theo khu vực và giá mua vật tư — logic THUẦN, không đụng Prisma.
//
// Vị trí công trình tác động tới tiền qua nhà cung cấp: làm ở Hà Nội thì mua của nhóm
// này, ở Tây Ninh mua của nhóm kia, và hai nhóm đó báo giá khác nhau. Hai hàm dưới đây
// là hai nửa của việc đó — chọn ai, và giá bao nhiêu.

/** Một dòng nối nhà cung cấp ↔ khu vực. */
export interface LienKetKhuVuc {
  supplierId: string;
  khuVucId: string;
  /** Nhỏ hơn = gợi ý trước. */
  uuTien: number;
}

/**
 * Danh sách id nhà cung cấp phục vụ một khu vực, đã xếp theo ưu tiên.
 *
 * `khuVucId` rỗng trả về TẤT CẢ chứ không phải rỗng: chưa khai khu vực cho dự án là
 * chuyện thường (124 dự án cũ đều thế), và thu hẹp danh sách xuống rỗng lúc đó là làm
 * người dùng không chọn được nhà cung cấp nào.
 */
export function nhaCungCapTheoKhuVuc(
  lienKet: readonly LienKetKhuVuc[],
  khuVucId: string | null | undefined
): string[] {
  const loc = khuVucId ? lienKet.filter((l) => l.khuVucId === khuVucId) : lienKet;

  // Một NCC phục vụ nhiều vùng nên có thể xuất hiện nhiều lần khi không lọc; giữ mức
  // ưu tiên tốt nhất của nó.
  const tot = new Map<string, number>();
  for (const l of loc) {
    const cu = tot.get(l.supplierId);
    if (cu === undefined || l.uuTien < cu) tot.set(l.supplierId, l.uuTien);
  }

  return [...tot.entries()]
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([id]) => id);
}

// ----- Giá mua vật tư -----

export interface GiaMuaUngVien {
  id: string;
  vatTuId: string;
  supplierId: string;
  khuVucId: string | null;
  donGia: number;
  hieuLucTu: Date;
  createdAt: Date;
}

export interface YeuCauGiaMua {
  vatTuId: string;
  supplierId?: string | null;
  khuVucId?: string | null;
  ngay: Date;
}

/** Mới nhất trước; hoà thì tạo sau trước; hoà nữa thì id nhỏ hơn (để tất định). */
function moiHon(a: GiaMuaUngVien, b: GiaMuaUngVien): number {
  return (
    b.hieuLucTu.getTime() - a.hieuLucTu.getTime() ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Giá mua áp dụng cho một vật tư tại một thời điểm.
 *
 * Hai luật khác nhau cho hai chiều, và gộp chúng làm một là sai:
 *
 *   - Trong CÙNG một nhà cung cấp, bản giá mới THAY bản cũ — họ vừa báo giá lại, giá
 *     cũ không còn mua được nữa. Nên mới nhất thắng, kể cả khi đắt hơn.
 *   - GIỮA các nhà cung cấp, mỗi bên là một lựa chọn song song đang cùng có hiệu lực.
 *     Câu hỏi đúng lúc này là "mua chỗ nào rẻ nhất".
 *
 * Vậy thu gọn theo nhà cung cấp trước (lấy bản mới nhất của từng bên), rồi mới so rẻ.
 * Chốt mua của ai rồi thì truyền `supplierId` để khỏi so.
 *
 * Trả `null` khi không có ứng viên, không bao giờ trả NaN.
 */
export function chonGiaMua(
  ungVien: readonly GiaMuaUngVien[],
  yc: YeuCauGiaMua
): GiaMuaUngVien | null {
  const hopLe = ungVien.filter((g) => {
    if (g.vatTuId !== yc.vatTuId) return false;
    if (g.hieuLucTu.getTime() > yc.ngay.getTime()) return false;
    if (yc.supplierId && g.supplierId !== yc.supplierId) return false;
    // Dòng khai một khu vực KHÁC cái đang hỏi thì không nói gì về trường hợp này;
    // dòng khai null là giá chung, vẫn dùng được.
    if (g.khuVucId !== null && yc.khuVucId && g.khuVucId !== yc.khuVucId) return false;
    return true;
  });
  if (hopLe.length === 0) return null;

  const moiNhatCuaTungNCC = new Map<string, GiaMuaUngVien>();
  for (const g of hopLe) {
    const cu = moiNhatCuaTungNCC.get(g.supplierId);
    if (!cu || moiHon(g, cu) < 0) moiNhatCuaTungNCC.set(g.supplierId, g);
  }

  return [...moiNhatCuaTungNCC.values()].sort(
    (a, b) => a.donGia - b.donGia || moiHon(a, b)
  )[0];
}
