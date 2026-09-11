"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { CUSTOMER_CONTACT_KIND_MAP } from "@/lib/constants";
import { duocDungKhachHang } from "@/lib/crmScope";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(1, "Tên CĐT không được để trống"),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function fields(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    contactPerson: String(form.get("contactPerson") ?? ""),
    phone: String(form.get("phone") ?? ""),
    address: String(form.get("address") ?? ""),
    note: String(form.get("note") ?? ""),
  };
}

export async function saveCustomer(
  id: string | null,
  form: FormData
): Promise<ActionResult> {
  try {
    await requirePermission("customer", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền chỉnh sửa CĐT." };
  }

  const parsed = schema.safeParse(fields(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = {
    name: parsed.data.name,
    contactPerson: parsed.data.contactPerson || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    note: parsed.data.note || null,
  };

  if (id) await db.customer.update({ where: { id }, data });
  else await db.customer.create({ data });

  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  try {
    await requirePermission("customer", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa CĐT." };
  }
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  return { ok: true };
}

// ---------- Nhật ký trao đổi (CRM) ----------

const contactSchema = z.object({
  kind: z.string().trim().min(1),
  contactDate: z.string().trim().optional(),
  content: z.string().trim().min(1, "Nội dung trao đổi không được để trống"),
  nextFollowUpDate: z.string().trim().optional(),
  clientQuoteId: z.string().trim().optional(),
});

function contactFields(form: FormData) {
  return {
    kind: String(form.get("kind") ?? "KHAC"),
    contactDate: String(form.get("contactDate") ?? ""),
    content: String(form.get("content") ?? ""),
    nextFollowUpDate: String(form.get("nextFollowUpDate") ?? ""),
    clientQuoteId: String(form.get("clientQuoteId") ?? ""),
  };
}

/**
 * Làm mới cả trang CĐT lẫn trang báo giá của dự án liên quan.
 *
 * Nhật ký hiện ở hai nơi; chỉ revalidate một nơi thì nơi kia hiện dữ liệu cũ cho tới
 * lần tải lại tiếp theo — người dùng tưởng mình ghi hụt.
 */
async function contactPaths(clientQuoteId: string | null) {
  revalidatePath("/customers");
  revalidatePath("/khach-hang");
  if (!clientQuoteId) return;
  const q = await db.clientQuote.findUnique({
    where: { id: clientQuoteId },
    select: { projectId: true },
  });
  if (q) revalidatePath(`/projects/${q.projectId}/client-quote`);
}

/**
 * Ghi chép treo ở đâu: khách đang chào giá (CRM) hay chủ đầu tư đã ký.
 *
 * Đúng một trong hai, không bao giờ cả hai — cùng một cuộc gọi mà nằm hai chỗ thì
 * đọc lại sẽ tưởng gọi hai lần.
 */
export type ChuGhiChep = { loai: "KHACH" | "CDT"; id: string };

export async function saveContact(
  chu: ChuGhiChep,
  noteId: string | null,
  form: FormData
): Promise<ActionResult> {
  let actor;
  try {
    actor = await requirePermission("customer", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền ghi nhật ký trao đổi." };
  }

  // Khách chào giá còn phải qua cửa người phụ trách: chỉ ADMIN, người phụ trách, hoặc
  // khách chưa phân công ai mới ghi được.
  if (chu.loai === "KHACH") {
    const kh = await db.khachHang.findUnique({
      where: { id: chu.id },
      select: { ownerId: true },
    });
    if (!kh) return { ok: false, error: "Không tìm thấy khách hàng." };
    if (!duocDungKhachHang(actor, kh.ownerId)) {
      return { ok: false, error: "Khách này do người khác phụ trách." };
    }
  }

  const parsed = contactSchema.safeParse(contactFields(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!CUSTOMER_CONTACT_KIND_MAP[d.kind]) {
    return { ok: false, error: "Hình thức liên hệ không hợp lệ." };
  }

  // clientQuoteId đến từ trình duyệt: phải có thật VÀ phải thuộc đúng CĐT này,
  // nếu không thì một cuộc gọi lại gắn được vào báo giá của khách khác.
  // Báo giá hiện vẫn gắn CĐT; tới Phase 8.4 mới gắn được vào khách chào giá.
  const clientQuoteId: string | null = d.clientQuoteId || null;
  if (clientQuoteId) {
    if (chu.loai !== "CDT") {
      return { ok: false, error: "Chưa gắn được ghi chép vào báo giá của khách chào giá." };
    }
    const q = await db.clientQuote.findUnique({
      where: { id: clientQuoteId },
      select: { customerId: true },
    });
    if (!q) return { ok: false, error: "Không tìm thấy báo giá." };
    if (q.customerId !== chu.id) {
      return { ok: false, error: "Báo giá không thuộc chủ đầu tư này." };
    }
  }

  const data = {
    kind: d.kind,
    contactDate: d.contactDate ? new Date(d.contactDate) : new Date(),
    content: d.content,
    nextFollowUpDate: d.nextFollowUpDate ? new Date(d.nextFollowUpDate) : null,
  };

  if (noteId) {
    const cu = await db.customerNote.findUnique({
      where: { id: noteId },
      select: { customerId: true, khachHangId: true, clientQuoteId: true },
    });
    if (!cu) return { ok: false, error: "Không tìm thấy ghi chép." };
    const dungChu =
      chu.loai === "KHACH" ? cu.khachHangId === chu.id : cu.customerId === chu.id;
    if (!dungChu) return { ok: false, error: "Ghi chép không thuộc bên này." };

    // Sửa nội dung thì được, nhưng KHÔNG đổi tác giả: vết "ai nói chuyện với ai"
    // là thứ duy nhất làm nhật ký này đáng tin.
    await db.customerNote.update({ where: { id: noteId }, data });
    await contactPaths(cu.clientQuoteId);
  } else {
    await db.customerNote.create({
      data: {
        ...data,
        khachHangId: chu.loai === "KHACH" ? chu.id : null,
        customerId: chu.loai === "CDT" ? chu.id : null,
        clientQuoteId,
        authorId: actor.userId,
        authorName: actor.name,
      },
    });
    await contactPaths(clientQuoteId);
  }

  return { ok: true };
}

export async function deleteContact(noteId: string): Promise<ActionResult> {
  let actor;
  try {
    actor = await requirePermission("customer", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền xóa nhật ký trao đổi." };
  }
  const cu = await db.customerNote.findUnique({
    where: { id: noteId },
    select: { clientQuoteId: true, khachHang: { select: { ownerId: true } } },
  });
  if (!cu) return { ok: false, error: "Không tìm thấy ghi chép." };
  // Ghi chép của khách chào giá: chỉ người phụ trách (hoặc quản trị) được xóa.
  if (cu.khachHang && !duocDungKhachHang(actor, cu.khachHang.ownerId)) {
    return { ok: false, error: "Khách này do người khác phụ trách." };
  }
  await db.customerNote.delete({ where: { id: noteId } });
  await contactPaths(cu.clientQuoteId);
  return { ok: true };
}
