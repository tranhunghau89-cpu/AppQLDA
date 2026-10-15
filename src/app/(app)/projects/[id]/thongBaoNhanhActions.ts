"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/scope";
import { ROLES } from "@/lib/rbac";
import { TEN_NHOM_THAY_DOI, nguoiNhanDuAn } from "@/lib/baoThayDoi";

const schema = z.object({
  nhom: z.enum(["VAT_TU", "TIEN_DO", "THIET_KE", "HOP_DONG", "THANH_TOAN", "KHAC"]),
  canXuLy: z.boolean(),
  phong: z.array(z.enum(ROLES)).max(ROLES.length),
  thanhVien: z.boolean(),
  nguoiIds: z.array(z.string().min(1)).max(50),
  noiDung: z.string().trim().min(1, "Nhập nội dung thông báo.").max(2000, "Nội dung tối đa 2000 ký tự."),
});

/**
 * Thông báo nhanh tới các bộ phận về một dự án (điều chỉnh vật tư, giục tiến độ, yêu
 * cầu kiểm tra lại quy cách…). Ai xem được dự án là gửi được; người nhận lọc theo phạm vi.
 */
export async function guiThongBaoNhanh(
  projectId: string,
  input: z.input<typeof schema>,
): Promise<{ ok: true; soNguoi: number } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  if (!(await canAccessProject(session, projectId)))
    return { ok: false, error: "Bạn không có quyền với dự án này." };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const v = p.data;

  const duAn = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, members: { select: { userId: true } } },
  });
  if (!duAn) return { ok: false, error: "Không tìm thấy dự án." };

  const nhan = await nguoiNhanDuAn(projectId, {
    phong: v.phong,
    ids: [...v.nguoiIds, ...(v.thanhVien ? duAn.members.map((m) => m.userId) : [])],
    truId: session.userId,
  });
  if (nhan.length === 0)
    return { ok: false, error: "Không có ai nhận: chọn bộ phận hoặc người xem được dự án này." };

  await db.traoDoi.create({
    data: {
      doiTuong: v.nhom,
      doiTuongId: projectId,
      projectId,
      nhanDe: `${duAn.code} · ${TEN_NHOM_THAY_DOI[v.nhom]}`,
      // "Cần sửa" để nổi bật trong hộp thư: việc này người nhận phải làm, không chỉ đọc.
      loai: v.canXuLy ? "CAN_SUA" : "GHI_CHU",
      noiDung: v.noiDung,
      tacGiaId: session.userId,
      tacGiaTen: session.name,
      nguoiNhan: { create: nhan.map((userId) => ({ userId })) },
    },
  });
  revalidatePath("/trao-doi");
  revalidatePath("/", "layout");
  return { ok: true, soNguoi: nhan.length };
}
