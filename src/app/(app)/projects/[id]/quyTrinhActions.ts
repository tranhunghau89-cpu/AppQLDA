"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/session";
import { canAccessProject } from "@/lib/scope";
import {
  TEN_BUOC,
  TRANG_THAI_SAU,
  duocDuyetBuoc,
  loiChuyen,
  type ChiDinhDuyet,
  type HanhDong,
} from "@/lib/quyTrinh";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { napQuyTrinh, nhanTinBuoc } from "@/lib/quyTrinhDb";
import type { ActionResult } from "../actions";

const NO_EDIT = "Bạn không có quyền sửa quy trình dự án này.";

function lamMoi(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/trao-doi");
  revalidatePath("/quy-trinh");
  revalidatePath("/", "layout");
}

async function adminIds() {
  const ds = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  return ds.map((u) => u.id);
}

/** Người nhận tin "Xin duyệt": người chỉ định > cả phòng chỉ định (xem được dự án) > Ban giám đốc. */
async function nguoiDuyetIds(
  session: SessionUser,
  projectId: string,
  b: ChiDinhDuyet,
): Promise<string[]> {
  if (b.duyetNguoiId) return [b.duyetNguoiId];
  if (b.duyetBoPhan) {
    const ds = await db.user.findMany({
      where: { role: b.duyetBoPhan, active: true },
      select: { id: true, role: true },
    });
    const xem = await Promise.all(
      ds.map((u) =>
        canAccessProject({ ...session, userId: u.id, role: u.role as Role }, projectId),
      ),
    );
    const ids = ds.filter((_, i) => xem[i]).map((u) => u.id);
    if (ids.length) return ids;
  }
  return adminIds();
}

/** Gửi duyệt / Duyệt / Trả lại một bước. */
export async function chuyenBuoc(
  projectId: string,
  buoc: string,
  hanhDong: HanhDong,
  ghiChu: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await canAccessProject(session, projectId)))
    return { ok: false, error: "Bạn không có quyền với dự án này." };
  if (!(buoc in TEN_BUOC)) return { ok: false, error: "Bước không hợp lệ." };
  const nd = ghiChu.trim();
  if (nd.length > 2000) return { ok: false, error: "Ghi chú quá dài (tối đa 2000 ký tự)." };

  const chuoi = await napQuyTrinh(projectId);
  const i = chuoi.findIndex((b) => b.buoc === buoc);
  const b = chuoi[i];
  const loi = loiChuyen(hanhDong, b.trangThai);
  if (loi) return { ok: false, error: loi };

  if (hanhDong === "GUI") {
    // Người phụ trách, hoặc người có quyền sửa dự án.
    if (b.phuTrachId !== session.userId) {
      const denied = await denyProject("project", "edit", projectId, NO_EDIT);
      if (denied) return denied;
    }
    if (b.chuaDu) return { ok: false, error: b.chuaDu };
  } else {
    if (!duocDuyetBuoc(session, b))
      return {
        ok: false,
        error: b.duyetNguoiId
          ? `Bước này chỉ định ${b.duyetNguoiTen ?? "người khác"} duyệt.`
          : b.duyetBoPhan
            ? `Bước này do phòng ${ROLE_LABEL[b.duyetBoPhan as Role] ?? b.duyetBoPhan} duyệt.`
            : "Chỉ Ban giám đốc / Quản lý được duyệt.",
      };
    if (hanhDong === "TRA_LAI" && !nd)
      return { ok: false, error: "Nhập lý do trả lại." };
  }

  const now = new Date();
  // Khoá lạc quan theo trạng thái cũ: hai người bấm cùng lúc thì chỉ một người thắng.
  const n = await db.buocQuyTrinh.updateMany({
    where: {
      id: b.id,
      trangThai: hanhDong === "GUI" ? { in: ["DANG_LAM", "TRA_LAI"] } : "CHO_DUYET",
    },
    data:
      hanhDong === "GUI"
        ? { trangThai: TRANG_THAI_SAU.GUI, guiLuc: now }
        : hanhDong === "DUYET"
          ? { trangThai: TRANG_THAI_SAU.DUYET, duyetLuc: now, nguoiDuyetId: session.userId }
          : { trangThai: TRANG_THAI_SAU.TRA_LAI, duyetLuc: null, nguoiDuyetId: null },
  });
  if (n.count === 0) return { ok: false, error: "Bước vừa được người khác cập nhật — tải lại trang." };

  const p = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
  const nhanDe = `${p?.code ?? ""} · ${b.ten}`;
  const tacGia = { userId: session.userId, name: session.name };
  const phuTrach = b.phuTrachId ? [b.phuTrachId] : [];

  if (hanhDong === "GUI") {
    await nhanTinBuoc({
      buocId: b.id, projectId, nhanDe, tacGia, loai: "XIN_DUYET",
      noiDung: nd || `Xin duyệt bước ${b.ten}.`,
      nguoiNhanIds: await nguoiDuyetIds(session, projectId, b),
    });
  } else if (hanhDong === "TRA_LAI") {
    await nhanTinBuoc({
      buocId: b.id, projectId, nhanDe, tacGia, loai: "CAN_SUA",
      noiDung: nd, nguoiNhanIds: phuTrach,
    });
  } else {
    await nhanTinBuoc({
      buocId: b.id, projectId, nhanDe, tacGia, loai: "DONG_Y",
      noiDung: nd || `Đã duyệt bước ${b.ten}.`, nguoiNhanIds: phuTrach,
    });
    // Báo người phụ trách bước kế tiếp (bỏ qua các bước không có QC).
    const ke = chuoi.slice(i + 1).find((x) => x.trangThai !== "BO_QUA" && x.trangThai !== "DA_DUYET");
    if (ke?.phuTrachId) {
      await nhanTinBuoc({
        buocId: ke.id, projectId, nhanDe: `${p?.code ?? ""} · ${ke.ten}`, tacGia, loai: "GHI_CHU",
        noiDung: `${b.ten} đã được duyệt — đến lượt bước ${ke.ten}.`,
        nguoiNhanIds: [ke.phuTrachId],
      });
    }
  }
  lamMoi(projectId);
  return { ok: true };
}

