"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { CO_HOI_TRANG_THAI_MAP } from "@/lib/constants";
import { duocDungKhachHang } from "@/lib/crmScope";
import { can, type Role } from "@/lib/rbac";
import { computeClientQuoteTotals } from "@/lib/clientQuote";
import { duLieuDuAnTuCoHoi, kiemDieuKienChuyen } from "@/lib/coHoiChuyenDuAn";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const CH_AUDIT_FIELDS = [
  "tenCongTrinh",
  "diaDiem",
  "buildingType",
  "area",
  "kK",
  "kL",
  "kH",
  "trangThai",
  "lyDoMat",
  "note",
] as const;

const num = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Số không hợp lệ")
  .nullable();

const schema = z.object({
  tenCongTrinh: z.string().trim().min(1, "Tên công trình không được để trống"),
  diaDiem: z.string().trim().optional(),
  buildingType: z.string().trim().optional(),
  area: num,
  kK: num,
  kL: num,
  kH: num,
  trangThai: z.string().trim().optional(),
  lyDoMat: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const s = (form: FormData, key: string) => String(form.get(key) ?? "");

function fields(form: FormData) {
  return {
    tenCongTrinh: s(form, "tenCongTrinh"),
    diaDiem: s(form, "diaDiem"),
    buildingType: s(form, "buildingType"),
    area: s(form, "area"),
    kK: s(form, "kK"),
    kL: s(form, "kL"),
    kH: s(form, "kH"),
    trangThai: s(form, "trangThai"),
    lyDoMat: s(form, "lyDoMat"),
    note: s(form, "note"),
  };
}

const paths = () => revalidatePath("/khach-hang");

/**
 * Chặn theo quyền rồi theo người phụ trách KHÁCH — cơ hội không có chủ riêng, nó thuộc
 * về khách. `khachHangId` và `coHoiId` đều đến từ trình duyệt nên phải truy cả hai.
 */
async function guard(khachHangId: string | null, coHoiId: string | null) {
  let actor;
  try {
    actor = await requirePermission("customer", "edit");
  } catch {
    return { loi: { ok: false as const, error: "Bạn không có quyền quản lý cơ hội." } };
  }

  let chuId = khachHangId;
  if (coHoiId) {
    const ch = await db.coHoi.findUnique({
      where: { id: coHoiId },
      select: { khachHangId: true },
    });
    if (!ch) return { loi: { ok: false as const, error: "Không tìm thấy cơ hội." } };
    // Cơ hội đã có chủ thật; id khách gửi lên chỉ là gợi ý, không tin được.
    chuId = ch.khachHangId;
  }
  if (!chuId) return { loi: { ok: false as const, error: "Thiếu khách hàng." } };

  const kh = await db.khachHang.findUnique({
    where: { id: chuId },
    select: { ownerId: true },
  });
  if (!kh) return { loi: { ok: false as const, error: "Không tìm thấy khách hàng." } };
  if (!duocDungKhachHang(actor, kh.ownerId)) {
    return { loi: { ok: false as const, error: "Khách này do người khác phụ trách." } };
  }
  return { actor, khachHangId: chuId };
}

export async function saveCoHoi(
  khachHangId: string,
  coHoiId: string | null,
  form: FormData
): Promise<CreateResult> {
  const g = await guard(khachHangId, coHoiId);
  if (g.loi) return g.loi;
  const chuId = g.khachHangId!;

  const parsed = schema.safeParse(fields(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const truoc = coHoiId
    ? await db.coHoi.findUnique({
        where: { id: coHoiId },
        select: { ...selectAudit, projectId: true },
      })
    : null;

  // "Đã ký hợp đồng" chỉ đặt được qua đường chuyển sang dự án (Phase 8.5). Cho chọn
  // tay thì sẽ có cơ hội mang tiếng đã ký mà chẳng có dự án nào.
  let trangThai = d.trangThai || truoc?.trangThai || "MOI";
  if (!CO_HOI_TRANG_THAI_MAP[trangThai]) {
    return { ok: false, error: "Trạng thái cơ hội không hợp lệ." };
  }
  if (trangThai === "KY_HD" && !truoc?.projectId) {
    return {
      ok: false,
      error: 'Chuyển sang "Đã ký hợp đồng" bằng nút tạo dự án, không chọn tay.',
    };
  }
  if (truoc?.projectId) trangThai = "KY_HD"; // đã có dự án thì không lùi trạng thái được

  const data = {
    tenCongTrinh: d.tenCongTrinh,
    diaDiem: d.diaDiem || null,
    buildingType: d.buildingType || null,
    area: d.area,
    kK: d.kK,
    kL: d.kL,
    kH: d.kH,
    trangThai,
    // Lý do chỉ có nghĩa khi mất khách; giữ lại lúc khác là để lẫn dữ liệu cũ.
    lyDoMat: trangThai === "MAT" ? d.lyDoMat || null : null,
    note: d.note || null,
  };

  const row = coHoiId
    ? await db.coHoi.update({ where: { id: coHoiId }, data })
    : await db.coHoi.create({ data: { ...data, khachHangId: chuId } });

  await recordAudit({
    actor: await requireSession(),
    entity: "CoHoi",
    entityId: row.id,
    entityLabel: d.tenCongTrinh,
    projectId: truoc?.projectId ?? null,
    action: coHoiId ? "UPDATE" : "CREATE",
    changes: diffFields(truoc, data, CH_AUDIT_FIELDS),
  });

  paths();
  return { ok: true, id: row.id };
}

const selectAudit = Object.fromEntries(CH_AUDIT_FIELDS.map((f) => [f, true])) as Record<
  (typeof CH_AUDIT_FIELDS)[number],
  true
>;

export async function deleteCoHoi(coHoiId: string): Promise<ActionResult> {
  const g = await guard(null, coHoiId);
  if (g.loi) return g.loi;

  const ch = await db.coHoi.findUnique({
    where: { id: coHoiId },
    select: { tenCongTrinh: true, projectId: true },
  });
  if (!ch) return { ok: false, error: "Không tìm thấy cơ hội." };
  if (ch.projectId) {
    return {
      ok: false,
      error: "Cơ hội này đã thành dự án — không xóa được. Muốn bỏ thì xóa dự án.",
    };
  }

  await db.coHoi.delete({ where: { id: coHoiId } });

  await recordAudit({
    actor: await requireSession(),
    entity: "CoHoi",
    entityId: coHoiId,
    entityLabel: ch.tenCongTrinh,
    projectId: null,
    action: "DELETE",
    changes: null,
  });

  paths();
  return { ok: true };
}

// ---------- Đã ký hợp đồng: chuyển cơ hội sang dự án ----------

const chuyenSchema = z.object({
  code: z.string().trim().min(1, "Mã dự án không được để trống"),
  projectName: z.string().trim().optional(),
  cachChuDauTu: z.enum(["MOI", "CO_SAN"]),
  customerId: z.string().trim().optional(),
  cdtName: z.string().trim().optional(),
  cdtContactPerson: z.string().trim().optional(),
  cdtPhone: z.string().trim().optional(),
  cdtAddress: z.string().trim().optional(),
});

/**
 * Khách đồng ý và đã ký — dựng chủ đầu tư, dự án, rồi dời toàn bộ giấy tờ sang.
 *
 * Một chiều, không có nút hoàn tác, nên mọi thứ nằm trong MỘT giao dịch: đứt giữa chừng
 * mà để lại dự án không có báo giá, hoặc cơ hội mang tiếng đã ký mà chẳng có dự án nào,
 * đều là trạng thái không ai dọn được bằng giao diện.
 */
export async function chuyenSangDuAn(
  coHoiId: string,
  form: FormData
): Promise<CreateResult> {
  const g = await guard(null, coHoiId);
  if (g.loi) return g.loi;
  const actor = g.actor!;

  // Tạo dự án là việc của bên quản lý dự án, không phải của CRM — hỏi riêng.
  if (!can(actor.role as Role, "project", "edit")) {
    return { ok: false, error: "Bạn không có quyền tạo dự án." };
  }

  const parsed = chuyenSchema.safeParse({
    code: s(form, "code"),
    projectName: s(form, "projectName"),
    cachChuDauTu: s(form, "cachChuDauTu") || "MOI",
    customerId: s(form, "customerId"),
    cdtName: s(form, "cdtName"),
    cdtContactPerson: s(form, "cdtContactPerson"),
    cdtPhone: s(form, "cdtPhone"),
    cdtAddress: s(form, "cdtAddress"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const coHoi = await db.coHoi.findUnique({
    where: { id: coHoiId },
    include: {
      khachHang: { select: { id: true, tenCty: true, ownerId: true } },
      clientQuotes: {
        select: {
          id: true,
          status: true,
          vatPercent: true,
          lines: { select: { qty: true, unitPrice: true, amount: true } },
        },
      },
    },
  });
  if (!coHoi) return { ok: false, error: "Không tìm thấy công trình chào giá." };

  const dieuKien = kiemDieuKienChuyen(coHoi, coHoi.clientQuotes);
  if (!dieuKien.duoc) return { ok: false, error: dieuKien.lyDo };

  // Giá bán của dự án = tổng sau thuế của bản đã chốt — con số hai bên vừa bắt tay.
  const daChot = coHoi.clientQuotes.filter((q) => q.status === "CHOT");
  const giaBan = daChot.length
    ? Math.max(...daChot.map((q) => computeClientQuoteTotals(q.lines, q.vatPercent).withVat))
    : null;

  // Chủ đầu tư áp vào bản có sẵn thì đọc trước cho biết tên; dựng mới thì để trong
  // giao dịch bên dưới — tạo sẵn ở đây mà mã dự án trùng là bỏ lại một chủ đầu tư rỗng
  // không ai biết từ đâu ra.
  let cdtCoSan: { id: string; name: string } | null = null;
  if (d.cachChuDauTu === "CO_SAN") {
    if (!d.customerId) return { ok: false, error: "Hãy chọn chủ đầu tư có sẵn." };
    cdtCoSan = await db.customer.findUnique({
      where: { id: d.customerId },
      select: { id: true, name: true },
    });
    if (!cdtCoSan) return { ok: false, error: "Chủ đầu tư đã chọn không còn tồn tại." };
  }
  const tenCdt = cdtCoSan?.name || d.cdtName || coHoi.khachHang.tenCty;
  if (!tenCdt) return { ok: false, error: "Tên chủ đầu tư không được để trống." };

  // Hỏi mã trùng TRƯỚC khi mở giao dịch. Chỉ số duy nhất vẫn là chốt chặn cuối cùng
  // (hai người bấm cùng lúc thì một người thua), nhưng để nó bắn lỗi giữa giao dịch là
  // đường thường gặp nhất — mà trong đó thì thông báo trả về chỉ đoán được từ chuỗi lỗi.
  const trungMa = await db.project.findUnique({
    where: { code: d.code },
    select: { id: true },
  });
  if (trungMa) return { ok: false, error: `Mã dự án "${d.code}" đã tồn tại.` };

  // Ai phải có mặt trong thành viên dự án: người phụ trách khách, và người đang bấm
  // nút. Quên bước này thì chính người vừa chốt hợp đồng mất quyền xem báo giá của mình
  // ngay khi chuyển xong.
  const thanhVien = new Set<string>();
  if (coHoi.khachHang.ownerId) thanhVien.add(coHoi.khachHang.ownerId);
  if (actor.role !== "ADMIN") thanhVien.add(actor.userId);

  let projectId: string;
  try {
    projectId = await db.$transaction(async (tx) => {
      const customerId =
        cdtCoSan?.id ??
        (
          await tx.customer.create({
            data: {
              name: tenCdt,
              contactPerson: d.cdtContactPerson || null,
              phone: d.cdtPhone || null,
              address: d.cdtAddress || null,
              note: `Chuyển từ khách "${coHoi.khachHang.tenCty}" trong CRM.`,
            },
          })
        ).id;

      const duLieu = duLieuDuAnTuCoHoi(coHoi, d.code, customerId, giaBan, d.projectName);
      const duAn = await tx.project.create({ data: duLieu });

      // Dời giấy tờ: đổi chủ, không sao chép. Bản đã gửi khách phải là đúng bản đó.
      await tx.quote.updateMany({
        where: { coHoiId },
        data: { projectId: duAn.id, coHoiId: null },
      });
      await tx.clientQuote.updateMany({
        where: { coHoiId },
        data: { projectId: duAn.id, coHoiId: null },
      });

      await tx.coHoi.update({
        where: { id: coHoiId },
        data: { projectId: duAn.id, trangThai: "KY_HD", lyDoMat: null },
      });
      await tx.khachHang.update({
        where: { id: coHoi.khachHang.id },
        data: { customerId },
      });

      if (thanhVien.size > 0) {
        await tx.projectMember.createMany({
          data: [...thanhVien].map((userId) => ({ projectId: duAn.id, userId })),
          skipDuplicates: true,
        });
      }
      return duAn.id;
    });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Unique") || msg.includes("constraint")) {
      return { ok: false, error: `Mã dự án "${d.code}" đã tồn tại.` };
    }
    return { ok: false, error: "Lỗi khi tạo dự án. Chưa có gì được ghi." };
  }

  const nguoi = await requireSession();
  await recordAudit({
    actor: nguoi,
    entity: "Project",
    entityId: projectId,
    entityLabel: d.code,
    projectId,
    action: "CREATE",
    changes: null,
  });
  await recordAudit({
    actor: nguoi,
    entity: "CoHoi",
    entityId: coHoiId,
    entityLabel: coHoi.tenCongTrinh,
    projectId,
    action: "UPDATE",
    changes: {
      trangThai: { truoc: coHoi.trangThai, sau: "KY_HD" },
      projectId: { truoc: null, sau: d.code },
    },
  });
  await recordAudit({
    actor: nguoi,
    entity: "KhachHang",
    entityId: coHoi.khachHang.id,
    entityLabel: coHoi.khachHang.tenCty,
    projectId,
    action: "UPDATE",
    changes: { customerId: { truoc: null, sau: tenCdt } },
  });

  paths();
  revalidatePath("/projects");
  revalidatePath("/customers");
  return { ok: true, id: projectId };
}
