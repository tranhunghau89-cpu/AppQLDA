"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, getSession } from "@/lib/auth";
import { canEditProject } from "@/lib/scope";
import type { Role } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";
import { baoThayDoi } from "@/lib/baoThayDoi";
import { nhanTinBaoHanh } from "@/lib/baoHanh";

type KetQua = { ok: true } | { ok: false; error: string };

const ngay = z
  .string()
  .trim()
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Ngày không hợp lệ.");

const taoSchema = z.object({
  tieuDe: z.string().trim().min(1, "Nhập lỗi cần bảo hành.").max(200),
  moTa: z.string().trim().max(2000),
  viTri: z.string().trim().max(200),
  nguoiBao: z.string().trim().max(200),
  ngayBao: ngay,
  mucDo: z.enum(["KHAN", "THUONG"]),
  phuTrachId: z.string(),
  hanXuLy: ngay,
});

const lamMoi = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/trao-doi");
  revalidatePath("/", "layout");
};

/** Người phụ trách phải đang hoạt động và là thành viên dự án. */
async function phuTrachHopLe(projectId: string, id: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } });
  return !!u?.active && canEditProject({ userId: u.id, role: u.role as Role } as SessionUser, projectId);
}

/** Ghi nhận phiếu bảo hành. Thành viên dự án nào cũng ghi được — CĐT gọi ai thì người đó ghi. */
export async function taoPhieuBaoHanh(projectId: string, input: z.input<typeof taoSchema>): Promise<KetQua> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  if (!(await canEditProject(session, projectId)))
    return { ok: false, error: "Bạn không có quyền với dự án này." };
  const p = taoSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const v = p.data;
  if (v.phuTrachId && !(await phuTrachHopLe(projectId, v.phuTrachId)))
    return { ok: false, error: "Người phụ trách không xem được dự án này." };

  const phieu = await db.phieuBaoHanh.create({
    data: {
      projectId,
      tieuDe: v.tieuDe,
      moTa: v.moTa || null,
      viTri: v.viTri || null,
      nguoiBao: v.nguoiBao || null,
      ngayBao: v.ngayBao ? new Date(v.ngayBao) : new Date(),
      mucDo: v.mucDo,
      phuTrachId: v.phuTrachId || null,
      hanXuLy: v.hanXuLy ? new Date(v.hanXuLy) : null,
      trangThai: v.phuTrachId ? "DANG_XU_LY" : "MOI",
      taoBoiId: session.userId,
      taoBoiTen: session.name,
    },
  });
  await baoThayDoi({
    projectId,
    nhom: "BAO_HANH",
    tacGia: session,
    noiDung: `${v.mucDo === "KHAN" ? "[KHẨN] " : ""}Phiếu bảo hành mới: ${v.tieuDe}${v.viTri ? ` (${v.viTri})` : ""}.`,
  });
  if (phieu.phuTrachId) await nhanTinBaoHanh(phieu, session, `Bạn được giao xử lý bảo hành: ${phieu.tieuDe}.`, true);
  lamMoi(projectId);
  return { ok: true };
}

const capNhatSchema = z.object({
  trangThai: z.enum(["MOI", "DANG_XU_LY", "DA_XONG", "TU_CHOI"]),
  phuTrachId: z.string(),
  hanXuLy: ngay,
  ketQua: z.string().trim().max(2000),
});

/** Giao người, đổi hạn, báo xong / từ chối. Người có quyền sửa dự án, hoặc chính người phụ trách. */
export async function capNhatPhieuBaoHanh(id: string, input: z.input<typeof capNhatSchema>): Promise<KetQua> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  const truoc = await db.phieuBaoHanh.findUnique({ where: { id } });
  if (!truoc || !(await canEditProject(session, truoc.projectId)))
    return { ok: false, error: "Không tìm thấy phiếu hoặc bạn không có quyền." };
  if (truoc.phuTrachId !== session.userId) {
    const denied = await denyProject("project", "edit", truoc.projectId, "Chỉ người phụ trách hoặc người quản lý dự án được cập nhật phiếu.");
    if (denied) return denied;
  }
  const p = capNhatSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const v = p.data;
  if ((v.trangThai === "DA_XONG" || v.trangThai === "TU_CHOI") && !v.ketQua)
    return { ok: false, error: v.trangThai === "DA_XONG" ? "Ghi đã xử lý thế nào." : "Ghi lý do từ chối." };
  const doiNguoi = v.phuTrachId !== (truoc.phuTrachId ?? "");
  if (doiNguoi && v.phuTrachId && !(await phuTrachHopLe(truoc.projectId, v.phuTrachId)))
    return { ok: false, error: "Người phụ trách không xem được dự án này." };

  const ketThuc = v.trangThai === "DA_XONG" || v.trangThai === "TU_CHOI";
  const sau = await db.phieuBaoHanh.update({
    where: { id },
    data: {
      trangThai: v.trangThai === "MOI" && v.phuTrachId ? "DANG_XU_LY" : v.trangThai,
      phuTrachId: v.phuTrachId || null,
      hanXuLy: v.hanXuLy ? new Date(v.hanXuLy) : null,
      ketQua: v.ketQua || null,
      xongLuc: ketThuc ? (truoc.xongLuc ?? new Date()) : null,
    },
  });

  if (doiNguoi && sau.phuTrachId)
    await nhanTinBaoHanh(sau, session, `Bạn được giao xử lý bảo hành: ${sau.tieuDe}.`, true);
  if (ketThuc && truoc.trangThai !== v.trangThai)
    await baoThayDoi({
      projectId: sau.projectId,
      nhom: "BAO_HANH",
      tacGia: session,
      noiDung: `Bảo hành "${sau.tieuDe}" ${v.trangThai === "DA_XONG" ? "đã xử lý xong" : "bị từ chối"}: ${v.ketQua}`,
    });
  lamMoi(sau.projectId);
  return { ok: true };
}

export async function xoaPhieuBaoHanh(id: string): Promise<KetQua> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  if (session.role !== "ADMIN") return { ok: false, error: "Chỉ quản trị viên được xóa phiếu." };
  const p = await db.phieuBaoHanh.delete({ where: { id } }).catch(() => null);
  if (p) lamMoi(p.projectId);
  return { ok: true };
}
