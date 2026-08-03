"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession, requirePermission } from "@/lib/auth";
import { canAccessProject } from "@/lib/scope";
import { addProjectNote, addPayment } from "@/app/(app)/projects/actions";
import { saveEstimateItem } from "@/app/(app)/projects/[id]/estimate/actions";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function scope(projectId: string): Promise<ActionResult | null> {
  const s = await requireSession();
  if (!(await canAccessProject(s, projectId)))
    return { ok: false, error: "Dự án này ngoài phạm vi được giao của bạn." };
  return null;
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
