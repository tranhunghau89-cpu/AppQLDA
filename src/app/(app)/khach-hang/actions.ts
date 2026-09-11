"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { KHACH_NGUON_MAP } from "@/lib/constants";
import { duocDungKhachHang } from "@/lib/crmScope";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const KH_AUDIT_FIELDS = [
  "tenCty",
  "nguoiLienHe",
  "phone",
  "email",
  "diaChi",
  "nguon",
  "ownerId",
  "note",
] as const;

const schema = z.object({
  tenCty: z.string().trim().min(1, "Tên khách không được để trống"),
  nguoiLienHe: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  diaChi: z.string().trim().optional(),
  nguon: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const s = (form: FormData, key: string) => String(form.get(key) ?? "");

function fields(form: FormData) {
  return {
    tenCty: s(form, "tenCty"),
    nguoiLienHe: s(form, "nguoiLienHe"),
    phone: s(form, "phone"),
    email: s(form, "email"),
    diaChi: s(form, "diaChi"),
    nguon: s(form, "nguon"),
    ownerId: s(form, "ownerId"),
    note: s(form, "note"),
  };
}

const paths = () => revalidatePath("/khach-hang");

/**
 * Chặn khi thiếu quyền, rồi đối chiếu người phụ trách.
 *
 * `id` đến từ trình duyệt. Bỏ bước thứ hai là để một nhân viên sửa được khách của
 * người khác chỉ bằng cách đổi một id trong request.
 */
async function guard(id: string | null) {
  let actor;
  try {
    actor = await requirePermission("customer", "edit");
  } catch {
    return { loi: { ok: false as const, error: "Bạn không có quyền quản lý khách hàng." } };
  }
  if (!id) return { actor };

  const kh = await db.khachHang.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!kh) return { loi: { ok: false as const, error: "Không tìm thấy khách hàng." } };
  if (!duocDungKhachHang(actor, kh.ownerId)) {
    return { loi: { ok: false as const, error: "Khách này do người khác phụ trách." } };
  }
  return { actor };
}

export async function saveKhachHang(
  id: string | null,
  form: FormData
): Promise<CreateResult> {
  const g = await guard(id);
  if (g.loi) return g.loi;
  const actor = g.actor!;

  const parsed = schema.safeParse(fields(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.nguon && !KHACH_NGUON_MAP[d.nguon]) {
    return { ok: false, error: "Nguồn khách không hợp lệ." };
  }

  // Người phụ trách:
  //   · Nhân viên: LUÔN là chính mình. Không thì họ tạo xong là mất quyền xem ngay.
  //   · Quản trị viên: đúng thứ họ chọn, kể cả để trống — ô chọn có sẵn mục "Chưa phân
  //     công", nên trống là một lựa chọn có ý, không phải bỏ sót.
  let ownerId = d.ownerId || null;
  if (actor.role !== "ADMIN") ownerId = actor.userId;

  let ownerName: string | null = null;
  if (ownerId) {
    const u = await db.user.findUnique({ where: { id: ownerId }, select: { name: true } });
    if (!u) return { ok: false, error: "Không tìm thấy người phụ trách." };
    ownerName = u.name;
  }

  const data = {
    tenCty: d.tenCty,
    nguoiLienHe: d.nguoiLienHe || null,
    phone: d.phone || null,
    email: d.email || null,
    diaChi: d.diaChi || null,
    nguon: d.nguon || null,
    ownerId,
    ownerName,
    note: d.note || null,
  };

  const truoc = id
    ? await db.khachHang.findUnique({
        where: { id },
        select: Object.fromEntries(KH_AUDIT_FIELDS.map((f) => [f, true])) as Record<
          (typeof KH_AUDIT_FIELDS)[number],
          true
        >,
      })
    : null;

  const row = id
    ? await db.khachHang.update({ where: { id }, data })
    : await db.khachHang.create({ data });

  await recordAudit({
    actor: await requireSession(),
    entity: "KhachHang",
    entityId: row.id,
    entityLabel: d.tenCty,
    projectId: null,
    action: id ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, KH_AUDIT_FIELDS),
  });

  paths();
  return { ok: true, id: row.id };
}

export async function deleteKhachHang(id: string): Promise<ActionResult> {
  const g = await guard(id);
  if (g.loi) return g.loi;

  const kh = await db.khachHang.findUnique({
    where: { id },
    select: { tenCty: true, customerId: true },
  });
  if (!kh) return { ok: false, error: "Không tìm thấy khách hàng." };
  // Đã ký hợp đồng rồi thì không xóa: bên quản lý dự án đang trỏ ngược về đây để biết
  // CĐT này từ đâu ra.
  if (kh.customerId) {
    return {
      ok: false,
      error: "Khách này đã chuyển thành chủ đầu tư — không xóa được.",
    };
  }

  // Nhật ký trao đổi đi theo (onDelete: Cascade). Xóa khách là xóa cả lịch sử, nên
  // giao diện phải hỏi lại cho rõ.
  await db.khachHang.delete({ where: { id } });

  await recordAudit({
    actor: await requireSession(),
    entity: "KhachHang",
    entityId: id,
    entityLabel: kh.tenCty,
    projectId: null,
    action: "DELETE",
    changes: null,
  });

  paths();
  return { ok: true };
}
