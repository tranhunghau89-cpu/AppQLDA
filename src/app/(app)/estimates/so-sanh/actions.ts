"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { ESTIMATE_GROUP_MAP } from "@/lib/constants";

export type ActionResult = { ok: true; soDong?: number } | { ok: false; error: string };

const KHOA = z.string().min(3).max(500);

async function chanSua(): Promise<{ ok: false; error: string } | { session: Awaited<ReturnType<typeof requireSession>> }> {
  const session = await requireSession();
  if (!can(session.role as Role, "estimate", "edit")) return { ok: false, error: "Bạn không có quyền gộp đầu việc." };
  return { session };
}

/** Gộp các đầu việc `nguon` vào `dich`. Đích đã là nguồn của một gộp khác thì nối tới đích cuối. */
export async function gopDauViec(
  nguon: { khoa: string; ten: string }[],
  dich: { khoa: string; ten: string }
): Promise<ActionResult> {
  const g = await chanSua();
  if ("ok" in g) return g;
  const p = z
    .object({ nguon: z.array(z.object({ khoa: KHOA, ten: z.string().max(300) })).min(1).max(100), dich: z.object({ khoa: KHOA, ten: z.string().max(300) }) })
    .safeParse({ nguon, dich });
  if (!p.success) return { ok: false, error: "Dữ liệu gộp không hợp lệ." };

  let khoaDich = p.data.dich.khoa;
  const daDi = new Set([khoaDich]);
  for (;;) {
    const tiep = await db.gopDauViec.findUnique({ where: { khoaNguon: khoaDich }, select: { khoaDich: true } });
    if (!tiep || daDi.has(tiep.khoaDich)) break;
    khoaDich = tiep.khoaDich;
    daDi.add(khoaDich);
  }
  const ds = p.data.nguon.filter((n) => n.khoa !== khoaDich);
  await db.$transaction([
    ...ds.map((n) =>
      db.gopDauViec.upsert({
        where: { khoaNguon: n.khoa },
        create: { khoaNguon: n.khoa, khoaDich, tenNguon: n.ten, tenDich: p.data.dich.ten, nguoiGop: g.session.name },
        update: { khoaDich, tenDich: p.data.dich.ten, nguoiGop: g.session.name },
      })
    ),
    // Gộp nào đang trỏ vào một nguồn vừa gộp thì trỏ thẳng tới đích mới.
    db.gopDauViec.updateMany({ where: { khoaDich: { in: ds.map((n) => n.khoa) } }, data: { khoaDich, tenDich: p.data.dich.ten } }),
  ]);
  revalidatePath("/estimates/so-sanh");
  return { ok: true };
}

export async function tachDauViec(khoaNguon: string): Promise<ActionResult> {
  const g = await chanSua();
  if ("ok" in g) return g;
  await db.gopDauViec.deleteMany({ where: { khoaNguon } });
  revalidatePath("/estimates/so-sanh");
  return { ok: true };
}

const dongTamTinh = z.object({
  ten: z.string().trim().min(1).max(300),
  donVi: z.string().max(50).nullable(),
  groupCode: z.string().refine((v) => v in ESTIMATE_GROUP_MAP),
  congTacId: z.string().nullable(),
  kl: z.number().finite().nullable(),
  donGia: z.number().finite().nullable(),
  tien: z.number().finite(),
});

/**
 * Đổ bảng tạm tính thành một hạng mục mới trong dự toán thi công của dự án. Không xoá
 * hay sửa dòng nào đang có — người dùng tự dọn khi đã có số thật.
 */
export async function doTamTinhVaoDuAn(
  projectId: string,
  tenHangMuc: string,
  dong: z.input<typeof dongTamTinh>[]
): Promise<ActionResult> {
  const denied = await denyProject("estimate", "edit", projectId, "Bạn không có quyền sửa dự toán dự án này.");
  if (denied) return denied;
  const p = z.array(dongTamTinh).min(1).max(500).safeParse(dong);
  if (!p.success) return { ok: false, error: "Bảng tạm tính không hợp lệ." };
  const ten = tenHangMuc.trim().slice(0, 200) || "Tạm tính theo chỉ số chuẩn";

  const congTacCo = new Set(
    (
      await db.congTac.findMany({
        where: { id: { in: p.data.flatMap((d) => (d.congTacId ? [d.congTacId] : [])) } },
        select: { id: true },
      })
    ).map((c) => c.id)
  );
  const session = await requireSession();
  const thuTu = ((await db.estimateSection.aggregate({ where: { projectId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;

  const section = await db.$transaction(async (tx) => {
    const s = await tx.estimateSection.create({ data: { projectId, name: ten, sortOrder: thuTu } });
    await tx.estimateItem.createMany({
      data: p.data.map((d, i) => ({
        projectId,
        sectionId: s.id,
        groupCode: d.groupCode,
        name: d.ten,
        unit: d.donVi,
        designQty: d.kl != null ? Math.round(d.kl * 100) / 100 : null,
        unitPrice: d.donGia != null ? Math.round(d.donGia) : null,
        // Không có KL so được thì giữ thành tiền tạm tính làm số trọn gói.
        amount: d.kl == null || d.donGia == null ? Math.round(d.tien) : null,
        congTacId: d.congTacId && congTacCo.has(d.congTacId) ? d.congTacId : null,
        note: "Tạm tính theo trung vị các dự án tham chiếu",
        sortOrder: i + 1,
      })),
    });
    return s;
  });

  await recordAudit({
    actor: session,
    entity: "EstimateItem",
    entityId: section.id,
    action: "CREATE",
    entityLabel: `Tạm tính "${ten}" — ${p.data.length} dòng`,
    projectId,
  });
  revalidatePath(`/projects/${projectId}/estimate`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/estimates");
  return { ok: true, soDong: p.data.length };
}
