// Nhật ký thay đổi cho các thực thể liên quan tới tiền.
//
// Nguyên tắc: ghi nhật ký KHÔNG BAO GIỜ được làm hỏng thao tác nghiệp vụ. Nếu ghi log
// lỗi (mất kết nối, DB đầy...) thì chỉ log ra console rồi đi tiếp — thà mất một dòng
// nhật ký còn hơn chặn người dùng lưu hợp đồng.
import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

/** Các thực thể được theo dõi. Thêm mới thì bổ sung vào đây để nhãn hiển thị có sẵn. */
export const AUDIT_ENTITY = {
  Project: "Dự án",
  Contract: "Hợp đồng",
  ContractItem: "Hạng mục hợp đồng",
  Payment: "Đợt thanh toán",
  Quote: "Báo giá",
  // Bảng đơn giá cũ. Giữ nhãn lại kể cả sau khi bảng bị xóa — dòng nhật ký cũ sống
  // lâu hơn bảng nó nói về, và màn nhật ký vẫn phải đọc được chúng.
  WorkPrice: "Đơn giá (Mã CV)",
  CongTac: "Công tác (thư viện)",
  DonGiaCongTac: "Đơn giá công tác",
  KhuVuc: "Khu vực",
  VatTu: "Vật tư (thư viện)",
  CongTacVatTu: "Biến thể vật liệu",
  GiaMuaVatTu: "Giá mua vật tư",
  BoHangMuc: "Bộ hạng mục chuẩn",
  // Dòng dự toán thi công. Chỉ ghi nhật ký cho việc gắn/gỡ BẢNG BÓC khối lượng — sửa
  // dòng bình thường không ghi, vì màn này sửa liên tục và nhật ký sẽ ngập.
  EstimateItem: "Đầu mục dự toán thi công",
  Supplier: "Nhà cung cấp",
  PurchaseOrder: "Đơn đặt hàng",
  ClientQuote: "Báo giá gửi khách",
  QuoteTemplate: "Mẫu báo giá",
  CustomerNote: "Nhật ký trao đổi",
  KhachHang: "Khách hàng (CRM)",
  CoHoi: "Cơ hội chào giá",
} as const;

export type AuditEntity = keyof typeof AUDIT_ENTITY;

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Sửa",
  DELETE: "Xóa",
};

/** Một trường đã đổi: giá trị trước và sau. */
export interface FieldChange {
  truoc: unknown;
  sau: unknown;
}

export type Changes = Record<string, FieldChange>;

function bangNhau(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // null và undefined coi như cùng nghĩa "không có giá trị"
  if (a == null && b == null) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(String(a)).getTime();
    const tb = b instanceof Date ? b.getTime() : new Date(String(b)).getTime();
    return !Number.isNaN(ta) && !Number.isNaN(tb) && ta === tb;
  }
  return false;
}

/** Chuyển Date thành chuỗi ISO để lưu JSON được. */
function choJson(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined) return null;
  return v;
}

/**
 * So sánh hai bản ghi, chỉ giữ những trường THỰC SỰ đổi.
 * Trả `null` nếu không có gì đổi — khi đó không cần ghi nhật ký.
 */
