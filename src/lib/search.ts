// Tìm kiếm toàn cục (Ctrl+K) — phần THUẦN: chấm điểm và xếp hạng.
// Phần lấy dữ liệu từ DB nằm ở app/(app)/search-actions.ts.
//
// Vì sao lọc trong bộ nhớ chứ không để SQL lọc:
//
//  1. Người Việt gõ không dấu. "ha nam" phải ra "Hà Nam". SQL `contains` không làm
//     được; muốn làm phải bật extension `unaccent` trên Postgres — tức là đổi cấu
//     hình cơ sở dữ liệu sản xuất chỉ để phục vụ một ô tìm kiếm.
//  2. Toàn bộ danh mục tìm được chỉ khoảng 400 dòng (123 dự án, 92 khách, 46 NCC,
//     135 mã đơn giá, 16 hợp đồng...). Tải một lần lúc mở hộp tìm kiếm rồi lọc ngay
//     trên máy thì gõ tới đâu hiện tới đó, KHÔNG có độ trễ mạng — đúng kết luận của
//     Phase 24 rằng số round-trip mới là thứ đáng tối ưu, không phải tốc độ truy vấn.

import { norm } from "@/lib/text";

export type SearchKind = "project" | "customer" | "supplier" | "contract" | "quote" | "workPrice";

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  project: "Dự án",
  customer: "Chủ đầu tư",
  supplier: "Nhà cung cấp",
  contract: "Hợp đồng",
  quote: "Báo giá",
  workPrice: "Mã đơn giá",
};

export interface SearchDoc {
  kind: SearchKind;
  id: string;
  /** Dòng chính hiển thị trong kết quả. */
  title: string;
  /** Dòng phụ: mã, địa điểm, nhóm... */
  subtitle: string | null;
  /** Đường dẫn khi chọn kết quả. */
  href: string;
  /**
   * Các chuỗi được đem ra so khớp. Cố ý tách khỏi `title` để tìm được cả theo những
   * thứ không hiện ra (ví dụ tên chủ đầu tư của một dự án).
   */
  terms: string[];
}

export interface SearchHit extends SearchDoc {
  diem: number;
}

/**
 * Chấm điểm một tài liệu với truy vấn đã chuẩn hóa. `0` = không khớp.
 *
 * Thang điểm cố ý thô — dữ liệu chỉ vài trăm dòng nên không cần gì tinh vi, chỉ cần
 * thứ tự hợp trực giác: khớp cả cụm > khớp đầu chuỗi > khớp giữa chuỗi, và khớp ở
 * `terms[0]` (thường là mã hoặc tên chính) hơn các trường phụ.
 */
export function chamDiem(doc: SearchDoc, qNorm: string): number {
  if (!qNorm) return 0;
  let best = 0;

  for (let i = 0; i < doc.terms.length; i++) {
    const t = norm(doc.terms[i]);
    if (!t) continue;

    let diem = 0;
    if (t === qNorm) diem = 100;
    else if (t.startsWith(qNorm)) diem = 70;
    else if (t.includes(qNorm)) diem = 40;

    if (diem === 0) continue;
    // Trường càng phụ càng ít điểm, nhưng không bao giờ về 0.
    diem -= Math.min(i * 5, 25);
    // Khớp trên chuỗi ngắn thì "đậm" hơn: "K20L50" khớp trọn vẹn hơn là khớp trong
    // một tên dự án dài lê thê.
    if (t.length <= qNorm.length + 4) diem += 5;

    if (diem > best) best = diem;
  }

  return best;
}

/** Lọc và xếp hạng. Hàm THUẦN. */
export function timKiem(docs: SearchDoc[], query: string, gioiHan = 20): SearchHit[] {
  const qNorm = norm(query);
  if (qNorm.length < 1) return [];

  const hits: SearchHit[] = [];
  for (const d of docs) {
    const diem = chamDiem(d, qNorm);
    if (diem > 0) hits.push({ ...d, diem });
  }

  hits.sort((a, b) => {
    if (b.diem !== a.diem) return b.diem - a.diem;
    // Cùng điểm thì theo thứ tự loại đã định (dự án trước, mã đơn giá sau) rồi tới
    // tên — để kết quả không nhảy lung tung giữa các lần gõ.
    const ka = THU_TU_LOAI[a.kind] - THU_TU_LOAI[b.kind];
    if (ka !== 0) return ka;
    return a.title.localeCompare(b.title, "vi");
  });

  return hits.slice(0, gioiHan);
}

/** Dự án là thứ người dùng tìm nhiều nhất, nên đứng đầu khi đồng điểm. */
const THU_TU_LOAI: Record<SearchKind, number> = {
  project: 0,
  contract: 1,
  quote: 2,
  customer: 3,
  supplier: 4,
  workPrice: 5,
};

/** Gom kết quả theo loại, giữ nguyên thứ hạng bên trong mỗi nhóm. */
export function gomTheoLoai(hits: SearchHit[]): { kind: SearchKind; hits: SearchHit[] }[] {
  const map = new Map<SearchKind, SearchHit[]>();
  for (const h of hits) {
    const cur = map.get(h.kind);
    if (cur) cur.push(h);
    else map.set(h.kind, [h]);
  }
  return [...map.entries()]
    .map(([kind, hits]) => ({ kind, hits }))
    .sort((a, b) => THU_TU_LOAI[a.kind] - THU_TU_LOAI[b.kind]);
}
