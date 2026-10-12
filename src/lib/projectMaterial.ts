// Chép chủng loại vật tư từ báo giá gửi khách sang dự án. Hàm thuần.
export interface QuoteSrc {
  id: string;
  status: string;
  createdAt: Date;
  specs: {
    tag: string | null;
    name: string;
    spec: string | null;
    origin: string | null;
    an: boolean;
    sortOrder: number;
  }[];
}

/** Báo giá đã CHỐT mới nhất; không có thì bản mới nhất (tránh bản HUỶ nếu còn bản khác). */
export function chonBaoGiaNguon(quotes: QuoteSrc[]): QuoteSrc | null {
  const moiTruoc = [...quotes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    moiTruoc.find((x) => x.status === "CHOT") ??
    moiTruoc.find((x) => x.status !== "HUY") ??
    moiTruoc[0] ??
    null
  );
}

/** Dòng vật liệu đang hiện trên báo giá (bỏ dòng ẩn), đánh lại thứ tự từ 0. */
export function specTuBaoGia(q: QuoteSrc) {
  return q.specs
    .filter((s) => !s.an)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s, i) => ({ tag: s.tag, name: s.name, spec: s.spec, origin: s.origin, sortOrder: i }));
}
