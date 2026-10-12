"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/scope";
import { isStorageConfigured, uploadFile } from "@/lib/storage";
import { MILESTONE_TYPE_MAP, QC_LOAI_MAP } from "@/lib/constants";
import { ROLES } from "@/lib/rbac";
import { duocDanhQc, kiemTraDanhGia } from "@/lib/qc";
import type { ActionResult } from "../actions";

const NO_EDIT = "Bạn không có quyền sửa danh mục QC.";
const TOI_DA_TEP = 5;
const TOI_DA_MB = 10;

function lamMoi(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/qc");
  revalidatePath("/projects/tong-quan");
}

/** Chép bộ mẫu đang bật sang dự án. Chỉ chạy khi dự án chưa có mục QC nào. */
export async function taoQcTuMau(projectId: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const mau = await db.qcMau.findMany({
    where: { active: true },
    orderBy: [{ giaiDoan: "asc" }, { thuTu: "asc" }],
  });
  if (mau.length === 0) return { ok: false, error: "Bộ mẫu QC đang trống." };

  // Kiểm "đã có" và tạo trong cùng transaction: bấm hai lần (hai tab) không nhân đôi mục.
  const daCo = await db.$transaction(async (tx) => {
    if ((await tx.qcMuc.count({ where: { projectId } })) > 0) return true;
    await tx.qcMuc.createMany({
      data: mau.map((m) => ({
        projectId,
        giaiDoan: m.giaiDoan,
        noiDung: m.noiDung,
        boPhan: m.boPhan,
        loai: m.loai,
        thuTu: m.thuTu,
      })),
    });
    return false;
  });
  if (daCo) return { ok: false, error: "Dự án đã có danh mục QC." };
  lamMoi(projectId);
  return { ok: true };
}

export async function luuQcMuc(
  projectId: string,
  v: {
    id?: string;
    giaiDoan: string;
    noiDung: string;
    boPhan: string;
    loai: string;
  },
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const noiDung = v.noiDung.trim();
  if (!noiDung) return { ok: false, error: "Nhập nội dung mục kiểm tra." };
  if (!(v.giaiDoan in MILESTONE_TYPE_MAP))
    return { ok: false, error: "Giai đoạn không hợp lệ." };
  if (!(ROLES as readonly string[]).includes(v.boPhan))
    return { ok: false, error: "Bộ phận không hợp lệ." };
  if (!(v.loai in QC_LOAI_MAP))
    return { ok: false, error: "Loại mục không hợp lệ." };

  const data = {
    giaiDoan: v.giaiDoan,
    noiDung,
    boPhan: v.boPhan,
    loai: v.loai,
  };
  if (v.id) {
    const n = await db.qcMuc.updateMany({
      where: { id: v.id, projectId },
      data,
    });
    if (n.count === 0) return { ok: false, error: "Không tìm thấy mục QC." };
  } else {
    const max = await db.qcMuc.aggregate({
      where: { projectId, giaiDoan: v.giaiDoan },
      _max: { thuTu: true },
    });
    await db.qcMuc.create({
      data: { ...data, projectId, thuTu: (max._max.thuTu ?? 0) + 1 },
    });
  }
  lamMoi(projectId);
  return { ok: true };
}

export async function xoaQcMuc(
  projectId: string,
  id: string,
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  await db.qcMuc.deleteMany({ where: { id, projectId } });
  lamMoi(projectId);
  return { ok: true };
}

/**
 * Đánh kết quả một mục. Quyền theo BỘ PHẬN của mục (không theo ma trận RBAC):
 * người đúng bộ phận hoặc ADMIN, và phải xem được dự án.
 */
export async function danhGiaQc(
  projectId: string,
  mucId: string,
  form: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await canAccessProject(session, projectId)))
    return { ok: false, error: "Bạn không có quyền với dự án này." };
  const muc = await db.qcMuc.findFirst({ where: { id: mucId, projectId } });
  if (!muc) return { ok: false, error: "Không tìm thấy mục QC." };
  if (!duocDanhQc(session.role, muc.boPhan))
    return { ok: false, error: "Mục này thuộc bộ phận khác." };

  const ketQua = String(form.get("ketQua") ?? "");
  const ghiChu = String(form.get("ghiChu") ?? "").trim();
  const loi = kiemTraDanhGia({ ketQua, ghiChu });
  if (loi) return { ok: false, error: loi };
  if (ghiChu.length > 2000)
    return { ok: false, error: "Ghi chú quá dài (tối đa 2000 ký tự)." };

  // Kiểm hết tệp TRƯỚC khi ghi gì: lỗi giữa chừng không để lại lần kiểm dở dang.
  const tep = form
    .getAll("tep")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (tep.length > TOI_DA_TEP)
    return { ok: false, error: `Tối đa ${TOI_DA_TEP} tệp mỗi lần kiểm.` };
  for (const f of tep) {
    if (!f.type.startsWith("image/") && f.type !== "application/pdf")
      return { ok: false, error: `"${f.name}" không phải ảnh hoặc PDF.` };
    if (f.size > TOI_DA_MB * 1024 * 1024)
      return { ok: false, error: `"${f.name}" vượt ${TOI_DA_MB}MB.` };
  }
  if (tep.length > 0 && !isStorageConfigured())
    return { ok: false, error: "Chưa cấu hình kho lưu tệp." };

  const now = new Date();
  const lan = await db.$transaction(async (tx) => {
    const lan = await tx.qcLanKiem.create({
      data: {
        mucId,
        ketQua,
        ghiChu: ghiChu || null,
        nguoiId: session.userId,
        nguoiTen: session.name,
        nguoiVai: session.role,
        createdAt: now,
      },
    });
    await tx.qcMuc.update({
      where: { id: mucId },
      data: {
        ketQua,
        ghiChu: ghiChu || null,
        nguoiKiem: session.name,
        ngayKiem: now,
      },
    });
    return lan;
  });

  for (const f of tep) {
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const key = `qc/${projectId}/${lan.id}/${Date.now()}-${safe}`;
    await uploadFile(key, Buffer.from(await f.arrayBuffer()), f.type);
    await db.qcTep.create({
      data: { lanKiemId: lan.id, key, ten: f.name, mime: f.type },
    });
  }

  lamMoi(projectId);
  return { ok: true };
}
