// Gắn tham số dẫn xuất (nạp / lấy khối lượng) cho những dòng dự toán chào giá đã áp bộ
// hạng mục TRƯỚC khi áp bộ biết chép tham số — logic THUẦN, không đụng Prisma.
//
// Những dòng ấy có "Vận chuyển KCT", "Lắp dựng KCT" nhưng không biết mình phải lấy khối
// lượng từ thép, nên đứng yên ở 0 dù thép đã có 12 tấn. Chúng đến từ bộ, nên tra ngược
// lại bộ là cách duy nhất khôi phục đúng.

export interface DongCanThamSo {
  id: string;
  /** Mã mục chứa dòng — áp bộ chép nguyên mã phần của bộ sang mã mục. */
  maMuc: string;
  /** Tên trong bộ: tên gọn nếu có, không thì tên dòng. */
  ten: string;
  unit: string | null;
}

export interface DongBoThamSo {
  maPhan: string;
  ten: string;
  donVi: string | null;
  napThamSo: string | null;
  layTuThamSo: string | null;
  heSoQuyDoi: number | null;
}

export interface KetQuaThamSo {
  id: string;
  napThamSo: string | null;
  layTuThamSo: string | null;
  heSoQuyDoi: number | null;
}

export interface KetQuaGanThamSo {
  gan: KetQuaThamSo[];
  /** Dòng khớp nhiều dòng bộ khai tham số KHÁC nhau — không đoán. */
  mapMo: { id: string; ten: string; soPhuongAn: number }[];
}

/** Cùng luật so khớp với `ganTenGonNhom`: không bỏ dấu, bỏ qua hoa thường và dấu cách. */
const khoa = (ma: string, ten: string, dv: string | null) =>
  [ma, ten, dv ?? ""].map((x) => x.normalize("NFC").trim().toLowerCase()).join("|");

/**
 * Chỉ trả những dòng mà bộ có khai tham số. Dòng bộ không nạp cũng không lấy (bulong neo,
 * vít…) thì không có gì để gắn — bỏ qua, không ghi một lệnh vô ích.
 */
export function ganThamSoDanXuat(
  dong: readonly DongCanThamSo[],
  bo: readonly DongBoThamSo[]
): KetQuaGanThamSo {
  const theoKhoa = new Map<string, DongBoThamSo[]>();
  for (const b of bo) {
    const k = khoa(b.maPhan, b.ten, b.donVi);
    const ds = theoKhoa.get(k);
    if (ds) ds.push(b);
    else theoKhoa.set(k, [b]);
  }

  const gan: KetQuaThamSo[] = [];
  const mapMo: KetQuaGanThamSo["mapMo"] = [];
  for (const d of dong) {
    const ungVien = theoKhoa.get(khoa(d.maMuc, d.ten, d.unit));
    if (!ungVien) continue;
    const phuongAn = new Map(
      ungVien.map((b) => {
        const v = {
          napThamSo: b.napThamSo?.trim() || null,
          layTuThamSo: b.layTuThamSo?.trim() || null,
          heSoQuyDoi: b.heSoQuyDoi,
        };
        return [JSON.stringify(v), v];
      })
    );
    if (phuongAn.size > 1) {
      mapMo.push({ id: d.id, ten: d.ten, soPhuongAn: phuongAn.size });
      continue;
    }
    const v = [...phuongAn.values()][0];
    if (!v.napThamSo && !v.layTuThamSo) continue;
    gan.push({ id: d.id, ...v });
  }
  return { gan, mapMo };
}
