"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { CONTACT_ROLE_MAP, VAT_TU_TAG_MAP } from "@/lib/constants";
import { chonBaoGiaNguon, specTuBaoGia } from "@/lib/projectMaterial";
import type { ActionResult } from "../actions";

const NO_EDIT = "Bạn không có quyền sửa thông tin dự án.";
const t = (v: string) => v.trim() || null;

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nhập tên người liên hệ."),
  role: z.string(),
  phone: z.string(),
  email: z.string(),
  note: z.string(),
});

const CONTACT_FIELDS = ["name", "role", "phone", "email", "note"] as const;

export async function saveContact(
  projectId: string,
  v: z.input<typeof contactSchema>
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const p = contactSchema.safeParse(v);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  if (d.role && !(d.role in CONTACT_ROLE_MAP)) return { ok: false, error: "Vai trò không hợp lệ." };
  const data = { name: d.name, role: t(d.role), phone: t(d.phone), email: t(d.email), note: t(d.note) };
  const session = await requireSession();

  if (d.id) {
    const truoc = await db.projectContact.findFirst({ where: { id: d.id, projectId } });
    if (!truoc) return { ok: false, error: "Không tìm thấy người liên hệ." };
    await db.projectContact.update({ where: { id: d.id }, data });
    await recordAudit({
      actor: session,
      entity: "ProjectContact",
      entityId: d.id,
      entityLabel: d.name,
      projectId,
      action: "UPDATE",
      changes: diffFields(truoc, data, CONTACT_FIELDS),
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, id: d.id };
  }

  const count = await db.projectContact.count({ where: { projectId } });
  const created = await db.projectContact.create({ data: { ...data, projectId, sortOrder: count } });
  await recordAudit({
    actor: session,
    entity: "ProjectContact",
    entityId: created.id,
    entityLabel: d.name,
    projectId,
    action: "CREATE",
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: created.id };
}

export async function deleteContact(projectId: string, id: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const row = await db.projectContact.findFirst({ where: { id, projectId } });
  if (!row) return { ok: false, error: "Không tìm thấy người liên hệ." };
  await db.projectContact.delete({ where: { id } });
  await recordAudit({
    actor: await requireSession(),
    entity: "ProjectContact",
    entityId: id,
    entityLabel: row.name,
    projectId,
    action: "DELETE",
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

const INFO_FIELDS = ["mauSon", "mauTonMai", "mauTonVach", "ghiChuVatTu"] as const;

export async function saveMaterialInfo(
  projectId: string,
  v: { mauSon: string; mauTonMai: string; mauTonVach: string; ghiChuVatTu: string }
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const truoc = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, mauSon: true, mauTonMai: true, mauTonVach: true, ghiChuVatTu: true },
  });
  if (!truoc) return { ok: false, error: "Không tìm thấy dự án." };
  const data = {
    mauSon: t(v.mauSon),
    mauTonMai: t(v.mauTonMai),
    mauTonVach: t(v.mauTonVach),
    ghiChuVatTu: t(v.ghiChuVatTu),
  };
  await db.project.update({ where: { id: projectId }, data });
  await recordAudit({
    actor: await requireSession(),
    entity: "Project",
    entityId: projectId,
    entityLabel: truoc.code,
    projectId,
    action: "UPDATE",
    changes: diffFields(truoc, data, INFO_FIELDS),
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function saveMaterialSpec(
  projectId: string,
  v: { id?: string; tag: string; name: string; spec: string; origin: string }
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const name = v.name.trim();
  if (!name) return { ok: false, error: "Nhập tên vật tư." };
  if (v.tag && !(v.tag in VAT_TU_TAG_MAP)) return { ok: false, error: "Nhóm vật tư không hợp lệ." };
  const data = { tag: t(v.tag), name, spec: t(v.spec), origin: t(v.origin) };
  if (v.id) {
    const n = await db.projectMaterialSpec.updateMany({ where: { id: v.id, projectId }, data });
    if (n.count === 0) return { ok: false, error: "Không tìm thấy dòng vật tư." };
  } else {
    const count = await db.projectMaterialSpec.count({ where: { projectId } });
    await db.projectMaterialSpec.create({ data: { ...data, projectId, sortOrder: count } });
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteMaterialSpec(projectId: string, id: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  await db.projectMaterialSpec.deleteMany({ where: { id, projectId } });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function moveMaterialSpec(
  projectId: string,
  id: string,
  dir: -1 | 1
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const rows = await db.projectMaterialSpec.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.$transaction(
    rows.map((r, k) => db.projectMaterialSpec.update({ where: { id: r.id }, data: { sortOrder: k } }))
  );
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Thay TOÀN BỘ chủng loại của dự án bằng bảng vật liệu của báo giá nguồn. UI hỏi xác nhận trước. */
export async function copySpecsFromQuote(projectId: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const quotes = await db.clientQuote.findMany({
    where: { projectId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      specs: { select: { tag: true, name: true, spec: true, origin: true, an: true, sortOrder: true } },
    },
  });
  const nguon = chonBaoGiaNguon(quotes);
  if (!nguon) return { ok: false, error: "Dự án chưa có báo giá gửi khách." };
  const rows = specTuBaoGia(nguon);
  await db.$transaction([
    db.projectMaterialSpec.deleteMany({ where: { projectId } }),
    db.projectMaterialSpec.createMany({ data: rows.map((r) => ({ ...r, projectId })) }),
  ]);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
