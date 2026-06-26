"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { workGroupOf } from "@/lib/constants";
import { computeBaseCost } from "@/lib/quote";

export type ActionResult = { ok: true } | { ok: false; error: string };

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const schema = z.object({
  code: z.string().trim().min(1, "Mã CV không được để trống"),
  name: z.string().trim().min(1, "Tên công việc không được để trống"),
  shortName: z.string().trim().optional(),
  spec: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  material: num,
  laborMachine: num,
  coefficient: num,
  note: z.string().trim().optional(),
});

export async function saveWorkPrice(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("quote", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền sửa bảng đơn giá." };
  }
  const parsed = schema.safeParse({
    code: String(form.get("code") ?? ""),
    name: String(form.get("name") ?? ""),
    shortName: String(form.get("shortName") ?? ""),
    spec: String(form.get("spec") ?? ""),
    unit: String(form.get("unit") ?? ""),
    material: String(form.get("material") ?? ""),
    laborMachine: String(form.get("laborMachine") ?? ""),
    coefficient: String(form.get("coefficient") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    code: d.code,
    name: d.name,
    shortName: d.shortName || null,
    spec: d.spec || null,
    unit: d.unit || null,
    groupCode: workGroupOf(d.code),
    material: d.material,
    laborMachine: d.laborMachine,
    coefficient: d.coefficient,
    baseCost: computeBaseCost(d.material, d.laborMachine, d.coefficient),
    note: d.note || null,
  };

  const dup = await db.workPrice.findUnique({ where: { code: d.code } });
  if (dup && dup.id !== id) return { ok: false, error: `Mã CV "${d.code}" đã tồn tại.` };

  if (id) await db.workPrice.update({ where: { id }, data });
  else await db.workPrice.create({ data });
  revalidatePath("/catalog");
  return { ok: true };
}

export async function deleteWorkPrice(id: string): Promise<ActionResult> {
  try {
    await requirePermission("quote", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa mã đơn giá." };
  }
  await db.workPrice.delete({ where: { id } });
  revalidatePath("/catalog");
  return { ok: true };
}
