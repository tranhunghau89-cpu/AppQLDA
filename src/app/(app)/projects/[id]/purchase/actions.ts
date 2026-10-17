"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject } from "@/lib/auth";
import { tinhLaiThucTe } from "@/lib/khoiLuong/tinhLaiMucCon";
import { PO_CATEGORY_MAP, PO_STATUS_MAP } from "@/lib/constants";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";
import {
  kgMotDonVi,
  kgSauKhiSua,
  type MonTinhKg,
} from "@/lib/donHang/khoiLuong";
import { napThuVienKg } from "@/lib/khoiLuong/thuVienKg";

/** Quy cách của một món = dòng tiêu đề hạng mục nó nằm dưới; nhóm = sheet (Tôn mái, Rod…). */
const monTinhKg = (d: {
  name: string;
  unit: string | null;
  length: number | null;
  groupName: string | null;
  category: string | null;
}): MonTinhKg => ({
  name: d.name,
  unit: d.unit,
  length: d.length,
  quyCach: d.groupName,
  nhom: d.category,
});

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
    (s, i) =>
      s +
      (i.amount ??
        (i.qty != null && i.unitPrice != null ? i.qty * i.unitPrice : 0)),
    0,
  );
  const totalWeight = o.items.reduce((s, i) => s + (i.weight ?? 0), 0);
  await db.purchaseOrder.update({
    where: { id: orderId },
    data: { value, totalWeight },
  });
}

