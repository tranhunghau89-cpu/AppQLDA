// Lõi GHI hợp đồng, dùng chung cho form nhập tay (projects/[id]/contract/actions.ts) và
// bản nháp AI (plan/34). Một đường ghi duy nhất: cùng validate, cùng tính lại giá trị,
// cùng nhật ký, cùng đồng bộ giá bán dự án.
//
// Không kiểm quyền ở đây — người gọi phải kiểm (denyProject) trước.
import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { diffFields, recordAudit } from "@/lib/audit";
import { baoThayDoi } from "@/lib/baoThayDoi";
import { lineAmount } from "@/lib/contract";
import { syncSalePriceFromContracts } from "@/lib/contractSalePrice";
import {
  CONTRACT_AUDIT_FIELDS,
  ITEM_AUDIT_FIELDS,
  contractData,
  contractSchema,
  itemData,
  itemSchema,
  loiDongHangMuc,
  type ContractInput,
  type ItemInput,
} from "@/lib/hopDongDuLieu";
import type { SessionUser } from "@/lib/session";

type Client = Prisma.TransactionClient | typeof db;

/** Giá trị HĐ luôn là Σ hạng mục. Gọi sau mọi thao tác làm đổi hạng mục hoặc VAT. */
export async function tinhLaiGiaTriHopDong(contractId: string, client: Client = db): Promise<void> {
  const c = await client.contract.findUnique({
    where: { id: contractId },
    include: { items: true },
  });
  if (!c) return;
  const beforeVat = c.items.reduce((s, i) => s + lineAmount(i), 0);
  const withVat = beforeVat * (1 + (c.vatPercent ?? 0) / 100);
  await client.contract.update({
    where: { id: contractId },
    data: { valueBeforeVat: beforeVat, valueWithVat: withVat },
  });
}

export type KetQuaTaoHopDong = { ok: true; contractId: string } | { ok: false; error: string };

/**
 * Tạo một hợp đồng MỚI cùng toàn bộ hạng mục trong một transaction — lỗi giữa chừng
 * thì không để lại HĐ thiếu dòng. Validate bằng đúng schema của form nhập tay.
 *
 * `nguon` thêm vào nhãn nhật ký và tin báo, vd "nhập bằng AI".
 */
export async function taoHopDongKemHangMuc(v: {
  projectId: string;
  hopDong: ContractInput;
  hangMuc: ItemInput[];
  actor: SessionUser;
  nguon?: string;
}): Promise<KetQuaTaoHopDong> {
  const p = contractSchema.safeParse(v.hopDong);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const dong: ReturnType<typeof itemData>[] = [];
  for (const [i, h] of v.hangMuc.entries()) {
    const q = itemSchema.safeParse(h);
    if (!q.success) return { ok: false, error: `Hạng mục ${i + 1}: ${q.error.issues[0].message}` };
    const loi = loiDongHangMuc(q.data);
    if (loi) return { ok: false, error: `Hạng mục ${i + 1}: ${loi}` };
    dong.push(itemData(q.data));
  }

  const data = contractData(p.data);
  const contractId = await db.$transaction(async (tx) => {
    const c = await tx.contract.create({
      data: {
        projectId: v.projectId,
        ...data,
        items: { create: dong.map((d, i) => ({ ...d, sortOrder: i })) },
      },
      select: { id: true },
    });
    await tinhLaiGiaTriHopDong(c.id, tx);
    return c.id;
  });

  const nhan = data.contractNo || data.subject || "";
  const hauTo = v.nguon ? ` (${v.nguon})` : "";
  // Nhật ký ghi sau khi commit: recordAudit dùng `db`, không chạy trong transaction, và
  // không bao giờ ném lỗi.
  await recordAudit({
    actor: v.actor,
    entity: "Contract",
    entityId: contractId,
    entityLabel: `${nhan}${hauTo}`.trim() || null,
    projectId: v.projectId,
    action: "CREATE",
    changes: diffFields(null, data, CONTRACT_AUDIT_FIELDS),
  });
  const items = await db.contractItem.findMany({
    where: { contractId },
    select: { id: true, name: true, unit: true, qty: true, unitPrice: true, amount: true },
    orderBy: { sortOrder: "asc" },
  });
  for (const it of items) {
    await recordAudit({
      actor: v.actor,
      entity: "ContractItem",
      entityId: it.id,
      entityLabel: it.name,
      projectId: v.projectId,
      action: "CREATE",
      changes: diffFields(null, it, ITEM_AUDIT_FIELDS),
    });
  }
  await syncSalePriceFromContracts(v.projectId, v.actor);
  await baoThayDoi({
    projectId: v.projectId,
    nhom: "HOP_DONG",
    tacGia: v.actor,
    noiDung: `Thêm hợp đồng ${nhan}${hauTo} gồm ${dong.length} hạng mục.`.replace(/\s+/g, " "),
  });
  return { ok: true, contractId };
}
