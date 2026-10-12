"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { duocXemViec } from "@/lib/traoDoi";

export type DoiTuongTraoDoi = "CLIENT_QUOTE" | "QUOTE";
export type LoaiTraoDoi = "GHI_CHU" | "XIN_DUYET" | "CAN_SUA" | "DONG_Y";

export interface TinTraoDoi {
  id: string;
  loai: LoaiTraoDoi;
  noiDung: string;
  tacGiaId: string;
  tacGiaTen: string;
  createdAt: string;
  nguoiNhan: { userId: string; ten: string; daDoc: boolean }[];
}

export interface NguoiDungChon {
  id: string;
  name: string;
  role: string;
}

type Chu = { projectId: string | null; coHoiId: string | null; nhanDe: string };

/** Việc này thuộc dự án/cơ hội nào — quyền xem trao đổi đi theo chủ đó. */
async function chuCuaViec(doiTuong: DoiTuongTraoDoi, id: string): Promise<Chu | null> {
  if (!id) return null;
  if (doiTuong === "CLIENT_QUOTE") {
    const q = await db.clientQuote.findUnique({
      where: { id },
      select: { projectId: true, coHoiId: true, title: true, quoteNo: true },
    });
    return q
      ? { projectId: q.projectId, coHoiId: q.coHoiId, nhanDe: [q.quoteNo, q.title].filter(Boolean).join(" · ") }
      : null;
  }
  const q = await db.quote.findUnique({
    where: { id },
    select: { projectId: true, coHoiId: true, title: true },
  });
  return q ? { projectId: q.projectId, coHoiId: q.coHoiId, nhanDe: q.title } : null;
}

async function guard(doiTuong: DoiTuongTraoDoi, id: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." } as const;
  const chu = await chuCuaViec(doiTuong, id);
  if (!chu || !(await duocXemViec(session, chu))) {
    return { ok: false, error: "Không tìm thấy việc này hoặc bạn không có quyền xem." } as const;
  }
  return { ok: true, session, chu } as const;
}

/** Nạp luồng trao đổi + danh sách người có thể nhắn; đồng thời đánh dấu đã đọc. */
export async function napTraoDoi(
  doiTuong: DoiTuongTraoDoi,
  id: string
): Promise<
  | { ok: true; tin: TinTraoDoi[]; nguoiDung: NguoiDungChon[]; toiLa: string }
  | { ok: false; error: string }
> {
  const g = await guard(doiTuong, id);
  if (!g.ok) return { ok: false, error: g.error };

  const [rows, users] = await Promise.all([
    db.traoDoi.findMany({
      where: { doiTuong, doiTuongId: id },
      orderBy: { createdAt: "asc" },
      include: { nguoiNhan: true },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const ten = new Map(users.map((u) => [u.id, u.name]));
  // Chỉ gợi ý người xem được việc này — nhắn người ngoài phạm vi là lộ nội dung.
  const xemDuoc = await Promise.all(users.map((u) => duocXemViec({ userId: u.id, role: u.role as never }, g.chu)));

  const daDoc = await db.traoDoiNhan.updateMany({
    where: { userId: g.session.userId, daDocLuc: null, traoDoi: { doiTuong, doiTuongId: id } },
    data: { daDocLuc: new Date() },
  });
  // Chuông trên thanh đầu trang đọc ở layout — làm mới để số chưa đọc giảm theo.
  if (daDoc.count > 0) revalidatePath("/", "layout");

  return {
    ok: true,
    toiLa: g.session.userId,
    nguoiDung: users.filter((_, i) => xemDuoc[i]),
    tin: rows.map((r) => ({
      id: r.id,
      loai: r.loai as LoaiTraoDoi,
      noiDung: r.noiDung,
      tacGiaId: r.tacGiaId,
      tacGiaTen: r.tacGiaTen,
      createdAt: r.createdAt.toISOString(),
      nguoiNhan: r.nguoiNhan.map((n) => ({
        userId: n.userId,
        ten: ten.get(n.userId) ?? "(đã xóa)",
        daDoc: n.daDocLuc != null,
      })),
    })),
  };
}

const guiSchema = z.object({
  loai: z.enum(["GHI_CHU", "XIN_DUYET", "CAN_SUA", "DONG_Y"]),
  noiDung: z.string().trim().max(4000),
  nguoiNhanIds: z.array(z.string().min(1)).max(50),
});

const CAU_MAC_DINH: Record<LoaiTraoDoi, string> = {
  GHI_CHU: "",
  XIN_DUYET: "Nhờ anh/chị xem lại giúp.",
  CAN_SUA: "Cần chỉnh sửa.",
  DONG_Y: "Đồng ý, có thể gửi đi.",
};

export async function guiTraoDoi(
  doiTuong: DoiTuongTraoDoi,
  id: string,
  input: z.input<typeof guiSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await guard(doiTuong, id);
  if (!g.ok) return { ok: false, error: g.error };
  const p = guiSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Dữ liệu không hợp lệ." };
  const { loai } = p.data;
  const noiDung = p.data.noiDung || CAU_MAC_DINH[loai];
  if (!noiDung) return { ok: false, error: "Nhập nội dung tin nhắn." };
  if (loai === "XIN_DUYET" && p.data.nguoiNhanIds.length === 0) {
    return { ok: false, error: "Chọn người cần xem lại." };
  }

  // Không chọn ai: báo cho những người đã tham gia luồng (trừ mình) — trả lời
  // "đồng ý" thì người xin duyệt phải biết, không bắt chọn lại tên họ.
  let nhan = p.data.nguoiNhanIds;
  if (nhan.length === 0) {
    const cu = await db.traoDoi.findMany({
      where: { doiTuong, doiTuongId: id },
      select: { tacGiaId: true, nguoiNhan: { select: { userId: true } } },
    });
    nhan = cu.flatMap((c) => [c.tacGiaId, ...c.nguoiNhan.map((n) => n.userId)]);
  }
  const ids = [...new Set(nhan)].filter((u) => u !== g.session.userId);
  const ung = ids.length
    ? await db.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, role: true } })
    : [];
  const duoc = await Promise.all(ung.map((u) => duocXemViec({ userId: u.id, role: u.role as never }, g.chu)));
  const hopLe = ung.filter((_, i) => duoc[i]).map((u) => u.id);
  if (loai === "XIN_DUYET" && hopLe.length === 0) {
    return { ok: false, error: "Người được chọn không có quyền xem việc này." };
  }

  if (loai === "DONG_Y" || loai === "CAN_SUA") {
    const xin = await db.traoDoi.findFirst({
      where: { doiTuong, doiTuongId: id, loai: "XIN_DUYET" },
      orderBy: { createdAt: "desc" },
      select: { tacGiaId: true },
    });
    if (xin?.tacGiaId === g.session.userId) {
      return { ok: false, error: "Không tự duyệt yêu cầu của chính mình — chờ người được nhờ xem trả lời." };
    }
  }

  await db.traoDoi.create({
    data: {
      doiTuong,
      doiTuongId: id,
      projectId: g.chu.projectId,
      coHoiId: g.chu.coHoiId,
      nhanDe: g.chu.nhanDe,
      loai,
      noiDung,
      tacGiaId: g.session.userId,
      tacGiaTen: g.session.name,
      nguoiNhan: { create: hopLe.map((userId) => ({ userId })) },
    },
  });
  revalidatePath("/trao-doi");
  return { ok: true };
}
