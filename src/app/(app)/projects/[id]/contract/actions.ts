"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { CONTRACT_STATUS_MAP } from "@/lib/constants";
import { lineAmount } from "@/lib/contract";

export type ActionResult = { ok: true } | { ok: false; error: string };

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

async function recompute(contractId: string) {
  const c = await db.contract.findUnique({
    where: { id: contractId },
    include: { items: true },
  });
  if (!c) return;
  const beforeVat = c.items.reduce((s, i) => s + lineAmount(i), 0);
  const withVat = beforeVat * (1 + (c.vatPercent ?? 0) / 100);
  await db.contract.update({
    where: { id: contractId },
    data: { valueBeforeVat: beforeVat, valueWithVat: withVat },
  });
}

const contractSchema = z.object({
  contractNo: z.string().trim().optional(),
  signDate: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  partyAName: z.string().trim().optional(),
  partyAInfo: z.string().trim().optional(),
  status: z.string().refine((v) => v in CONTRACT_STATUS_MAP, "Trạng thái không hợp lệ"),
  vatPercent: num,
  paymentTerms: z.string().trim().optional(),
  filePath: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function saveContract(
  projectId: string,
  contractId: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("contract", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa hợp đồng." };
  }
  const parsed = contractSchema.safeParse({
    contractNo: String(form.get("contractNo") ?? ""),
    signDate: String(form.get("signDate") ?? ""),
    subject: String(form.get("subject") ?? ""),
    partyAName: String(form.get("partyAName") ?? ""),
    partyAInfo: String(form.get("partyAInfo") ?? ""),
    status: String(form.get("status") ?? "QUOTE"),
    vatPercent: String(form.get("vatPercent") ?? ""),
    paymentTerms: String(form.get("paymentTerms") ?? ""),
    filePath: String(form.get("filePath") ?? ""),
    note: String(form.get("note") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    contractNo: d.contractNo || null,
    signDate: d.signDate ? new Date(d.signDate) : null,
    subject: d.subject || null,
    partyAName: d.partyAName || null,
    partyAInfo: d.partyAInfo || null,
    status: d.status,
    vatPercent: d.vatPercent,
    paymentTerms: d.paymentTerms || null,
    filePath: d.filePath || null,
    note: d.note || null,
  };

  let cid = contractId;
  if (cid) await db.contract.update({ where: { id: cid }, data });
  else {
    const created = await db.contract.create({ data: { projectId, ...data } });
    cid = created.id;
  }
  await recompute(cid);
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}

export async function deleteContract(
  projectId: string,
  contractId: string
): Promise<ActionResult> {
  try {
    await requirePermission("contract", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa hợp đồng." };
  }
  await db.contract.delete({ where: { id: contractId } });
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}

const itemSchema = z.object({
  name: z.string().trim().min(1, "Tên hạng mục không được để trống"),
  unit: z.string().trim().optional(),
  qty: num,
  unitPrice: num,
  amount: num,
});

export async function saveContractItem(
  projectId: string,
  contractId: string,
  itemId: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("contract", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa hạng mục." };
  }
  const parsed = itemSchema.safeParse({
    name: String(form.get("name") ?? ""),
    unit: String(form.get("unit") ?? ""),
    qty: String(form.get("qty") ?? ""),
    unitPrice: String(form.get("unitPrice") ?? ""),
    amount: String(form.get("amount") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    name: d.name,
    unit: d.unit || null,
    qty: d.qty,
    unitPrice: d.unitPrice,
    amount: d.amount,
  };
  if (itemId) await db.contractItem.update({ where: { id: itemId }, data });
  else await db.contractItem.create({ data: { contractId, ...data } });
  await recompute(contractId);
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}

export async function deleteContractItem(
  projectId: string,
  contractId: string,
  itemId: string
): Promise<ActionResult> {
  try {
    await requirePermission("contract", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa hạng mục." };
  }
  await db.contractItem.delete({ where: { id: itemId } });
  await recompute(contractId);
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}
