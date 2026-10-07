// Đồng bộ giá bán dự án theo hợp đồng. Gọi sau MỌI thao tác làm đổi giá trị/trạng thái HĐ.
import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { diffFields, recordAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";
import { salePriceFromContracts, type ContractSalePrice } from "@/lib/contract";

export async function contractSalePriceOf(projectId: string): Promise<ContractSalePrice> {
  const contracts = await db.contract.findMany({
    where: { projectId },
    select: { status: true, valueBeforeVat: true },
  });
  return salePriceFromContracts(contracts);
}

/** Dự án đã có hợp đồng (bất kỳ trạng thái) thì giá bán do HĐ quyết định. */
export async function projectHasContract(projectId: string): Promise<boolean> {
  return (await db.contract.count({ where: { projectId } })) > 0;
}

export async function syncSalePriceFromContracts(
  projectId: string,
  actor: SessionUser
): Promise<void> {
  const { salePrice } = await contractSalePriceOf(projectId);
  // Xoá HĐ cuối cùng → giữ nguyên giá bán đang có, không tự đặt về rỗng.
  if (salePrice == null) return;
  const truoc = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, salePrice: true },
  });
  if (!truoc || truoc.salePrice === salePrice) return;
  await db.project.update({ where: { id: projectId }, data: { salePrice } });
  await recordAudit({
    actor,
    entity: "Project",
    entityId: projectId,
    entityLabel: truoc.code,
    projectId,
    action: "UPDATE",
    changes: diffFields(truoc, { salePrice }, ["salePrice"]),
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath("/projects");
  revalidatePath("/estimates");
}
