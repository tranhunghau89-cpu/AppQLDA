"use server";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";

export interface MoTaMauView {
  id: string;
  noiDung: string;
  createdByName: string | null;
  /** Người đang xem xóa được mẫu này không (người tạo hoặc quản trị viên). */
  xoaDuoc: boolean;
}

type KetQua = { ok: true } | { ok: false; error: string };

/** Chuẩn hóa để so trùng: bỏ khoảng trắng thừa đầu/cuối từng dòng và dòng trống. */
function chuan(s: string): string {
  return s
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean)
    .join("\n");
}

export async function danhSachMoTaMau(): Promise<MoTaMauView[]> {
  const s = await requireSession();
  if (!can(s.role as Role, "quote", "view")) return [];
  const rows = await db.moTaMau.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map((r) => ({
    id: r.id,
    noiDung: r.noiDung,
    createdByName: r.createdByName,
    xoaDuoc: s.role === "ADMIN" || r.createdById === s.userId,
  }));
}

export async function luuMoTaMau(noiDung: string): Promise<KetQua> {
  const s = await requireSession();
  if (!can(s.role as Role, "quote", "edit")) {
    return { ok: false, error: "Bạn không có quyền lưu mẫu mô tả." };
  }
  const nd = chuan(noiDung);
  if (!nd) return { ok: false, error: "Mô tả đang trống." };
  if (nd.length > 4000) return { ok: false, error: "Mô tả quá dài." };
  // Lưu hai lần cùng một đoạn chỉ làm danh sách rối thêm.
  const trung = await db.moTaMau.findFirst({ where: { noiDung: nd }, select: { id: true } });
  if (trung) return { ok: true };
  await db.moTaMau.create({
    data: { noiDung: nd, createdById: s.userId, createdByName: s.name },
  });
  return { ok: true };
}

export async function xoaMoTaMau(id: string): Promise<KetQua> {
  const s = await requireSession();
  const r = await db.moTaMau.findUnique({ where: { id }, select: { createdById: true } });
  if (!r) return { ok: true };
  if (s.role !== "ADMIN" && r.createdById !== s.userId) {
    return { ok: false, error: "Chỉ người tạo hoặc quản trị viên mới xóa được mẫu này." };
  }
  await db.moTaMau.delete({ where: { id } });
  return { ok: true };
}
