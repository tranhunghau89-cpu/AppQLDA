"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { SUPPLIER_CATEGORY_MAP } from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(1, "Tên NCC không được để trống"),
  category: z.string().refine((v) => v in SUPPLIER_CATEGORY_MAP, "Loại NCC không hợp lệ"),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function fields(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    category: String(form.get("category") ?? "KHAC"),
    contactPerson: String(form.get("contactPerson") ?? ""),
    phone: String(form.get("phone") ?? ""),
    note: String(form.get("note") ?? ""),
  };
}

export async function saveSupplier(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("supplier", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa NCC." };
  }

  const parsed = schema.safeParse(fields(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = {
    name: parsed.data.name,
    category: parsed.data.category,
    contactPerson: parsed.data.contactPerson || null,
    phone: parsed.data.phone || null,
    note: parsed.data.note || null,
  };

  if (id) await db.supplier.update({ where: { id }, data });
  else await db.supplier.create({ data });

  revalidatePath("/suppliers");
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  try {
    await requirePermission("supplier", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa NCC." };
  }
  await db.supplier.delete({ where: { id } });
  revalidatePath("/suppliers");
  return { ok: true };
}
