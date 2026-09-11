"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { validatePaymentPercents } from "@/lib/clientQuote";
import { mauMacDinh } from "@/lib/quoteTemplate";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export interface TemplateLineInput {
  partCode: string;
  partName: string;
  code: string | null;
  name: string;
  detail: string | null;
  unit: string | null;
  note: string | null;
  defaultUnitPrice: number | null;
  tags: string[];
  sourceSectionCode: string | null;
  steelFrameKey: string | null;
}
export interface TemplateSpecInput {
  groupCode: string;
  tag: string | null;
  name: string;
  spec: string | null;
  origin: string | null;
}
export interface TemplateStageInput {
  name: string;
  days: number | null;
}
export interface TemplatePaymentInput {
  label: string;
  percent: number | null;
  basis: string | null;
  note: string | null;
}

export interface SaveQuoteTemplatePayload {
  name: string;
  buildingType: string | null;
  description: string | null;
  active: boolean;
  vatPercent: number | null;
  validDays: number | null;
  warrantyMonths: number | null;
  maintenanceMonths: number | null;
  loadRoof: number | null;
  loadHanging: number | null;
  loadFloor: number | null;
  lineDetail: string | null;
  greeting: string | null;
  closing: string | null;
  colorNote: string | null;
  volumeNote: string | null;
  excludeNote: string | null;
  lines: TemplateLineInput[];
  specs: TemplateSpecInput[];
  stages: TemplateStageInput[];
  payments: TemplatePaymentInput[];
}

async function guard(): Promise<{ ok: false; error: string } | null> {
  try {
    await requirePermission("template", "edit");
    return null;
  } catch {
    return { ok: false, error: "Chỉ quản trị viên được quản lý mẫu báo giá." };
  }
}

const paths = (id?: string) => {
  revalidatePath("/quote-templates");
  if (id) revalidatePath(`/quote-templates/${id}`);
};

const chuoi = (v: string | null | undefined): string | null => v?.trim() || null;

/**
 * Mẫu mới được rót sẵn toàn bộ phần mặc định (16 dòng vật liệu, 5 chặng thi công,
 * 4 đợt thanh toán). Mẫu rỗng sẽ sinh ra báo giá thiếu bảng vật liệu và thiếu điều
 * khoản — người soạn phải XÓA bớt thì mới ra mẫu rỗng, chứ không bao giờ rỗng do
 * chưa kịp điền (xem apDungMau trong lib/quoteTemplate).
 */
export async function createTemplate(): Promise<CreateResult> {
  const g = await guard();
  if (g) return g;

  const k = mauMacDinh();
  const count = await db.quoteTemplate.count();
  const t = await db.quoteTemplate.create({
    data: {
      name: "Mẫu mới",
      sortOrder: count,
      active: true,
      vatPercent: k.vatPercent,
      validDays: k.validDays,
      warrantyMonths: k.warrantyMonths,
      maintenanceMonths: k.maintenanceMonths,
      loadRoof: k.loadRoof,
      loadHanging: k.loadHanging,
      loadFloor: k.loadFloor,
      lineDetail: k.lineDetail,
      greeting: k.greeting,
      closing: k.closing,
      colorNote: k.colorNote,
      volumeNote: k.volumeNote,
      excludeNote: k.excludeNote,
      specs: { create: k.specs.map((s, i) => ({ ...s, sortOrder: i })) },
      stages: { create: k.stages.map((s, i) => ({ ...s, sortOrder: i })) },
      payments: { create: k.payments.map((p, i) => ({ ...p, sortOrder: i })) },
    },
  });

  paths();
  return { ok: true, id: t.id };
}

