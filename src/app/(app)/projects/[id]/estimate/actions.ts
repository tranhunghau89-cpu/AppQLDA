"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ESTIMATE_GROUP_MAP } from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

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

export async function saveEstimateItem(
  projectId: string,
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("estimate", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa dự toán." };
  }

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
  try {
    await requirePermission("estimate", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa dòng dự toán." };
  }
  await db.estimateItem.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath("/estimates");
  return { ok: true };
}
