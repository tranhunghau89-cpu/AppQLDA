"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/scope";
import { ROLES } from "@/lib/rbac";
import { TEN_NHOM_THAY_DOI, nguoiNhanDuAn } from "@/lib/baoThayDoi";

type KetQua = { ok: true } | { ok: false; error: string };

const lamMoi = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/trao-doi");
  revalidatePath("/", "layout");
};

const dangSchema = z.object({
  noiDung: z.string().trim().min(1, "Nhập nội dung.").max(4000, "Tối đa 4000 ký tự."),
  chuY: z.boolean(),
  /** Chủ đề (vật tư, tiến độ…) — trống = trao đổi chung. */
  chuDe: z.enum(["VAT_TU", "TIEN_DO", "THIET_KE", "HOP_DONG", "THANH_TOAN", "BAO_HANH"]).nullable().optional(),
  canXuLy: z.boolean().optional(),
  phong: z.array(z.enum(ROLES)).max(ROLES.length),
});

/**
 * Đăng tin vào kênh trao đổi chung của dự án. Ai xem được dự án là đọc và đăng được.
 * Chuông báo cho thành viên dự án + các bộ phận được gắn. "Chú ý" = ghim lên đầu trang,
 * chỉ người có quyền sửa dự án mới ghim.
 */
export async function dangThaoLuan(projectId: string, input: z.input<typeof dangSchema>): Promise<KetQua> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  if (!(await canAccessProject(session, projectId)))
    return { ok: false, error: "Bạn không có quyền với dự án này." };
  const p = dangSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const v = p.data;
  if (v.chuY) {
    const denied = await denyProject("project", "edit", projectId, "Chỉ người quản lý dự án được đánh dấu Chú ý.");
    if (denied) return denied;
  }

  const duAn = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, members: { select: { userId: true } } },
  });
  if (!duAn) return { ok: false, error: "Không tìm thấy dự án." };
  const nhan = await nguoiNhanDuAn(projectId, {
    phong: v.phong,
    ids: duAn.members.map((m) => m.userId),
    truId: session.userId,
  });

  await db.traoDoi.create({
    data: {
      doiTuong: "THAO_LUAN",
      doiTuongId: projectId,
      projectId,
      nhanDe: `${duAn.code} · ${v.chuDe ? TEN_NHOM_THAY_DOI[v.chuDe] : "Trao đổi dự án"}`,
      // "Cần sửa" hiện là "Cần xử lý" trong hộp thư: người nhận phải làm, không chỉ đọc.
      loai: v.canXuLy ? "CAN_SUA" : "GHI_CHU",
      noiDung: v.noiDung,
      tacGiaId: session.userId,
      tacGiaTen: session.name,
      ghim: v.chuY,
      nguoiNhan: { create: nhan.map((userId) => ({ userId })) },
    },
  });
  lamMoi(projectId);
  return { ok: true };
}

async function tinCuaDuAn(id: string) {
  const t = await db.traoDoi.findUnique({
    where: { id },
    select: { projectId: true, doiTuong: true, tacGiaId: true },
  });
  return t?.doiTuong === "THAO_LUAN" && t.projectId ? { ...t, projectId: t.projectId } : null;
}

export async function ghimThaoLuan(id: string, ghim: boolean): Promise<KetQua> {
  const t = await tinCuaDuAn(id);
  if (!t) return { ok: false, error: "Không tìm thấy tin." };
  const denied = await denyProject("project", "edit", t.projectId, "Chỉ người quản lý dự án được ghim / bỏ ghim.");
  if (denied) return denied;
  await db.traoDoi.update({ where: { id }, data: { ghim: !!ghim } });
  lamMoi(t.projectId);
  return { ok: true };
}

/** Xóa tin: người đăng hoặc Quản trị. */
export async function xoaThaoLuan(id: string): Promise<KetQua> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  const t = await tinCuaDuAn(id);
  if (!t) return { ok: false, error: "Không tìm thấy tin." };
  if (t.tacGiaId !== session.userId && session.role !== "ADMIN")
    return { ok: false, error: "Chỉ người đăng hoặc Quản trị được xóa." };
  await db.traoDoi.delete({ where: { id } });
  lamMoi(t.projectId);
  return { ok: true };
}