const orderSchema = z.object({
  orderNo: z.string().trim().optional(),
  orderDate: z.string().trim().optional(),
  category: z
    .string()
    .refine((v) => v in PO_CATEGORY_MAP, "Loại đơn không hợp lệ"),
  supplierId: z.string().trim().optional(),
  status: z
    .string()
    .refine((v) => v in PO_STATUS_MAP, "Trạng thái không hợp lệ"),
  orderedDate: z.string().trim().optional(),
  expectedDate: z.string().trim().optional(),
  receivedDate: z.string().trim().optional(),
  filePath: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

/**
 * Chặn khi thiếu quyền / ngoài phạm vi dự án; đối chiếu đơn hàng (và dòng vật tư,
 * ảnh) có thực sự thuộc dự án đó không — các id này đến từ client.
 */
async function guard(
  projectId: string,
  fallback: string,
  opts: {
    orderId?: string | null;
    itemId?: string | null;
    imageId?: string | null;
  } = {},
): Promise<ActionResult | null> {
  const denied = await denyProject("purchase", "edit", projectId, fallback);
  if (denied) return denied;

  let orderId = opts.orderId ?? null;
  if (opts.imageId) {
    const img = await db.poItemImage.findUnique({
      where: { id: opts.imageId },
      select: { item: { select: { orderId: true } } },
    });
    if (!img) return { ok: false, error: "Không tìm thấy ảnh." };
    orderId = img.item.orderId;
  } else if (opts.itemId) {
    const it = await db.purchaseOrderItem.findUnique({
      where: { id: opts.itemId },
      select: { orderId: true },
    });
    if (!it) return { ok: false, error: "Không tìm thấy dòng vật tư." };
    if (opts.orderId && it.orderId !== opts.orderId) {
      return { ok: false, error: "Dòng vật tư không thuộc đơn hàng này." };
    }
    orderId = it.orderId;
  }

  if (orderId) {
    const o = await db.purchaseOrder.findUnique({
      where: { id: orderId },
      select: { projectId: true },
    });
    if (!o || o.projectId !== projectId) {
      return { ok: false, error: "Đơn hàng không thuộc dự án này." };
    }
  }
  return null;
}

export async function savePurchaseOrder(
  projectId: string,
  orderId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const denied = await guard(
    projectId,
    "Bạn không có quyền chỉnh sửa đơn hàng.",
    { orderId },
  );
  if (denied) return denied;
  const parsed = orderSchema.safeParse({
    orderNo: String(form.get("orderNo") ?? ""),
    orderDate: String(form.get("orderDate") ?? ""),
    category: String(form.get("category") ?? "KHAC"),
    supplierId: String(form.get("supplierId") ?? ""),
    status: String(form.get("status") ?? "DRAFT"),
    orderedDate: String(form.get("orderedDate") ?? ""),
    expectedDate: String(form.get("expectedDate") ?? ""),
    receivedDate: String(form.get("receivedDate") ?? ""),
    filePath: String(form.get("filePath") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    orderNo: d.orderNo || null,
    orderDate: d.orderDate ? new Date(d.orderDate) : null,
    category: d.category,
    supplierId: d.supplierId || null,
    status: d.status,
    orderedDate: d.orderedDate ? new Date(d.orderedDate) : null,
    expectedDate: d.expectedDate ? new Date(d.expectedDate) : null,
    receivedDate: d.receivedDate ? new Date(d.receivedDate) : null,
    filePath: d.filePath || null,
    note: d.note || null,
  };
  let oid = orderId;
  if (oid) await db.purchaseOrder.update({ where: { id: oid }, data });
  else {
    const created = await db.purchaseOrder.create({
      data: { projectId, ...data },
    });
    oid = created.id;
  }
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

export async function deletePurchaseOrder(
  projectId: string,
  orderId: string,
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa đơn hàng.", {
    orderId,
  });
  if (denied) return denied;
  const gan = await db.purchaseOrderItem.findMany({
    where: { orderId, estimateItemId: { not: null } },
    select: { estimateItemId: true },
  });
  await db.purchaseOrder.delete({ where: { id: orderId } });
  await capNhatDuToan(
    projectId,
    gan.map((g) => g.estimateItemId),
  );
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
  estimateItemId: z.string().trim().optional(),
});

/** Món đơn hàng gắn / bỏ gắn đầu việc → cộng lại thực tế đầu việc cũ và mới. */
async function capNhatDuToan(
  projectId: string,
  ids: (string | null | undefined)[],
) {
  if (!ids.some(Boolean)) return;
  await tinhLaiThucTe(ids);
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
}

export async function savePurchaseItem(
  projectId: string,
  orderId: string,
  itemId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const denied = await guard(
    projectId,
    "Bạn không có quyền chỉnh sửa vật tư.",
    {
      orderId,
      itemId,
    },
  );
  if (denied) return denied;
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
    estimateItemId: String(form.get("estimateItemId") ?? ""),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.estimateItemId) {
    const ei = await db.estimateItem.findUnique({
      where: { id: d.estimateItemId },
      select: { projectId: true },
    });
    if (!ei || ei.projectId !== projectId) {
      return { ok: false, error: "Đầu việc dự toán không thuộc dự án này." };
    }
  }
  const data = {
    estimateItemId: d.estimateItemId || null,
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
  const cu = itemId
    ? await db.purchaseOrderItem.findUnique({
        where: { id: itemId },
        select: { estimateItemId: true },
      })
    : null;
  if (itemId)
    await db.purchaseOrderItem.update({ where: { id: itemId }, data });
  else await db.purchaseOrderItem.create({ data: { orderId, ...data } });
  await recompute(orderId);
  await capNhatDuToan(projectId, [cu?.estimateItemId, data.estimateItemId]);
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

export async function deletePurchaseItem(
  projectId: string,
  orderId: string,
  itemId: string,
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa vật tư.", {
    orderId,
    itemId,
  });
  if (denied) return denied;
  const xoa = await db.purchaseOrderItem.delete({ where: { id: itemId } });
  await recompute(orderId);
  await capNhatDuToan(projectId, [xoa.estimateItemId]);
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

const O_CHU = ["name", "unit", "note", "category", "groupName"] as const;
const O_SO = ["qty", "unitPrice", "weight", "length"] as const;
type TruongMon = (typeof O_CHU)[number] | (typeof O_SO)[number];

/**
 * Sửa MỘT ô của dòng vật tư ngay trên bảng — như gõ vào ô Excel.
 *
 * Ô số nhận số kiểu Việt và công thức "=" qua `tinhBieuThuc`. Sửa SL hay đơn giá thì
 * thành tiền tính lại = SL × đơn giá; số tiền lệch từ file Excel cũ chỉ giữ đến khi
 * có người sửa một trong hai ô đó.
 */
export async function suaOMonHang(
  projectId: string,
  itemId: string,
  truong: TruongMon,
  tho: string,
): Promise<ActionResult> {
  const denied = await guard(
    projectId,
    "Bạn không có quyền chỉnh sửa vật tư.",
    { itemId },
  );
  if (denied) return denied;
  const dong = await db.purchaseOrderItem.findUnique({ where: { id: itemId } });
  if (!dong) return { ok: false, error: "Không tìm thấy dòng vật tư." };

  const s = tho.trim();
  let data: Record<string, string | number | null>;
  if ((O_CHU as readonly string[]).includes(truong)) {
    if (truong === "name" && !s)
      return { ok: false, error: "Tên vật tư không được để trống." };
    data = { [truong]: s || null };
  } else if ((O_SO as readonly string[]).includes(truong)) {
    const giaTri = s === "" ? null : tinhBieuThuc(s);
    if (s !== "" && giaTri == null) {
      return {
        ok: false,
        error: laCongThuc(s) ? "Công thức không hợp lệ." : "Không phải là số.",
      };
    }
    if (giaTri != null && giaTri < 0)
      return { ok: false, error: "Không được là số âm." };
    data = { [truong]: giaTri };
    if (truong === "qty" || truong === "unitPrice") {
      const qty = truong === "qty" ? giaTri : dong.qty;
      const gia = truong === "unitPrice" ? giaTri : dong.unitPrice;
      data.amount = qty != null && gia != null ? qty * gia : null;
    }
  } else return { ok: false, error: "Ô không sửa được." };

  // Đổi SL / chiều dài / tên / ĐV → kg tự tính lại theo quy cách (xem lib/donHang/khoiLuong).
  if (
    truong === "qty" ||
    truong === "length" ||
    truong === "name" ||
    truong === "unit"
  ) {
    const moi = { ...dong, ...data } as typeof dong;
    const kg = kgSauKhiSua(
      dong,
      { ...monTinhKg(moi), qty: moi.qty },
      await napThuVienKg(),
    );
    if (kg !== undefined) data.weight = kg;
  }
  await db.purchaseOrderItem.update({ where: { id: itemId }, data });
  await recompute(dong.orderId);
  if ("weight" in data || truong === "qty")
    await capNhatDuToan(projectId, [dong.estimateItemId]);
  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath("/purchases");
  return { ok: true };
}

/**
 * Đổi tên dòng tiêu đề hạng mục trên bảng = đổi `groupName` (hoặc `category`) của mọi
 * dòng đang nằm dưới tiêu đề đó. Để trống thì các dòng thôi thuộc hạng mục nào.
 */
export async function doiTenHangMuc(
  projectId: string,
  orderId: string,
  itemIds: string[],
  truong: "groupName" | "category",
  tho: string,
): Promise<ActionResult> {
  const denied = await guard(
    projectId,
    "Bạn không có quyền chỉnh sửa vật tư.",
    { orderId },
  );
  if (denied) return denied;
  if (truong !== "groupName" && truong !== "category")
    return { ok: false, error: "Ô không sửa được." };
  await db.purchaseOrderItem.updateMany({
    where: { orderId, id: { in: itemIds } },
    data: { [truong]: tho.trim() || null },
  });
  // Quy cách nhóm đổi (dày, khổ, đường kính…) → tính lại kg các dòng tính được; dòng
  // không đọc ra quy cách thì giữ nguyên kg.
  const ds = await db.purchaseOrderItem.findMany({
    where: { orderId, id: { in: itemIds } },
  });
  const thuVien = await napThuVienKg();
  let doi = false;
  for (const d of ds) {
    const k = kgMotDonVi(monTinhKg(d), thuVien);
    if (!k || d.qty == null) continue;
    const kg = Math.round(k.kg * d.qty * 1000) / 1000;
    if (kg === d.weight) continue;
    await db.purchaseOrderItem.update({
      where: { id: d.id },
      data: { weight: kg },
    });
    doi = true;
  }
  if (doi) {
    await recompute(orderId);
    await capNhatDuToan(
      projectId,
      ds.map((d) => d.estimateItemId),
    );
  }
  revalidatePath(`/projects/${projectId}/purchase`);
  return { ok: true };
}

/** Thêm nhanh một dòng từ ô "gõ tên…" cuối bảng; nhóm theo tab đang mở. */
export async function themNhanhMonHang(
  projectId: string,
  orderId: string,
  ten: string,
  nhom: { category?: string | null; groupName?: string | null },
): Promise<ActionResult> {
  const denied = await guard(
    projectId,
    "Bạn không có quyền chỉnh sửa vật tư.",
    { orderId },
  );
  if (denied) return denied;
  const name = ten.trim();
  if (!name) return { ok: false, error: "Tên vật tư không được để trống." };
  const cuoi = await db.purchaseOrderItem.findFirst({
    where: { orderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true, unit: true },
  });
  await db.purchaseOrderItem.create({
    data: {
      orderId,
      name,
      unit: cuoi?.unit ?? null,
      category: nhom.category || null,
      groupName: nhom.groupName || null,
      sortOrder: (cuoi?.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath(`/projects/${projectId}/purchase`);
  return { ok: true };
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadPurchaseItemImages(
  projectId: string,
  itemId: string,
  form: FormData,
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền thêm ảnh.", {
    itemId,
  });
  if (denied) return denied;
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Chưa chọn ảnh." };
  for (const f of files) {
    if (!f.type.startsWith("image/"))
      return { ok: false, error: `"${f.name}" không phải ảnh.` };
    if (f.size > MAX_IMAGE_BYTES)
      return { ok: false, error: `"${f.name}" vượt quá 10MB.` };
  }
  const item = await db.purchaseOrderItem.findUnique({
    where: { id: itemId },
    select: { id: true },
  });
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
  imageId: string,
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa ảnh.", {
    imageId,
  });
  if (denied) return denied;
  await db.poItemImage.delete({ where: { id: imageId } });
  revalidatePath(`/projects/${projectId}/purchase`);
  return { ok: true };
}
