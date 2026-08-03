"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Chỉ ADMIN được gán/bỏ thành viên dự án.
async function adminOnly(): Promise<ActionResult | null> {
  const s = await requireSession();
  if (s.role !== "ADMIN") return { ok: false, error: "Chỉ Ban giám đốc/Quản lý được gán thành viên." };
  return null;
}

export async function addProjectMember(projectId: string, userId: string): Promise<ActionResult> {
  const g = await adminOnly();
  if (g) return g;
  if (!userId) return { ok: false, error: "Chọn người dùng." };
  await db.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId },
    update: {},
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeProjectMember(projectId: string, userId: string): Promise<ActionResult> {
  const g = await adminOnly();
  if (g) return g;
  await db.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
