// Engine tính mẫu dự toán — dùng chung client (xem trước) + server (tạo thật).
// Cơ chế "tham số cộng dồn": dòng INPUT nạp KL vào feedsParam; dòng DERIVED lấy KL = param × factor.

export interface TemplateLine {
  id: string;
  groupLabel: string;
  name: string;
  unit: string | null;
  defaultUnitPrice: number | null;
  role: string; // INPUT | DERIVED
  feedsParam: string | null;
  takesFromParam: string | null;
  factor: number | null;
  defaultQty: number | null;
  groupCode: string;
  note: string | null;
  sortOrder: number;
}

/** Giá trị user nhập cho 1 dòng (KL chỉ dùng cho dòng INPUT; đơn giá sửa được mọi dòng). */
export interface LineValue {
  qty: number | null;
  unitPrice: number | null;
}

export interface ComputedLine {
  lineId: string;
  groupLabel: string;
  name: string;
  unit: string | null;
  role: string;
  groupCode: string;
  note: string | null;
  sortOrder: number;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
}

const fin = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) ? v : null;

export function computeTemplateLines(
  lines: TemplateLine[],
  values: Record<string, LineValue>
): ComputedLine[] {
  // Pass 1 — gom tham số từ dòng INPUT có feedsParam.
  const params: Record<string, number> = {};
  for (const l of lines) {
    if (l.role === "INPUT" && l.feedsParam) {
      const q = fin(values[l.id]?.qty);
      if (q != null) params[l.feedsParam] = (params[l.feedsParam] ?? 0) + q;
    }
  }

  // Pass 2 — tính KL + thành tiền từng dòng.
  return lines.map((l) => {
    let qty: number | null;
    if (l.role === "DERIVED" && l.takesFromParam) {
      const base = params[l.takesFromParam] ?? 0;
      qty = base * (l.factor ?? 1);
    } else {
      qty = fin(values[l.id]?.qty);
    }
    const unitPrice = fin(values[l.id]?.unitPrice) ?? l.defaultUnitPrice;
    const amount = qty != null && unitPrice != null ? qty * unitPrice : null;
    return {
      lineId: l.id,
      groupLabel: l.groupLabel,
      name: l.name,
      unit: l.unit,
      role: l.role,
      groupCode: l.groupCode,
      note: l.note,
      sortOrder: l.sortOrder,
      qty,
      unitPrice,
      amount,
    };
  });
}
