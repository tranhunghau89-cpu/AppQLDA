"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { proposalDb } from "@/lib/proposals";
import { PROPOSAL_KIND_MAP } from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createProposal(form: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Phiên đăng nhập hết hạn." };
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Nhập tiêu đề đề xuất." };
  const kind = String(form.get("kind") ?? "MUA_HANG");
  if (!(kind in PROPOSAL_KIND_MAP)) return { ok: false, error: "Loại đề xuất không hợp lệ." };
  const amountRaw = String(form.get("amount") ?? "").replace(/[.,\s]/g, "");
  const amount = amountRaw ? Number(amountRaw) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return { ok: false, error: "Số tiền không hợp lệ." };
  }
  const content = String(form.get("content") ?? "").trim();
  const projectId = String(form.get("projectId") ?? "").trim();

  await proposalDb.create({
    data: {
      title,
      kind,
      amount,
      content: content || null,
      projectId: projectId || null,
      createdBy: session.name,
    },
  });
  revalidatePath("/approvals");
  return { ok: true };
}

export async function decideProposal(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Phiên đăng nhập hết hạn." };
  }
  if (session.role !== "ADMIN") {
    return { ok: false, error: "Chỉ quản trị viên được phê duyệt." };
  }
  const found = await proposalDb.findUnique({ where: { id } });
  if (!found) return { ok: false, error: "Không tìm thấy đề xuất." };
  if (found.status !== "PENDING") return { ok: false, error: "Đề xuất đã được xử lý." };

  await proposalDb.update({
    where: { id },
    data: {
      status: decision,
      decidedBy: session.name,
      decisionNote: note.trim() || null,
      decidedAt: new Date(),
    },
  });
  revalidatePath("/approvals");
  return { ok: true };
}

export async function deleteProposal(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Phiên đăng nhập hết hạn." };
  }
  const found = await proposalDb.findUnique({ where: { id } });
  if (!found) return { ok: false, error: "Không tìm thấy đề xuất." };
  // Người tạo xóa được đề xuất còn chờ; Admin xóa được tất cả.
  const isOwner = found.createdBy === session.name && found.status === "PENDING";
  if (!isOwner && session.role !== "ADMIN") {
    return { ok: false, error: "Bạn không có quyền xóa đề xuất này." };
  }
  await proposalDb.delete({ where: { id } });
  revalidatePath("/approvals");
  return { ok: true };
}
