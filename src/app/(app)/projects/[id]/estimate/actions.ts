"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject } from "@/lib/auth";
import { ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { computeTemplateLines, type TemplateLine } from "@/lib/estimateTemplate";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface ApplyLineValue {
  lineId: string;
  qty: number | null;
  unitPrice: number | null;
}
export interface ApplyTemplatePayload {
  templateId: string;
  sectionName: string;
  lines: ApplyLineValue[];
}

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const schema = z.object({
  groupCode: z.string().refine((v) => v in ESTIMATE_GROUP_MAP, "Nhóm không hợp lệ"),
  name: z.string().trim().min(1, "Tên hạng mục không được để trống"),
  unit: z.string().trim().optional(),
  designQty: num,
  actualQty: num,
  unitPrice: num,
  amount: num,
  supplierId: z.string().trim().optional(),
  orderStatus: z.string().trim().optional(),
  dispatchStatus: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function parse(form: FormData) {
  return schema.safeParse({
    groupCode: String(form.get("groupCode") ?? ""),
    name: String(form.get("name") ?? ""),
    unit: String(form.get("unit") ?? ""),
    designQty: String(form.get("designQty") ?? ""),
    actualQty: String(form.get("actualQty") ?? ""),
    unitPrice: String(form.get("unitPrice") ?? ""),
    amount: String(form.get("amount") ?? ""),
    supplierId: String(form.get("supplierId") ?? ""),
    orderStatus: String(form.get("orderStatus") ?? ""),
    dispatchStatus: String(form.get("dispatchStatus") ?? ""),
    note: String(form.get("note") ?? ""),
  });
}


/** Chặn khi thiếu quyền / ngoài phạm vi; đối chiếu dòng dự toán có thuộc dự án không. */
async function guard(
  projectId: string,
  fallback: string,
  itemId?: string | null
): Promise<ActionResult | null> {
  const denied = await denyProject("estimate", "edit", projectId, fallback);
  if (denied) return denied;
  if (itemId) {
    const it = await db.estimateItem.findUnique({
      where: { id: itemId },
      select: { projectId: true },
    });
    if (!it || it.projectId !== projectId) {
      return { ok: false, error: "Dòng dự toán không thuộc dự án này." };
    }
  }
  return null;
}

export async function saveEstimateItem(
  projectId: string,
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa dự toán.", id);
  if (denied) return denied;

  const parsed = parse(form);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    groupCode: d.groupCode,
    name: d.name,
    unit: d.unit || null,
    designQty: d.designQty,
    actualQty: d.actualQty,
    unitPrice: d.unitPrice,
    amount: d.amount,
    supplierId: d.supplierId || null,
    orderStatus: d.orderStatus || null,
    dispatchStatus: d.dispatchStatus || null,
    note: d.note || null,
  };

  if (id) await db.estimateItem.update({ where: { id }, data });
  else await db.estimateItem.create({ data: { projectId, ...data } });

  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true };
}

export async function deleteEstimateItem(
  projectId: string,
  id: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa dòng dự toán.", id);
  if (denied) return denied;
  await db.estimateItem.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath("/estimates");
  return { ok: true };
}

// ===== Áp mẫu hạng mục (tạo Section + nhiều Item, tự tính) =====
export async function applyEstimateTemplate(
  projectId: string,
  payload: ApplyTemplatePayload
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa dự toán.");
  if (denied) return denied;

  const template = await db.estimateTemplate.findUnique({
    where: { id: payload.templateId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return { ok: false, error: "Không tìm thấy mẫu hạng mục." };

  const lines: TemplateLine[] = template.lines.map((l) => ({
    id: l.id,
    groupLabel: l.groupLabel,
    name: l.name,
    unit: l.unit,
    defaultUnitPrice: l.defaultUnitPrice,
    role: l.role,
    feedsParam: l.feedsParam,
    takesFromParam: l.takesFromParam,
    factor: l.factor,
    defaultQty: l.defaultQty,
    groupCode: l.groupCode,
    note: l.note,
    sortOrder: l.sortOrder,
  }));

  const values: Record<string, { qty: number | null; unitPrice: number | null }> = {};
  for (const v of payload.lines) values[v.lineId] = { qty: v.qty, unitPrice: v.unitPrice };

  const computed = computeTemplateLines(lines, values).filter(
    (c) => c.qty != null && c.qty !== 0
  );
  if (computed.length === 0)
    return { ok: false, error: "Chưa nhập số lượng nào — không có dòng để tạo." };

  const sectionName = payload.sectionName.trim() || template.name;
  const count = await db.estimateSection.count({ where: { projectId } });

  await db.estimateSection.create({
    data: {
      projectId,
      name: sectionName,
      code: template.code,
      templateId: template.id,
      sortOrder: count,
      items: {
        create: computed.map((c, idx) => ({
          projectId,
          groupLabel: c.groupLabel,
          groupCode: c.groupCode,
          name: c.name,
          unit: c.unit,
          designQty: c.qty,
          unitPrice: c.unitPrice,
          amount: c.amount,
          note: c.note,
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true };
}

export async function deleteEstimateSection(
  projectId: string,
  sectionId: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa hạng mục.");
  if (denied) return denied;
  const section = await db.estimateSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });
  if (!section || section.projectId !== projectId)
    return { ok: false, error: "Không tìm thấy hạng mục." };

  await db.estimateSection.delete({ where: { id: sectionId } });
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true };
}
