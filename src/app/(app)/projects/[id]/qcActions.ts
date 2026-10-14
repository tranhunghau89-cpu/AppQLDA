"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/scope";
import { isStorageConfigured, uploadFile } from "@/lib/storage";
import { QC_GIAI_DOAN_MAP, QC_LOAI_MAP, QC_NHOM_MAP } from "@/lib/constants";
import { ROLES } from "@/lib/rbac";
import { chuanTieuChi, dongTieuChi, duocDanhQc, kiemTraDanhGia } from "@/lib/qc";
import { moLaiBuocQc } from "@/lib/quyTrinhDb";
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

  // Khoá theo dự án rồi mới kiểm "đã có": ở READ COMMITTED, count-rồi-insert không khoá
  // gì, hai yêu cầu chồng nhau (hai tab, bấm lại khi chậm) sẽ cùng thấy 0 và cùng chép.
  // Khoá advisory tự nhả khi transaction kết thúc.
  const daCo = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"qc:" + projectId}))::text`;
    if ((await tx.qcMuc.count({ where: { projectId } })) > 0) return true;
    await tx.qcMuc.createMany({
      data: mau.map((m) => ({
        projectId,
        giaiDoan: m.giaiDoan,
        noiDung: m.noiDung,
        boPhan: m.boPhan,
        nhom: m.nhom,
        loai: m.loai,
        tieuChi: m.tieuChi,
        thuTu: m.thuTu,
      })),
    });
    return false;
  });
  if (daCo) return { ok: false, error: "Dự án đã có danh mục QC." };
  lamMoi(projectId);
  return { ok: true };
}

/** Dự án đã có QC nhưng thiếu cả một giai đoạn (vd. giai đoạn mới thêm vào mẫu): chép mẫu riêng giai đoạn đó. */
export async function chepMauGiaiDoan(
  projectId: string,
  giaiDoan: string,
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  if (!(giaiDoan in QC_GIAI_DOAN_MAP))
    return { ok: false, error: "Giai đoạn không hợp lệ." };
  const mau = await db.qcMau.findMany({
    where: { active: true, giaiDoan },
    orderBy: { thuTu: "asc" },
  });
  if (mau.length === 0)
    return { ok: false, error: "Giai đoạn này chưa có mục mẫu nào." };

  const daCo = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"qc:" + projectId}))::text`;
    if ((await tx.qcMuc.count({ where: { projectId, giaiDoan } })) > 0) return true;
    await tx.qcMuc.createMany({
      data: mau.map((m) => ({
        projectId,
        giaiDoan: m.giaiDoan,
        noiDung: m.noiDung,
        boPhan: m.boPhan,
        nhom: m.nhom,
        loai: m.loai,
        tieuChi: m.tieuChi,
        thuTu: m.thuTu,
      })),
    });
    return false;
  });
  if (daCo) return { ok: false, error: "Giai đoạn này đã có mục QC." };
  lamMoi(projectId);
  return { ok: true };
}

/**
 * Chép các mục Việc cần làm / Hồ sơ cần có của mẫu mà dự án còn thiếu (so theo giai đoạn
 * + nội dung). Mục Kiểm tra không chép bù — dự án có thể đã sửa chữ, chép lại sẽ trùng.
 */
