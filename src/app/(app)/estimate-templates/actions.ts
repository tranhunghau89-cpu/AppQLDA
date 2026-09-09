"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export interface TemplateLinePayload {
  groupLabel: string;
  name: string;
  unit: string | null;
  defaultUnitPrice: number | null;
  role: string; // INPUT | DERIVED
  feedsParam: string | null;
  takesFromParam: string | null;
  factor: number | null;
  groupCode: string;
  note: string | null;
}
export interface SaveTemplatePayload {
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  lines: TemplateLinePayload[];
}

async function guard(): Promise<{ ok: false; error: string } | null> {
  try {
    await requirePermission("template", "edit");
    return null;
  } catch {
    return { ok: false, error: "Chỉ quản trị viên được quản lý mẫu dự toán." };
  }
}

export async function createTemplate(): Promise<CreateResult> {
  const g = await guard();
  if (g) return g;
  const count = await db.estimateTemplate.count();
  const t = await db.estimateTemplate.create({
    data: { name: "Mẫu mới", sortOrder: count, active: true },
  });
  revalidatePath("/estimate-templates");
  return { ok: true, id: t.id };
}

export async function saveTemplate(
  id: string,
  payload: SaveTemplatePayload
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Tên mẫu không được để trống." };

  const lines = payload.lines
    .filter((l) => l.name.trim() && l.groupLabel.trim())
    .map((l, i) => {
      const role = l.role === "DERIVED" ? "DERIVED" : "INPUT";
      return {
        templateId: id,
        groupLabel: l.groupLabel.trim(),
        name: l.name.trim(),
        unit: l.unit?.trim() || null,
        defaultUnitPrice: l.defaultUnitPrice,
        role,
        feedsParam: role === "INPUT" ? l.feedsParam?.trim() || null : null,
        takesFromParam: role === "DERIVED" ? l.takesFromParam?.trim() || null : null,
        factor: role === "DERIVED" ? l.factor ?? 1 : null,
        groupCode: l.groupCode || "KHAC",
        note: l.note?.trim() || null,
        sortOrder: i,
      };
    });

  // Một giao dịch: nếu createMany lỗi thì deleteMany cũng bị hoàn tác,
  // tránh xóa trắng toàn bộ dòng của mẫu.
  await db.$transaction(async (tx) => {
    await tx.estimateTemplate.update({
      where: { id },
      data: {
        name,
        code: payload.code?.trim() || null,
        description: payload.description?.trim() || null,
        active: payload.active,
      },
    });
    await tx.estimateTemplateLine.deleteMany({ where: { templateId: id } });
    if (lines.length > 0) await tx.estimateTemplateLine.createMany({ data: lines });
  });

  revalidatePath("/estimate-templates");
  revalidatePath(`/estimate-templates/${id}`);
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  await db.estimateTemplate.delete({ where: { id } });
  revalidatePath("/estimate-templates");
  return { ok: true };
}

export async function toggleTemplateActive(id: string, active: boolean): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  await db.estimateTemplate.update({ where: { id }, data: { active } });
  revalidatePath("/estimate-templates");
  return { ok: true };
}

export async function duplicateTemplate(id: string): Promise<CreateResult> {
  const g = await guard();
  if (g) return g;
  const src = await db.estimateTemplate.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!src) return { ok: false, error: "Không tìm thấy mẫu." };
  const count = await db.estimateTemplate.count();
  const copy = await db.estimateTemplate.create({
    data: {
      name: `${src.name} (copy)`,
      code: null,
      description: src.description,
      sortOrder: count,
      active: src.active,
      lines: {
        create: src.lines.map((l) => ({
          groupLabel: l.groupLabel,
          name: l.name,
          unit: l.unit,
          defaultUnitPrice: l.defaultUnitPrice,
          role: l.role,
          feedsParam: l.feedsParam,
          takesFromParam: l.takesFromParam,
          factor: l.factor,
          groupCode: l.groupCode,
          note: l.note,
          sortOrder: l.sortOrder,
        })),
      },
    },
  });
  revalidatePath("/estimate-templates");
  return { ok: true, id: copy.id };
}
