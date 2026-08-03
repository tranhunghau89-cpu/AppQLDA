"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function upsertWeeklyLog(
  projectId: string,
  year: number,
  week: number,
  note: string,
  statusSnapshot: string | null
): Promise<ActionResult> {
  try {
    await requirePermission("progress", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền cập nhật tiến độ tuần." };
  }

  const trimmed = note.trim();
  if (!trimmed) {
    await db.weeklyLog.deleteMany({ where: { projectId, year, week } });
  } else {
    await db.weeklyLog.upsert({
      where: { projectId_year_week: { projectId, year, week } },
      update: { note: trimmed, statusSnapshot },
      create: { projectId, year, week, note: trimmed, statusSnapshot },
    });
  }
  revalidatePath("/weekly");
  return { ok: true };
}
