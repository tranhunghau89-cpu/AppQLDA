"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession, requirePermission } from "@/lib/auth";
import { canAccessProject } from "@/lib/scope";
import { addProjectNote, addPayment } from "@/app/(app)/projects/actions";
import { saveEstimateItem } from "@/app/(app)/projects/[id]/estimate/actions";
import { paymentDb } from "@/lib/payments";
import { ESTIMATE_GROUP } from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BulkResult = { ok: true; count: number } | { ok: false; error: string };

async function scope(projectId: string): Promise<{ ok: false; error: string } | null> {
  const s = await requireSession();
  if (!(await canAccessProject(s, projectId)))
    return { ok: false, error: "Dự án này ngoài phạm vi được giao của bạn." };
  return null;
}

function num(s: string | undefined): number | null {
  const t = (s ?? "").replace(/[.,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Map text dán từ Excel (value hoặc nhãn, có/không dấu) → mã nhóm dự toán; fallback KHAC.
function normGroup(raw: string): string {
  const k = strip(raw);
  if (!k) return "KHAC";
  const hit = ESTIMATE_GROUP.find((g) => strip(g.value) === k || strip(g.label) === k);
  return hit?.value ?? "KHAC";
}

function normDirection(raw: string): "THU" | "CHI" {
  const k = strip(raw);
  if (k.includes("chi") || k.includes("tra")) return "CHI";
  return "THU";
}

// Tiến độ / nhật ký (kèm ảnh) — tái dùng addProjectNote (đã lo Storage).
export async function quickNote(projectId: string, form: FormData): Promise<ActionResult> {
  const g = await scope(projectId);
  if (g) return g;
  return addProjectNote(projectId, form);
}

// Chi phí / Thanh toán — tái dùng addPayment.
export async function quickPayment(projectId: string, form: FormData): Promise<ActionResult> {
  const g = await scope(projectId);
  if (g) return g;
  return addPayment(projectId, form);
}

// Dự toán / khối lượng — tái dùng saveEstimateItem (tạo mới).
export async function quickEstimate(projectId: string, form: FormData): Promise<ActionResult> {
  const g = await scope(projectId);
  if (g) return g;
  return saveEstimateItem(projectId, null, form);
}

// Đơn hàng / vật tư — tự tạo PO + nhiều dòng trong 1 lần.
export async function quickPurchase(projectId: string, form: FormData): Promise<ActionResult> {
  const g = await scope(projectId);
  if (g) return g;
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền nhập đơn hàng." };
  }

  const num = (s: string): number | null => {
    const t = s.replace(/[.,\s]/g, "");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const names = form.getAll("itemName").map(String);
  const units = form.getAll("itemUnit").map(String);
  const qtys = form.getAll("itemQty").map(String);
  const prices = form.getAll("itemPrice").map(String);

  const items = names
    .map((nm, i) => {
      const qty = num(qtys[i] ?? "");
      const unitPrice = num(prices[i] ?? "");
      return {
        name: nm.trim(),
        unit: (units[i] ?? "").trim() || null,
        qty,
        unitPrice,
        amount: qty != null && unitPrice != null ? qty * unitPrice : null,
      };
    })
    .filter((it) => it.name);

  if (items.length === 0) return { ok: false, error: "Cần ít nhất 1 dòng vật tư có tên." };

  const value = items.reduce((s, it) => s + (it.amount ?? 0), 0);
  await db.purchaseOrder.create({
    data: {
      projectId,
      orderNo: String(form.get("orderNo") ?? "").trim() || null,
      category: String(form.get("category") ?? "KHAC"),
      supplierId: String(form.get("supplierId") ?? "") || null,
      status: "DRAFT",
      value: value || null,
      items: {
        create: items.map((it, idx) => ({
          name: it.name,
          unit: it.unit,
          qty: it.qty,
          unitPrice: it.unitPrice,
          amount: it.amount,
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ===== Bulk (dán từ Excel) =====

// Đơn hàng: 1 PO + nhiều dòng vật tư dán vào.
export async function bulkPurchase(
  projectId: string,
  supplierId: string,
  category: string,
  rows: Record<string, string>[]
): Promise<BulkResult> {
  const g = await scope(projectId);
  if (g) return g;
  try {
    await requirePermission("purchase", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền nhập đơn hàng." };
  }

  const items = (rows ?? [])
    .map((r) => {
      const qty = num(r.qty);
      const unitPrice = num(r.unitPrice);
      return {
        name: (r.name ?? "").trim(),
        unit: (r.unit ?? "").trim() || null,
        qty,
        unitPrice,
        amount: qty != null && unitPrice != null ? qty * unitPrice : null,
      };
    })
    .filter((it) => it.name);

  if (items.length === 0) return { ok: false, error: "Không có dòng vật tư hợp lệ." };

  const value = items.reduce((s, it) => s + (it.amount ?? 0), 0);
  await db.purchaseOrder.create({
    data: {
      projectId,
      category: category || "KHAC",
      supplierId: supplierId || null,
      status: "DRAFT",
      value: value || null,
      items: {
        create: items.map((it, idx) => ({
          name: it.name,
          unit: it.unit,
          qty: it.qty,
          unitPrice: it.unitPrice,
          amount: it.amount,
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath(`/projects/${projectId}/purchase`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, count: items.length };
}

// Dự toán: nhiều EstimateItem dán vào.
export async function bulkEstimate(
  projectId: string,
  rows: Record<string, string>[]
): Promise<BulkResult> {
  const g = await scope(projectId);
  if (g) return g;
  try {
    await requirePermission("estimate", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa dự toán." };
  }

  const data = (rows ?? [])
    .map((r) => {
      const name = (r.name ?? "").trim();
      if (!name) return null;
      const designQty = num(r.designQty);
      const unitPrice = num(r.unitPrice);
      return {
        projectId,
        groupCode: normGroup(r.groupCode ?? ""),
        name,
        unit: (r.unit ?? "").trim() || null,
        designQty,
        unitPrice,
        amount: designQty != null && unitPrice != null ? designQty * unitPrice : null,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (data.length === 0) return { ok: false, error: "Không có dòng dự toán hợp lệ." };

  await db.estimateItem.createMany({ data });

  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true, count: data.length };
}

// Chi phí / thanh toán: nhiều Payment dán vào.
export async function bulkPayment(
  projectId: string,
  rows: Record<string, string>[]
): Promise<BulkResult> {
  const g = await scope(projectId);
  if (g) return g;
  try {
    await requirePermission("cost", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền thêm đợt thanh toán." };
  }

  const data = (rows ?? [])
    .map((r) => {
      const name = (r.name ?? "").trim();
      if (!name) return null;
      const dueRaw = (r.dueDate ?? "").trim();
      const due = dueRaw ? new Date(dueRaw) : null;
      return {
        projectId,
        direction: normDirection(r.direction ?? ""),
        name,
        amount: num(r.amount),
        dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
        counterpart: (r.counterpart ?? "").trim() || null,
        note: (r.note ?? "").trim() || null,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (data.length === 0) return { ok: false, error: "Không có dòng thanh toán hợp lệ." };

  await paymentDb.createMany({ data });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return { ok: true, count: data.length };
}
