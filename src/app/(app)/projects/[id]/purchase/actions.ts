"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PO_CATEGORY_MAP, PO_STATUS_MAP } from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

async function recompute(orderId: string) {
  const o = await db.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!o) return;
  const value = o.items.reduce(
    (s, i) => s + (i.amount ?? (i.qty != null && i.unitPrice != null ? i.qty * i.unitPrice : 0)),
    0
  );
  const totalWeight = o.items.reduce((s, i) => s + (i.weight ?? 0), 0);
  await db.purchaseOrder.update({ where: { id: orderId }, data: { value, totalWeight } });
}

const orderSchema = z.object({
  orderNo: z.string().trim().optional(),
  orderDate: z.string().trim().optional(),
  category: z.string().refine((v) => v in PO_CATEGORY_MAP, "Loại đơn không hợp lệ"),
  supplierId: z.string().trim().optional(),
  status: z.string().refine((v) => v in PO_STATUS_MAP, "Trạng thái không hợp lệ"),
  orderedDate: z.string().trim().optional(),
  receivedDate: z.string().trim().optional(),
  filePath: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function savePurchaseOrder(
  projectId: string,
  orderId: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa đơn hàng." };
  }
  const parsed = orderSchema.safeParse({
    orderNo: String(form.get("orderNo") ?? ""),
    orderDate: String(form.get("orderDate") ?? ""),
    category: String(form.get("category") ?? "KHAC"),
    supplierId: String(form.get("supplierId") ?? ""),
    status: String(form.get("status") ?? "DRAFT"),
    orderedDate: String(form.get("orderedDate") ?? ""),
    receivedDate: String(form.get("receivedDate") ?? ""),
    filePath: String(form.get("filePath") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    orderNo: d.orderNo || null,
    orderDate: d.orderDate ? new Date(d.orderDate) : null,
    category: d.category,
    supplierId: d.supplierId || null,
    status: d.status,
    orderedDate: d.orderedDate ? new Date(d.orderedDate) : null,
    receivedDate: d.receivedDate ? new Date(d.receivedDate) : null,
    filePath: d.filePath || null,
    note: d.note || null,
  };
  let oid = orderId;
  if (oid) await db.purchaseOrder.update({ where: { id: oid }, data });
  else {
    const created = await db.purchaseOrder.create({ data: { projectId, ...data } });
    oid = created.id;
  }
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

export async function deletePurchaseOrder(
  projectId: string,
  orderId: string
): Promise<ActionResult> {
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa đơn hàng." };
  }
  await db.purchaseOrder.delete({ where: { id: orderId } });
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

const itemSchema = z.object({
  category: z.string().trim().optional(),
  groupName: z.string().trim().optional(),
  name: z.string().trim().min(1, "Tên vật tư không được để trống"),
  unit: z.string().trim().optional(),
  qty: num,
  unitPrice: num,
  amount: num,
  weight: num,
  note: z.string().trim().optional(),
});

export async function savePurchaseItem(
  projectId: string,
  orderId: string,
  itemId: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa vật tư." };
  }
  const parsed = itemSchema.safeParse({
    category: String(form.get("category") ?? ""),
    groupName: String(form.get("groupName") ?? ""),
    name: String(form.get("name") ?? ""),
    unit: String(form.get("unit") ?? ""),
    qty: String(form.get("qty") ?? ""),
    unitPrice: String(form.get("unitPrice") ?? ""),
    amount: String(form.get("amount") ?? ""),
    weight: String(form.get("weight") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    category: d.category || null,
    groupName: d.groupName || null,
    name: d.name,
    unit: d.unit || null,
    qty: d.qty,
    unitPrice: d.unitPrice,
    amount: d.amount,
    weight: d.weight,
    note: d.note || null,
  };
  if (itemId) await db.purchaseOrderItem.update({ where: { id: itemId }, data });
  else await db.purchaseOrderItem.create({ data: { orderId, ...data } });
  await recompute(orderId);
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

export async function deletePurchaseItem(
  projectId: string,
  orderId: string,
  itemId: string
): Promise<ActionResult> {
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa vật tư." };
  }
  await db.purchaseOrderItem.delete({ where: { id: itemId } });
  await recompute(orderId);
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadPurchaseItemImages(
  projectId: string,
  itemId: string,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền thêm ảnh." };
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Chưa chọn ảnh." };
  for (const f of files) {
    if (!f.type.startsWith("image/")) return { ok: false, error: `"${f.name}" không phải ảnh.` };
    if (f.size > MAX_IMAGE_BYTES) return { ok: false, error: `"${f.name}" vượt quá 10MB.` };
  }
  const item = await db.purchaseOrderItem.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) return { ok: false, error: "Không tìm thấy dòng vật tư." };

  const last = await db.poItemImage.findFirst({
    where: { itemId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let sort = (last?.sortOrder ?? -1) + 1;
  for (const f of files) {
    const data = Buffer.from(await f.arrayBuffer());
    await db.poItemImage.create({
      data: { itemId, mime: f.type || "image/png", data, sortOrder: sort++ },
    });
  }
  revalidatePath(`/projects/${projectId}/purchase`);
  return { ok: true };
}

export async function deletePurchaseItemImage(
  projectId: string,
  imageId: string
): Promise<ActionResult> {
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa ảnh." };
  }
  await db.poItemImage.delete({ where: { id: imageId } });
  revalidatePath(`/projects/${projectId}/purchase`);
  return { ok: true };
}
