// Khuôn dữ liệu hợp đồng + hạng mục, dùng chung cho form nhập tay và bản nháp AI
// (plan/34). Hàm THUẦN, không chạm DB: hai đường nhập phải validate giống hệt nhau, nếu
// không thì AI ghi được thứ mà form tay chặn (hoặc ngược lại).
import { z } from "zod";
import { CONTRACT_STATUS_MAP } from "@/lib/constants";

/** Trường hợp đồng ghi vào nhật ký khi tạo / sửa / xoá. */
export const CONTRACT_AUDIT_FIELDS = [
  "contractNo",
  "signDate",
  "effectiveDate",
  "durationDays",
  "subject",
  "partyAName",
  "status",
  "vatPercent",
  "paymentTerms",
  "note",
] as const;

export const ITEM_AUDIT_FIELDS = ["name", "unit", "qty", "unitPrice", "amount"] as const;

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

export const contractSchema = z.object({
  contractNo: z.string().trim().min(1, "Chưa nhập số hợp đồng"),
  signDate: z.string().trim().optional(),
  effectiveDate: z.string().trim().optional(),
  durationDays: num.refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Thời hạn phải là số ngày nguyên"),
  subject: z.string().trim().min(1, "Chưa nhập trích yếu (V/v)"),
  partyAName: z.string().trim().min(1, "Chưa nhập chủ đầu tư (Bên A)"),
  partyAInfo: z.string().trim().optional(),
  status: z.string().refine((v) => v in CONTRACT_STATUS_MAP, "Trạng thái không hợp lệ"),
  vatPercent: num,
  paymentTerms: z.string().trim().optional(),
  filePath: z.string().trim().optional(),
  note: z.string().trim().optional(),
});
export type ContractInput = z.input<typeof contractSchema>;
export type ContractParsed = z.output<typeof contractSchema>;

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Tên hạng mục không được để trống"),
  unit: z.string().trim().optional(),
  qty: num,
  unitPrice: num,
  amount: num,
});
export type ItemInput = z.input<typeof itemSchema>;
export type ItemParsed = z.output<typeof itemSchema>;

/** Dữ liệu ghi vào bảng Contract (chưa có projectId). */
export function contractData(d: ContractParsed) {
  return {
    contractNo: d.contractNo || null,
    signDate: d.signDate ? new Date(d.signDate) : null,
    effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : null,
    durationDays: d.durationDays,
    subject: d.subject || null,
    partyAName: d.partyAName || null,
    partyAInfo: d.partyAInfo || null,
    status: d.status,
    vatPercent: d.vatPercent,
    paymentTerms: d.paymentTerms || null,
    filePath: d.filePath || null,
    note: d.note || null,
  };
}

/**
 * Dòng khoán (có thành tiền chốt cứng) thì không cần khối lượng / đơn giá; còn lại
 * thiếu một trong hai là thành tiền ra 0 — chặn lại. Trả về lỗi, hoặc null nếu hợp lệ.
 */
export function loiDongHangMuc(d: ItemParsed): string | null {
  if (d.amount == null) {
    if (d.qty == null) return "Chưa nhập khối lượng";
    if (d.unitPrice == null) return "Chưa nhập đơn giá";
  }
  return null;
}

/** Dữ liệu ghi vào bảng ContractItem (chưa có contractId). */
export function itemData(d: ItemParsed) {
  return {
    name: d.name,
    unit: d.unit || null,
    qty: d.qty,
    unitPrice: d.unitPrice,
    amount: d.amount,
  };
}