export async function boSungViecHoSoTuMau(projectId: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const n = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"qc:" + projectId}))::text`;
    const [mau, coSan] = await Promise.all([
      tx.qcMau.findMany({
        where: { active: true, nhom: { in: ["VIEC", "HO_SO"] } },
        orderBy: { thuTu: "asc" },
      }),
      tx.qcMuc.findMany({ where: { projectId }, select: { giaiDoan: true, noiDung: true } }),
    ]);
    const da = new Set(coSan.map((m) => `${m.giaiDoan}|${m.noiDung}`));
    const thieu = mau.filter((m) => !da.has(`${m.giaiDoan}|${m.noiDung}`));
    if (thieu.length === 0) return 0;
    await tx.qcMuc.createMany({
      data: thieu.map((m) => ({
        projectId,
        giaiDoan: m.giaiDoan,
        noiDung: m.noiDung,
        boPhan: m.boPhan,
        nhom: m.nhom,
        loai: m.loai,
        tieuChi: m.tieuChi,
        thuTu: m.thuTu,
      })),
    });
    return thieu.length;
  });
  if (n === 0) return { ok: false, error: "Dự án đã có đủ việc và hồ sơ theo mẫu." };
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
    nhom: string;
    loai: string;
    tieuChi?: string | null;
  },
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const noiDung = v.noiDung.trim();
  if (!noiDung) return { ok: false, error: "Nhập nội dung mục kiểm tra." };
  if (!(v.giaiDoan in QC_GIAI_DOAN_MAP))
    return { ok: false, error: "Giai đoạn không hợp lệ." };
  if (!(ROLES as readonly string[]).includes(v.boPhan))
    return { ok: false, error: "Bộ phận không hợp lệ." };
  if (!(v.nhom in QC_NHOM_MAP))
    return { ok: false, error: "Nhóm mục không hợp lệ." };
  if (!(v.loai in QC_LOAI_MAP))
    return { ok: false, error: "Loại mục không hợp lệ." };

  const data = {
    giaiDoan: v.giaiDoan,
    noiDung,
    boPhan: v.boPhan,
    nhom: v.nhom,
    // Đối chiếu vật tư chỉ có nghĩa với mục kiểm tra.
    loai: v.nhom === "KIEM_TRA" ? v.loai : "THUONG",
    tieuChi: chuanTieuChi(v.tieuChi),
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
  // Kiểm hết tệp TRƯỚC khi ghi gì: lỗi giữa chừng không để lại lần kiểm dở dang.
  const tep = form
    .getAll("tep")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const loi = kiemTraDanhGia({ ketQua, ghiChu, nhom: muc.nhom, soTep: tep.length });
  if (loi) return { ok: false, error: loi };
  if (ghiChu.length > 2000)
    return { ok: false, error: "Ghi chú quá dài (tối đa 2000 ký tự)." };
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

  // Tải tệp TRƯỚC, ghi DB SAU (một transaction): tải hỏng giữa chừng thì không có lần
  // kiểm nào mang kết quả mà thiếu bằng chứng. Tệp đã lên kho của lần hỏng thành rác lưu
  // trữ — chấp nhận, giống ảnh nhật ký.
  const lanId = randomUUID();
  const daTai: { key: string; ten: string; mime: string }[] = [];
  try {
    for (const f of tep) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const key = `qc/${projectId}/${lanId}/${Date.now()}-${safe}`;
      await uploadFile(key, Buffer.from(await f.arrayBuffer()), f.type);
      daTai.push({ key, ten: f.name, mime: f.type });
    }
  } catch {
    return { ok: false, error: "Không tải được tệp lên kho. Thử lại sau." };
  }

  const now = new Date();
  await db.$transaction([
    db.qcLanKiem.create({
      data: {
        id: lanId,
        mucId,
        ketQua,
        ghiChu: ghiChu || null,
        nguoiId: session.userId,
        nguoiTen: session.name,
        nguoiVai: session.role,
        createdAt: now,
        tep: { create: daTai },
      },
    }),
    db.qcMuc.update({
      where: { id: mucId },
      data: {
        ketQua,
        ghiChu: ghiChu || null,
        nguoiKiem: session.name,
        ngayKiem: now,
      },
    }),
  ]);
  if (ketQua === "KHONG_DAT")
    await moLaiBuocQc(projectId, muc.giaiDoan, { userId: session.userId, name: session.name }, muc.noiDung);

  lamMoi(projectId);
  return { ok: true };
}

/** Ghi chú cho một tiêu chí con (cần chỉnh sửa, vướng gì). Chuỗi rỗng = xoá ghi chú. */
export async function ghiChuTieuChiQc(
  projectId: string,
  mucId: string,
  tieuChi: string,
  ghiChu: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await canAccessProject(session, projectId)))
    return { ok: false, error: "Bạn không có quyền với dự án này." };
  const muc = await db.qcMuc.findFirst({ where: { id: mucId, projectId } });
  if (!muc) return { ok: false, error: "Không tìm thấy mục QC." };
  if (!duocDanhQc(session.role, muc.boPhan)) {
    const denied = await denyProject("project", "edit", projectId, NO_EDIT);
    if (denied) return denied;
  }
  if (!dongTieuChi(muc.tieuChi).includes(tieuChi))
    return { ok: false, error: "Tiêu chí không còn trong mục — tải lại trang." };
  const nd = ghiChu.trim();
  if (nd.length > 1000)
    return { ok: false, error: "Ghi chú quá dài (tối đa 1000 ký tự)." };

  const cu = (muc.ghiChuTc ?? {}) as Record<string, string>;
  const moi: Record<string, string> = {};
  // Bỏ luôn ghi chú của tiêu chí đã bị xoá khỏi mục.
  for (const t of dongTieuChi(muc.tieuChi)) if (cu[t]) moi[t] = cu[t];
  if (nd) moi[tieuChi] = nd;
  else delete moi[tieuChi];
  await db.qcMuc.update({ where: { id: mucId }, data: { ghiChuTc: moi } });
  lamMoi(projectId);
  return { ok: true };
}
