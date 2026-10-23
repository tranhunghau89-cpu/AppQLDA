"use server";

import { baoThayDoi } from "@/lib/baoThayDoi";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { laCongThuc, tinhBieuThuc } from "@/lib/bieuThuc";
import { syncSalePriceFromContracts } from "@/lib/contractSalePrice";
import { tinhLaiGiaTriHopDong as recompute } from "@/lib/ghiHopDong";
import {
  CONTRACT_AUDIT_FIELDS,
  ITEM_AUDIT_FIELDS,
  contractData,
  contractSchema,
  itemData,
  itemSchema,
  loiDongHangMuc,
} from "@/lib/hopDongDuLieu";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CONTRACT_AUDIT_SELECT = Object.fromEntries(
  CONTRACT_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof CONTRACT_AUDIT_FIELDS)[number], true>;

const ITEM_AUDIT_SELECT = Object.fromEntries(
  ITEM_AUDIT_FIELDS.map((f) => [f, true])
) as Record<(typeof ITEM_AUDIT_FIELDS)[number], true>;

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
    effectiveDate: String(form.get("effectiveDate") ?? ""),
    durationDays: String(form.get("durationDays") ?? ""),
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
  const data = contractData(d);

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
  await syncSalePriceFromContracts(projectId, await requireSession());
  const doi = diffFields(truoc, data, CONTRACT_AUDIT_FIELDS);
  if (!contractId || (doi && Object.keys(doi).length))
    await baoThayDoi({
      projectId, nhom: "HOP_DONG", tacGia: await requireSession(),
      noiDung: `${contractId ? "Sửa" : "Thêm"} hợp đồng ${d.contractNo || d.subject || ""}`.trim() + ".",
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
  await baoThayDoi({
    projectId, nhom: "HOP_DONG", tacGia: await requireSession(),
    noiDung: `Xóa hợp đồng ${truoc?.contractNo ?? truoc?.subject ?? ""}`.trim() + ".",
  });
  await recordAudit({
    actor: await requireSession(),
    entity: "Contract",
    entityId: contractId,
    entityLabel: truoc?.contractNo ?? truoc?.subject ?? null,
    projectId,
    action: "DELETE",
    changes: diffFields(truoc, null, CONTRACT_AUDIT_FIELDS),
  });
  await syncSalePriceFromContracts(projectId, await requireSession());
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}

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
  const loi = loiDongHangMuc(d);
  if (loi) return { ok: false, error: loi };
  const data = itemData(d);
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
  await syncSalePriceFromContracts(projectId, await requireSession());
  const doiItem = diffFields(truocItem, data, ITEM_AUDIT_FIELDS);
  if (!itemId || (doiItem && Object.keys(doiItem).length))
    await baoThayDoi({
      projectId, nhom: "HOP_DONG", tacGia: await requireSession(),
      noiDung: `${itemId ? "Sửa" : "Thêm"} hạng mục HĐ "${d.name}".`,
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
  await baoThayDoi({
    projectId, nhom: "HOP_DONG", tacGia: await requireSession(),
    noiDung: `Xóa hạng mục HĐ "${truocItem?.name ?? ""}".`,
  });
  await recompute(contractId);
  await syncSalePriceFromContracts(projectId, await requireSession());
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath("/contracts");
  return { ok: true };
}

/** Sửa KL quyết toán của một hạng mục HĐ ngay trên bảng. Trống = chưa quyết toán dòng này. */
export async function suaKLQuyetToan(
  projectId: string,
  contractId: string,
  itemId: string,
  tho: string
): Promise<ActionResult> {
  const denied = await guard(projectId, "Bạn không có quyền sửa quyết toán.", contractId);
  if (denied) return denied;
  const giaTri = tho.trim() === "" ? null : tinhBieuThuc(tho);
  if (tho.trim() !== "" && giaTri == null) {
    return { ok: false, error: laCongThuc(tho) ? "Công thức không hợp lệ." : "Không phải là số." };
  }
  if (giaTri != null && giaTri < 0) return { ok: false, error: "Không được là số âm." };
  const truoc = await db.contractItem.findUnique({
    where: { id: itemId },
    select: { contractId: true, name: true, settleQty: true },
  });
  if (!truoc || truoc.contractId !== contractId) {
    return { ok: false, error: "Hạng mục không thuộc hợp đồng này." };
  }
  await db.contractItem.update({ where: { id: itemId }, data: { settleQty: giaTri } });
  await recordAudit({
    actor: await requireSession(),
    entity: "ContractItem",
    entityId: itemId,
    entityLabel: truoc.name,
    projectId,
    action: "UPDATE",
    changes: diffFields(truoc, { settleQty: giaTri }, ["settleQty"]),
  });
  revalidatePath(`/projects/${projectId}/contract`);
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