export async function saveTemplate(
  id: string,
  payload: SaveQuoteTemplatePayload
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Tên mẫu không được để trống." };

  const payments = payload.payments.filter((p) => p.label.trim());
  // Kiểm TRƯỚC khi ghi: mẫu sai tổng phần trăm sẽ đẻ ra hàng loạt báo giá sai.
  // Danh sách rỗng vẫn hợp lệ — mẫu có thể cố ý không khai tiến độ thanh toán.
  const kiem = validatePaymentPercents(payments);
  if (!kiem.ok) return { ok: false, error: kiem.error ?? "Tiến độ thanh toán không hợp lệ." };

  const lines = payload.lines
    .filter((l) => l.name.trim())
    .map((l, i) => ({
      templateId: id,
      partCode: l.partCode.trim() || "I",
      partName: l.partName.trim() || "Phần kết cấu thép",
      code: chuoi(l.code),
      name: l.name.trim(),
      detail: chuoi(l.detail),
      unit: chuoi(l.unit),
      note: chuoi(l.note),
      defaultUnitPrice: l.defaultUnitPrice,
      tags: l.tags.filter(Boolean),
      sourceSectionCode: chuoi(l.sourceSectionCode),
      steelFrameKey: chuoi(l.steelFrameKey),
      sortOrder: i,
    }));

  const specs = payload.specs
    .filter((s) => s.name.trim())
    .map((s, i) => ({
      templateId: id,
      groupCode: s.groupCode === "B" ? "B" : "A",
      tag: chuoi(s.tag),
      name: s.name.trim(),
      spec: chuoi(s.spec),
      origin: chuoi(s.origin),
      sortOrder: i,
    }));

  const stages = payload.stages
    .filter((s) => s.name.trim())
    .map((s, i) => ({ templateId: id, name: s.name.trim(), days: s.days, sortOrder: i }));

  const rowsThanhToan = payments.map((p, i) => ({
    templateId: id,
    label: p.label.trim(),
    percent: p.percent,
    basis: chuoi(p.basis),
    note: chuoi(p.note),
    sortOrder: i,
  }));

  // Một giao dịch: nếu createMany lỗi thì deleteMany cũng bị hoàn tác, tránh xóa
  // trắng nội dung của mẫu.
  await db.$transaction(async (tx) => {
    await tx.quoteTemplate.update({
      where: { id },
      data: {
        name,
        buildingType: chuoi(payload.buildingType),
        description: chuoi(payload.description),
        active: payload.active,
        vatPercent: payload.vatPercent,
        validDays: payload.validDays,
        warrantyMonths: payload.warrantyMonths,
        maintenanceMonths: payload.maintenanceMonths,
        loadRoof: payload.loadRoof,
        loadHanging: payload.loadHanging,
        loadFloor: payload.loadFloor,
        lineDetail: chuoi(payload.lineDetail),
        greeting: chuoi(payload.greeting),
        closing: chuoi(payload.closing),
        colorNote: chuoi(payload.colorNote),
        volumeNote: chuoi(payload.volumeNote),
        excludeNote: chuoi(payload.excludeNote),
      },
    });
    await tx.quoteTemplateLine.deleteMany({ where: { templateId: id } });
    await tx.quoteTemplateSpec.deleteMany({ where: { templateId: id } });
    await tx.quoteTemplateStage.deleteMany({ where: { templateId: id } });
    await tx.quoteTemplatePayment.deleteMany({ where: { templateId: id } });
    if (lines.length) await tx.quoteTemplateLine.createMany({ data: lines });
    if (specs.length) await tx.quoteTemplateSpec.createMany({ data: specs });
    if (stages.length) await tx.quoteTemplateStage.createMany({ data: stages });
    if (rowsThanhToan.length)
      await tx.quoteTemplatePayment.createMany({ data: rowsThanhToan });
  });

  paths(id);
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  // Báo giá đã dùng mẫu này KHÔNG bị đụng tới: ClientQuote.templateId là tham
  // chiếu mềm, không có khóa ngoại.
  await db.quoteTemplate.delete({ where: { id } });
  paths();
  return { ok: true };
}

export async function toggleTemplateActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  await db.quoteTemplate.update({ where: { id }, data: { active } });
  paths();
  return { ok: true };
}

export async function duplicateTemplate(id: string): Promise<CreateResult> {
  const g = await guard();
  if (g) return g;

  const src = await db.quoteTemplate.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      specs: { orderBy: { sortOrder: "asc" } },
      stages: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!src) return { ok: false, error: "Không tìm thấy mẫu." };

  // Bỏ khóa chính và khóa ngoại của bản gốc; phần còn lại chép nguyên. Viết kiểu
  // này để thêm cột mới vào bảng con là bản sao có luôn, không phải nhớ sửa ở đây.
  const bo = <T extends { id: string; templateId: string }>(r: T) => {
    const con: Partial<T> = { ...r };
    delete con.id;
    delete con.templateId;
    return con as Omit<T, "id" | "templateId">;
  };

  const count = await db.quoteTemplate.count();
  const copy = await db.quoteTemplate.create({
    data: {
      name: `${src.name} (copy)`,
      // Cố ý KHÔNG chép buildingType: hai mẫu cùng trỏ một loại công trình thì
      // matchTemplate phải bốc thăm theo sortOrder — người dùng không hiểu vì sao.
      buildingType: null,
      description: src.description,
      active: src.active,
      sortOrder: count,
      vatPercent: src.vatPercent,
      validDays: src.validDays,
      warrantyMonths: src.warrantyMonths,
      maintenanceMonths: src.maintenanceMonths,
      loadRoof: src.loadRoof,
      loadHanging: src.loadHanging,
      loadFloor: src.loadFloor,
      lineDetail: src.lineDetail,
      greeting: src.greeting,
      closing: src.closing,
      colorNote: src.colorNote,
      volumeNote: src.volumeNote,
      excludeNote: src.excludeNote,
      lines: { create: src.lines.map(bo) },
      specs: { create: src.specs.map(bo) },
      stages: { create: src.stages.map(bo) },
      payments: { create: src.payments.map(bo) },
    },
  });

  paths();
  return { ok: true, id: copy.id };
}
