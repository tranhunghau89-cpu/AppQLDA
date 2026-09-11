// Tính toán báo giá chi tiết — dùng chung server + client. Không lưu cứng tổng.

export interface QuoteLine {
  qty: number | null;
  baseCost: number | null;
  sellPrice: number | null;
}

/** Thành tiền bán = khối lượng × đơn giá bán. */
export function lineSell(it: QuoteLine): number {
  return (it.qty ?? 0) * (it.sellPrice ?? 0);
}

/** Thành tiền gốc = khối lượng × giá gốc. */
export function lineCost(it: QuoteLine): number {
  return (it.qty ?? 0) * (it.baseCost ?? 0);
}

export interface QuoteTotals {
  sell: number;
  cost: number;
  profit: number;
  margin: number | null; // profit / sell
}

export function computeQuoteTotals(items: QuoteLine[]): QuoteTotals {
  let sell = 0;
  let cost = 0;
  for (const it of items) {
    sell += lineSell(it);
    cost += lineCost(it);
  }
  const profit = sell - cost;
  return { sell, cost, profit, margin: sell > 0 ? profit / sell : null };
}

/** Giá thành từ thành phần: (vật tư + nhân công/máy) × hệ số. */
export function computeBaseCost(
  material: number | null | undefined,
  laborMachine: number | null | undefined,
  coefficient: number | null | undefined
): number {
  const sum = (material ?? 0) + (laborMachine ?? 0);
  const hs = coefficient ?? 1;
  return sum * hs;
}

/** Đơn giá bán đề xuất = giá gốc × hệ số TL. */
export function sellFromBase(
  baseCost: number | null | undefined,
  markup: number | null | undefined
): number {
  return (baseCost ?? 0) * (markup ?? 1);
}

// ----- Cộng tiền theo "phần" -----

export interface SectionNode {
  id: string;
  parentId: string | null;
}

/**
 * Tổng tiền bán của từng PHẦN GỐC = dòng của chính nó + dòng của mọi mục con.
 *
 * Trả về map khóa bằng id của phần gốc (section không có parentId). Dòng trỏ tới
 * một section không tồn tại thì bị bỏ qua — dữ liệu cũ có thể lệch, và trang in
 * không được phép vỡ vì chuyện đó.
 */
export function sectionSubtotals(
  sections: SectionNode[],
  items: (QuoteLine & { sectionId: string })[]
): Map<string, number> {
  const chaCua = new Map(sections.map((s) => [s.id, s.parentId]));

  const tong = new Map<string, number>();
  for (const s of sections) {
    if (!s.parentId) tong.set(s.id, 0);
  }

  for (const it of items) {
    // Leo ngược lên gốc. Giới hạn số bước theo số section để một dữ liệu hỏng
    // (section tự làm cha nó, hoặc vòng cha-con) không treo cả trang.
    let id: string | null = it.sectionId;
    for (let buoc = 0; id !== null && buoc <= sections.length; buoc++) {
      const cha: string | null | undefined = chaCua.get(id);
      if (cha === undefined) {
        id = null; // section không tồn tại -> bỏ dòng này
        break;
      }
      if (cha === null) break; // đã tới gốc
      id = cha;
    }
    if (id === null) continue;
    const truoc = tong.get(id);
    if (truoc === undefined) continue; // gốc không nằm trong danh sách (vòng lặp)
    tong.set(id, truoc + lineSell(it));
  }

  return tong;
}
