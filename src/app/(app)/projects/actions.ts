"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { projectNoteDb } from "@/lib/project-notes";
import {
  PROJECT_STATUS_MAP,
  PROJECT_COMPONENT_MAP,
  MILESTONE_TYPE_MAP,
} from "@/lib/constants";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const dateStr = z
  .string()
  .transform((v) => (v ? new Date(v) : null))
  .nullable();

const schema = z.object({
  code: z.string().trim().min(1, "Mã dự án không được để trống"),
  name: z.string().trim().min(1, "Tên dự án không được để trống"),
  buildingType: z.string().trim().optional(),
  status: z.string().refine((v) => v in PROJECT_STATUS_MAP, "Trạng thái không hợp lệ"),
  location: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  startDate: dateStr,
  endDate: dateStr,
  kK: num,
  kL: num,
  kH: num,
  area: num,
  salePrice: num,
  note: z.string().trim().optional(),
});

function parse(form: FormData) {
  return schema.safeParse({
    code: String(form.get("code") ?? ""),
    name: String(form.get("name") ?? ""),
    buildingType: String(form.get("buildingType") ?? ""),
    status: String(form.get("status") ?? "CHO"),
    location: String(form.get("location") ?? ""),
    customerId: String(form.get("customerId") ?? ""),
    startDate: String(form.get("startDate") ?? ""),
    endDate: String(form.get("endDate") ?? ""),
    kK: String(form.get("kK") ?? ""),
    kL: String(form.get("kL") ?? ""),
    kH: String(form.get("kH") ?? ""),
    area: String(form.get("area") ?? ""),
    salePrice: String(form.get("salePrice") ?? ""),
    note: String(form.get("note") ?? ""),
  });
}

export async function saveProject(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("project", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa dự án." };
  }

  const parsed = parse(form);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    code: d.code,
    name: d.name,
    buildingType: d.buildingType || null,
    status: d.status,
    location: d.location || null,
    customerId: d.customerId || null,
    startDate: d.startDate,
    endDate: d.endDate,
    kK: d.kK,
    kL: d.kL,
    kH: d.kH,
    area: d.area,
    salePrice: d.salePrice,
    note: d.note || null,
  };

  try {
    if (id) await db.project.update({ where: { id }, data });
    else {
      const created = await db.project.create({ data });
      revalidatePath("/projects");
      return { ok: true, id: created.id };
    }
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Unique") || msg.includes("constraint"))
      return { ok: false, error: `Mã dự án "${d.code}" đã tồn tại.` };
    return { ok: false, error: "Lỗi lưu dự án." };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true, id: id! };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    await requirePermission("project", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa dự án." };
  }
  await db.project.delete({ where: { id } });
  revalidatePath("/projects");
  return { ok: true };
}

export async function updateStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  try {
    await requirePermission("project", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền đổi trạng thái." };
  }
  if (!(status in PROJECT_STATUS_MAP))
    return { ok: false, error: "Trạng thái không hợp lệ." };
  await db.project.update({ where: { id }, data: { status } });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function upsertMilestone(
  projectId: string,
  type: string,
  values: { planDate: string; actualDate: string; done: boolean; note: string }
): Promise<ActionResult> {
  try {
    await requirePermission("progress", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền cập nhật tiến độ." };
  }
  if (!(type in MILESTONE_TYPE_MAP))
    return { ok: false, error: "Loại mốc không hợp lệ." };

  const data = {
    planDate: values.planDate ? new Date(values.planDate) : null,
    actualDate: values.actualDate ? new Date(values.actualDate) : null,
    done: values.done,
    note: values.note || null,
  };

  await db.milestone.upsert({
    where: { projectId_type: { projectId, type } },
    update: data,
    create: { projectId, type, ...data },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function setProjectSupplier(
  projectId: string,
  component: string,
  supplierId: string | null
): Promise<ActionResult> {
  try {
    await requirePermission("project", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền gán NCC." };
  }
  if (!(component in PROJECT_COMPONENT_MAP))
    return { ok: false, error: "Hạng mục không hợp lệ." };

  if (!supplierId) {
    await db.projectSupplier.deleteMany({ where: { projectId, component } });
  } else {
    await db.projectSupplier.upsert({
      where: { projectId_component: { projectId, component } },
      update: { supplierId },
      create: { projectId, component, supplierId },
    });
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ================= Ghi chú dự án (nhật ký có mốc thời gian) =================

export async function addProjectNote(
  projectId: string,
  content: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("project", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền thêm ghi chú." };
  }
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: "Nội dung ghi chú không được để trống." };
  if (trimmed.length > 2000) return { ok: false, error: "Ghi chú quá dài (tối đa 2000 ký tự)." };

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return { ok: false, error: "Không tìm thấy dự án." };

  await projectNoteDb.create({
    data: { projectId, content: trimmed, authorName: session.name },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/weekly");
  return { ok: true };
}

export async function deleteProjectNote(
  noteId: string,
  projectId: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Phiên đăng nhập hết hạn." };
  }
  if (session.role !== "ADMIN") {
    return { ok: false, error: "Chỉ quản trị viên được xóa ghi chú." };
  }
  await projectNoteDb.delete({ where: { id: noteId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/weekly");
  return { ok: true };
}
