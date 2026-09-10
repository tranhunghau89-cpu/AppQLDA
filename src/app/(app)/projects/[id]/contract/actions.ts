"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { CONTRACT_STATUS_MAP } from "@/lib/constants";
import { lineAmount } from "@/lib/contract";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CONTRACT_AUDIT_FIELDS = [
  "contractNo",
  "signDate",
  "subject",
  "partyAName",
  "status",
  "vatPercent",
  "paymentTerms",
  "note",
] as const;
const CONTRACT_AUDIT_SELECT = Object.fromEntries(
  CONTRACT_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof CONTRACT_AUDIT_FIELDS)[number], true>;

const ITEM_AUDIT_FIELDS = ["name", "unit", "qty", "unitPrice", "amount"] as const;
const ITEM_AUDIT_SELECT = Object.fromEntries(
  ITEM_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof ITEM_AUDIT_FIELDS)[number], true>;

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


/**
 * Chặn khi thiếu quyền / ngoài phạm vi dự án, hoặc khi hợp đồng không thuộc dự án đó.
 * (contractId đến từ client nên phải đối chiếu với projectId, không tin tham số.)
 */
async function guard(
  projectId: string,
  fallback: string,
  contractId?: string | null
): Promise<ActionResult | null> {
  const denied = await denyProject("contract", "edit", projectId, fallback);
  if (denied) return denied;
  if (contractId) {
    const c = await db.contract.findUnique({
      where: { id: contractId },
      select: { projectId: true },
    });
    if (!c || c.projectId !== projectId) {
      return { ok: false, error: "Hợp đồng không thuộc dự án này." };
    }
  }
  return null;
}

export async function saveContract(
  projectId: string,
  contractId: string | null,
  form: FormData
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa hợp đồng.", contractId);
  if (denied) return denied;
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

  const truoc = contractId
    ? await db.contract.findUnique({ where: { id: contractId }, select: CONTRACT_AUDIT_SELECT })
    : null;

  let cid = contractId;
  if (cid) await db.contract.update({ where: { id: cid }, data });
  else {
    const created = await db.contract.create({ data: { projectId, ...data } });
    cid = created.id;
  }
  await recompute(cid);
  await recordAudit({
    actor: await requireSession(),
    entity: "Contract",
    entityId: cid,
    entityLabel: d.contractNo || d.subject || null,
    projectId,
    action: contractId ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, CONTRACT_AUDIT_FIELDS),
  });
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}

export async function deleteContract(
  projectId: string,
  contractId: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa hợp đồng.", contractId);
  if (denied) return denied;
  const truoc = await db.contract.findUnique({
    where: { id: contractId },
    select: CONTRACT_AUDIT_SELECT,
  });
  await db.contract.delete({ where: { id: contractId } });
  await recordAudit({
    actor: await requireSession(),
    entity: "Contract",
    entityId: contractId,
    entityLabel: truoc?.contractNo ?? truoc?.subject ?? null,
    projectId,
    action: "DELETE",
    changes: diffFields(truoc, null, CONTRACT_AUDIT_FIELDS),
  });
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
  const denied = await guard(projectId, "Bạn không có quyền chỉnh sửa hạng mục.", contractId);
  if (denied) return denied;
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
  const truocItem = itemId
    ? await db.contractItem.findUnique({ where: { id: itemId }, select: ITEM_AUDIT_SELECT })
    : null;
  let iid = itemId;
  if (iid) await db.contractItem.update({ where: { id: iid }, data });
  else iid = (await db.contractItem.create({ data: { contractId, ...data } })).id;
  await recompute(contractId);
  await recordAudit({
    actor: await requireSession(),
    entity: "ContractItem",
    entityId: iid,
    entityLabel: d.name,
    projectId,
    action: itemId ? "UPDATE" : "CREATE",
    changes: diffFields(truocItem, data, ITEM_AUDIT_FIELDS),
  });
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}

export async function deleteContractItem(
  projectId: string,
  contractId: string,
  itemId: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền xóa hạng mục.", contractId);
  if (denied) return denied;
  const truocItem = await db.contractItem.findUnique({
    where: { id: itemId },
    select: ITEM_AUDIT_SELECT,
  });
  await db.contractItem.delete({ where: { id: itemId } });
  await recordAudit({
    actor: await requireSession(),
    entity: "ContractItem",
    entityId: itemId,
    entityLabel: truocItem?.name ?? null,
    projectId,
    action: "DELETE",
    changes: diffFields(truocItem, null, ITEM_AUDIT_FIELDS),
  });
  await recompute(contractId);
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}
