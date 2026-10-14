"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { MILESTONE_TYPE_MAP, QC_LOAI_MAP } from "@/lib/constants";
import { ROLES } from "@/lib/rbac";
import { chuanTieuChi } from "@/lib/qc";

type Result = { ok: true } | { ok: false; error: string };
const CHI_ADMIN = "Chỉ Ban giám đốc / Quản lý được sửa mẫu QC.";
const FIELDS = ["giaiDoan", "noiDung", "boPhan", "loai", "tieuChi", "active"] as const;

async function admin() {
  const s = await requireSession();
  return s.role === "ADMIN" ? s : null;
}

export async function luuQcMau(v: {
  id?: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
  loai: string;
  tieuChi?: string | null;
}): Promise<Result> {
  const s = await admin();
  if (!s) return { ok: false, error: CHI_ADMIN };
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
    tieuChi: chuanTieuChi(v.tieuChi),
  };

  if (v.id) {
    const truoc = await db.qcMau.findUnique({ where: { id: v.id } });
    if (!truoc) return { ok: false, error: "Không tìm thấy mục mẫu." };
    await db.qcMau.update({ where: { id: v.id }, data });
    await recordAudit({
      actor: s,
      entity: "QcMau",
      entityId: v.id,
      entityLabel: noiDung,
      action: "UPDATE",
      changes: diffFields(truoc, data, FIELDS),
    });
  } else {
    const max = await db.qcMau.aggregate({
      where: { giaiDoan: v.giaiDoan },
      _max: { thuTu: true },
    });
    const m = await db.qcMau.create({
      data: { ...data, thuTu: (max._max.thuTu ?? 0) + 1 },
    });
    await recordAudit({
      actor: s,
      entity: "QcMau",
      entityId: m.id,
      entityLabel: noiDung,
      action: "CREATE",
    });
  }
  revalidatePath("/qc-mau");
  return { ok: true };
}

export async function batTatQcMau(
  id: string,
  active: boolean,
): Promise<Result> {
  const s = await admin();
  if (!s) return { ok: false, error: CHI_ADMIN };
  const truoc = await db.qcMau.findUnique({ where: { id } });
  if (!truoc) return { ok: false, error: "Không tìm thấy mục mẫu." };
  await db.qcMau.update({ where: { id }, data: { active } });
  await recordAudit({
    actor: s,
    entity: "QcMau",
    entityId: id,
    entityLabel: truoc.noiDung,
    action: "UPDATE",
    changes: diffFields(truoc, { ...truoc, active }, FIELDS),
  });
  revalidatePath("/qc-mau");
  return { ok: true };
}

export async function doiThuTuQcMau(id: string, dir: -1 | 1): Promise<Result> {
  const s = await admin();
  if (!s) return { ok: false, error: CHI_ADMIN };
  const m = await db.qcMau.findUnique({ where: { id } });
  if (!m) return { ok: false, error: "Không tìm thấy mục mẫu." };
  const rows = await db.qcMau.findMany({
    where: { giaiDoan: m.giaiDoan },
    orderBy: { thuTu: "asc" },
    select: { id: true },
  });
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.$transaction(
    rows.map((r, k) =>
      db.qcMau.update({ where: { id: r.id }, data: { thuTu: k + 1 } }),
    ),
  );
  revalidatePath("/qc-mau");
  return { ok: true };
}