/** Giao người phụ trách và hạn xử lý. hanXuLy rỗng = theo ngày kế hoạch của mốc tiến độ. */
export async function giaoBuoc(
  projectId: string,
  buoc: string,
  v: { phuTrachId: string | null; hanXuLy: string | null },
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const session = await requireSession();
  if (!(buoc in TEN_BUOC)) return { ok: false, error: "Bước không hợp lệ." };
  if (v.phuTrachId) {
    const u = await db.user.findUnique({ where: { id: v.phuTrachId }, select: { active: true, role: true } });
    if (!u?.active) return { ok: false, error: "Người được giao không còn hoạt động." };
    if (!(await canAccessProject({ ...session, userId: v.phuTrachId, role: u.role as never }, projectId)))
      return { ok: false, error: "Người được giao không có quyền xem dự án này — thêm vào thành viên trước." };
  }
  const han = v.hanXuLy ? new Date(v.hanXuLy) : null;
  if (han && Number.isNaN(han.getTime())) return { ok: false, error: "Hạn không hợp lệ." };

  await napQuyTrinh(projectId); // đảm bảo dòng bước đã có
  const truoc = await db.buocQuyTrinh.findUniqueOrThrow({
    where: { projectId_buoc: { projectId, buoc } },
  });
  await db.buocQuyTrinh.update({
    where: { id: truoc.id },
    data: { phuTrachId: v.phuTrachId, hanXuLy: han },
  });
  if (v.phuTrachId && v.phuTrachId !== truoc.phuTrachId) {
    const p = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
    await nhanTinBuoc({
      buocId: truoc.id, projectId, nhanDe: `${p?.code ?? ""} · ${TEN_BUOC[buoc]}`,
      tacGia: { userId: session.userId, name: session.name }, loai: "GHI_CHU",
      noiDung: `Bạn được giao phụ trách bước ${TEN_BUOC[buoc]}.`,
      nguoiNhanIds: [v.phuTrachId],
    });
  }
  lamMoi(projectId);
  return { ok: true };
}

/**
 * Chỉ định ai duyệt bước: một phòng, hoặc một người cụ thể (phòng = phòng của người đó).
 * Cả hai trống = Ban giám đốc duyệt như mặc định.
 */
export async function chiDinhDuyet(
  projectId: string,
  buoc: string,
  v: { duyetBoPhan: string | null; duyetNguoiId: string | null },
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const session = await requireSession();
  if (!(buoc in TEN_BUOC)) return { ok: false, error: "Bước không hợp lệ." };

  let boPhan = v.duyetBoPhan || null;
  const nguoiId = v.duyetNguoiId || null;
  if (boPhan && !(ROLES as readonly string[]).includes(boPhan))
    return { ok: false, error: "Phòng duyệt không hợp lệ." };
  if (nguoiId) {
    const u = await db.user.findUnique({
      where: { id: nguoiId },
      select: { active: true, role: true },
    });
    if (!u?.active) return { ok: false, error: "Người duyệt không còn hoạt động." };
    if (!(await canAccessProject({ ...session, userId: nguoiId, role: u.role as never }, projectId)))
      return { ok: false, error: "Người duyệt không xem được dự án này — thêm vào thành viên trước." };
    boPhan = u.role;
  }

  await napQuyTrinh(projectId); // đảm bảo dòng bước đã có
  const truoc = await db.buocQuyTrinh.findUniqueOrThrow({
    where: { projectId_buoc: { projectId, buoc } },
  });
  await db.buocQuyTrinh.update({
    where: { id: truoc.id },
    data: { duyetBoPhan: boPhan, duyetNguoiId: nguoiId },
  });

  if (nguoiId && nguoiId !== truoc.duyetNguoiId) {
    const p = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
    await nhanTinBuoc({
      buocId: truoc.id, projectId, nhanDe: `${p?.code ?? ""} · ${TEN_BUOC[buoc]}`,
      tacGia: { userId: session.userId, name: session.name }, loai: "GHI_CHU",
      noiDung:
        truoc.trangThai === "CHO_DUYET"
          ? `Bạn được chỉ định duyệt bước ${TEN_BUOC[buoc]} — bước đang chờ duyệt.`
          : `Bạn được chỉ định duyệt bước ${TEN_BUOC[buoc]}.`,
      nguoiNhanIds: [nguoiId],
    });
  }
  lamMoi(projectId);
  return { ok: true };
}
