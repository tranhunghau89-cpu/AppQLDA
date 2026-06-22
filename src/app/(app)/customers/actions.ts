"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(1, "Tên CĐT không được để trống"),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function fields(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    contactPerson: String(form.get("contactPerson") ?? ""),
    phone: String(form.get("phone") ?? ""),
    address: String(form.get("address") ?? ""),
    note: String(form.get("note") ?? ""),
  };
}

export async function saveCustomer(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("customer", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa CĐT." };
  }

  const parsed = schema.safeParse(fields(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = {
    name: parsed.data.name,
    contactPerson: parsed.data.contactPerson || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    note: parsed.data.note || null,
  };

  if (id) await db.customer.update({ where: { id }, data });
  else await db.customer.create({ data });

  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  try {
    await requirePermission("customer", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa CĐT." };
  }
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  return { ok: true };
}
