import { db } from "@/lib/db";
import { chonDonGia } from "./gia";
import type { GiaDangApDung } from "./bangGia";

export interface DongBangGiaDb {
  id: string;
  ma: string;
  ten: string;
  donVi: string | null;
  nhomMa: string;
  gia: GiaDangApDung | null;
  hieuLucTu: Date | null;
}

/**
 * Giá CHUNG (không biến thể, không khu vực) của mọi công tác tại một ngày. Bảng giá
 * cả thư viện chỉ nói về giá chung; giá riêng theo vật liệu/vùng vẫn sửa ở từng mã.
 */
export async function bangGiaChung(ngay: Date): Promise<DongBangGiaDb[]> {
  const [congTacs, banGias] = await Promise.all([
    db.congTac.findMany({
      orderBy: [{ nhomMa: "asc" }, { sortOrder: "asc" }, { ma: "asc" }],
      select: { id: true, ma: true, ten: true, donVi: true, nhomMa: true },
    }),
    db.donGiaCongTac.findMany({
      where: { hieuLucTu: { lte: ngay }, congTacVatTuId: null, khuVucId: null },
    }),
  ]);
  const theoCongTac = new Map<string, typeof banGias>();
  for (const g of banGias) {
    const ds = theoCongTac.get(g.congTacId);
    if (ds) ds.push(g);
    else theoCongTac.set(g.congTacId, [g]);
  }
  return congTacs.map((c) => {
    const ds = theoCongTac.get(c.id) ?? [];
    const kq = chonDonGia(ds, { congTacId: c.id, ngay });
    const g = ds.find((x) => x.id === kq.donGiaId);
    return {
      ...c,
      gia: g
        ? { vatTu: g.vatTu, nhanCongMay: g.nhanCongMay, heSo: g.heSo, donGia: g.donGia }
        : null,
      hieuLucTu: kq.hieuLucTu,
    };
  });
}