export function diffFields(
  truoc: Record<string, unknown> | null | undefined,
  sau: Record<string, unknown> | null | undefined,
  fields: readonly string[]
): Changes | null {
  const out: Changes = {};
  for (const f of fields) {
    const a = truoc?.[f];
    const b = sau?.[f];
    if (bangNhau(a, b)) continue;
    out[f] = { truoc: choJson(a), sau: choJson(b) };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export interface AuditInput {
  actor: SessionUser;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  /** Mô tả ngắn để đọc nhật ký không phải join (mã dự án, số HĐ, tên đợt thu...). */
  entityLabel?: string | null;
  projectId?: string | null;
  changes?: Changes | null;
}

/**
 * Ghi một dòng nhật ký. Không bao giờ ném lỗi.
 *
 * Với `action: "UPDATE"`, nếu `changes` rỗng/null thì bỏ qua luôn — không ghi nhật ký
 * cho những lần bấm Lưu mà không đổi gì.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    if (input.action === "UPDATE" && !input.changes) return;
    await db.auditLog.create({
      data: {
        actorId: input.actor.userId,
        actorName: input.actor.name,
        actorRole: input.actor.role,
        entity: input.entity,
        entityId: input.entityId,
        entityLabel: input.entityLabel ?? null,
        projectId: input.projectId ?? null,
        action: input.action,
        changes: (input.changes ?? undefined) as never,
      },
    });
  } catch (e) {
    // Không để việc ghi nhật ký làm hỏng thao tác chính.
    console.error("[audit] không ghi được nhật ký:", input.entity, input.entityId, e);
  }
}

/** Nhãn tiếng Việt cho tên trường, dùng khi hiển thị nhật ký. */
export const FIELD_LABEL: Record<string, string> = {
  code: "Mã dự án",
  name: "Tên",
  status: "Trạng thái",
  buildingType: "Loại công trình",
  location: "Vị trí",
  customerId: "Chủ đầu tư",
  startDate: "Ngày bắt đầu",
  endDate: "Ngày kết thúc",
  area: "Diện tích",
  salePrice: "Giá bán",
  kK: "Bước khung K",
  kL: "Chiều dài L",
  kH: "Chiều cao H",
  note: "Ghi chú",
  contractNo: "Số hợp đồng",
  signDate: "Ngày ký",
  subject: "Nội dung",
  partyAName: "Bên A",
  vatPercent: "VAT (%)",
  paymentTerms: "Điều khoản thanh toán",
  valueBeforeVat: "Giá trị chưa VAT",
  valueWithVat: "Tổng gồm VAT",
  qty: "Khối lượng",
  unit: "Đơn vị",
  unitPrice: "Đơn giá",
  amount: "Thành tiền",
  direction: "Loại",
  counterpart: "Đối tác",
  dueDate: "Hạn",
  paidDate: "Ngày thực nhận/trả",
  paidAmount: "Số tiền thực tế",
  title: "Tiêu đề",
  markup: "Hệ số TL",
  recipient: "Kính gửi",
  quoteDate: "Ngày báo giá",
  material: "Vật tư",
  laborMachine: "Nhân công + máy",
  coefficient: "Hệ số",
  baseCost: "Giá thành",
  shortName: "Loại",
  spec: "TSKT",
  groupCode: "Nhóm",
  duToan: "Dự toán",
  quyetToan: "Quyết toán",
  donHang: "Đơn đặt hàng",
  chiPhi: "Chi phí",
  value: "Giá trị",
  // Báo giá gửi khách
  quoteNo: "Số báo giá",
  tenCty: "Tên khách",
  nguoiLienHe: "Người liên hệ",
  diaChi: "Địa chỉ",
  nguon: "Nguồn khách",
  tenCongTrinh: "Tên công trình",
  diaDiem: "Địa điểm",
  trangThai: "Trạng thái",
  lyDoMat: "Lý do mất khách",
  ownerId: "Người phụ trách",
  scope: "Hạng mục",
  customerPhone: "SĐT chủ đầu tư",
  salesName: "Người phụ trách",
  salesPhone: "SĐT người phụ trách",
  salesEmail: "Email người phụ trách",
  sentDate: "Ngày gửi",
  validDays: "Hiệu lực (ngày)",
  expiryDate: "Ngày hết hiệu lực",
  warrantyMonths: "Bảo hành (tháng)",
  maintenanceMonths: "Bảo trì (tháng)",
  loadRoof: "Hoạt tải mái (kg/m2)",
  loadHanging: "Tải treo (kg/m2)",
  loadFloor: "Tải sàn (kg/m2)",
  percent: "Tỷ lệ (%)",
  days: "Số ngày",
  templateId: "Mẫu báo giá",
  // Thư viện đơn giá
  ma: "Mã",
  ten: "Tên",
  tenNgan: "Loại",
  quyCach: "Quy cách / TSKT",
  donVi: "Đơn vị",
  nhomMa: "Nhóm mã",
  nhomChiPhi: "Nhóm chi phí",
  heSo: "Hệ số",
  ghiChu: "Ghi chú",
  active: "Đang dùng",
  vatTu: "Vật tư",
  nhanCongMay: "Nhân công + máy",
  donGia: "Đơn giá",
  hieuLucTu: "Hiệu lực từ",
  khuVuc: "Khu vực phục vụ",
  khuVucId: "Khu vực",
  hang: "Hãng",
  xuatXu: "Xuất xứ",
  nhomTSKT: "Nhóm TSKT",
  tag: "Nhãn vật tư",
  inTrongMoTa: "In trong mô tả",
  tenBienThe: "Tên biến thể",
  laMacDinh: "Là mặc định",
  supplierId: "Nhà cung cấp",
  loaiCongTrinh: "Loại công trình",
  moTa: "Mô tả",
  boHangMuc: "Bộ hạng mục đã áp",
};
