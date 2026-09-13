// Gán tên gọn + nhóm cho những dòng dự toán chào giá đã áp bộ hạng mục TRƯỚC khi hai
// cột đó ra đời — logic THUẦN, không đụng Prisma.
//
// Những dòng ấy mang tên gọn của bộ ("Vật tư") ở chỗ tên đầy đủ, và mất nhóm ("Bulong
// neo"). Chúng đến từ bộ, nên tra ngược lại bộ là cách duy nhất khôi phục đúng — không
// đoán từ chữ.

export interface DongCanGan {
  id: string;
  /** Mã mục chứa dòng — áp bộ chép nguyên mã phần của bộ sang mã mục. */
  maMuc: string;
  name: string;
  unit: string | null;
  note: string | null;
}

export interface DongBo {
  maPhan: string;
  ten: string;
  donVi: string | null;
  groupLabel: string | null;
  ghiChu: string | null;
  /** Tên đầy đủ của công tác gắn với dòng bộ; null = dòng bộ chưa gắn mã. */
  tenCongTac: string | null;
}

export interface KetQuaGan {
  id: string;
  tenGon: string;
  groupLabel: string | null;
  /** Tên đầy đủ mới; null = giữ tên đang có. */
  name: string | null;
  /** Ghi chú mới; null = giữ nguyên (không đè ghi chú người lập đã gõ). */
  note: string | null;
}

export interface KetQuaGanTenGon {
  gan: KetQuaGan[];
  /** Dòng khớp nhiều dòng bộ nói KHÁC nhau — không đoán, để người lập sửa tay. */
  mapMo: { id: string; name: string; soPhuongAn: number }[];
  /** Dòng không khớp dòng bộ nào — dòng gõ tay, hoặc đã bị đổi tên. */
  soKhongKhop: number;
}

/**
 * So khớp theo (mã mục, tên, đơn vị), chữ hoa/thường và dấu cách hai đầu không tính.
 *
 * KHÔNG bỏ dấu tiếng Việt: "Vật tư" và "Vát tư" là hai chữ khác nhau, và một phép tra
 * đang sắp GHI ĐÈ tên dòng thì không được phép khớp lỏng.
 */
const khoa = (ma: string, ten: string, dv: string | null) =>
  [ma, ten, dv ?? ""].map((x) => x.normalize("NFC").trim().toLowerCase()).join("|");

export function ganTenGonNhom(
  dong: readonly DongCanGan[],
  bo: readonly DongBo[]
): KetQuaGanTenGon {
  const theoKhoa = new Map<string, DongBo[]>();
  for (const b of bo) {
    const k = khoa(b.maPhan, b.ten, b.donVi);
    const ds = theoKhoa.get(k);
    if (ds) ds.push(b);
    else theoKhoa.set(k, [b]);
  }

  const gan: KetQuaGan[] = [];
  const mapMo: KetQuaGanTenGon["mapMo"] = [];
  let soKhongKhop = 0;

  for (const d of dong) {
    const ungVien = theoKhoa.get(khoa(d.maMuc, d.name, d.unit));
    if (!ungVien) {
      soKhongKhop += 1;
      continue;
    }
    // Nhiều bộ cùng có phần "A" và dòng "Vật tư" là chuyện thường. Chúng nói CÙNG một
    // điều thì dùng được; nói khác nhau thì không biết dòng này đến từ bộ nào.
    const phuongAn = new Map(
      ungVien.map((b) => {
        const v = {
          groupLabel: b.groupLabel?.trim() || null,
          ghiChu: b.ghiChu?.trim() || null,
          tenCongTac: b.tenCongTac?.trim() || null,
        };
        return [JSON.stringify(v), v];
      })
    );
    if (phuongAn.size > 1) {
      mapMo.push({ id: d.id, name: d.name, soPhuongAn: phuongAn.size });
      continue;
    }
    const v = [...phuongAn.values()][0];
    gan.push({
      id: d.id,
      tenGon: d.name.trim(),
      groupLabel: v.groupLabel,
      name: v.tenCongTac && v.tenCongTac !== d.name.trim() ? v.tenCongTac : null,
      note: d.note?.trim() ? null : v.ghiChu,
    });
  }

  return { gan, mapMo, soKhongKhop };
}
