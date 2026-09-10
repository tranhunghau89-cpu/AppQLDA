// Nhập dự toán chi tiết từ file Excel (sheet "TongHop"), mỗi file = 1 dự án.
// Phần bóc tách thuần nằm ở estimate-parse.ts (test được, không cần Next).
import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";
import { dims, norm } from "./cells";
import { bocTachDuToan, type SheetLike } from "./estimate-parse";
import type { ImportPreview, ImportResult } from "./types";

export { bocTachDuToan, phanNhom } from "./estimate-parse";
export type { DongDuToan, KetQuaBocTach, SheetLike } from "./estimate-parse";

const SHEET = "TongHop";

// ---------- Phần chạm DB ----------

const payloadSchema = z.object({
  projectId: z.string().nullable(),
  projectName: z.string().min(1),
  area: z.number().nullable(),
  sale: z.number().nullable(),
  dong: z.array(
    z.object({
      groupCode: z.string(),
      name: z.string().min(1),
      unit: z.string().nullable(),
      designQty: z.number().nullable(),
      unitPrice: z.number().nullable(),
      amount: z.number(),
      note: z.string().nullable(),
      sortOrder: z.number().int(),
    })
  ),
});

export type EstimatePayload = z.infer<typeof payloadSchema>;

export async function parseEstimate(buffer: Buffer, fileName: string): Promise<ImportPreview> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`File không có sheet "${SHEET}".`);

  const base = fileName.replace(/\.xlsx?$/i, "");
  const kq = bocTachDuToan(ws as unknown as SheetLike);

  // Khớp dự án: tên đầy đủ trước, rồi tới phần K..L..
  const projects = await db.project.findMany({ select: { id: true, code: true, name: true } });
  const byNorm = new Map(projects.map((p) => [norm(p.name), p]));

  let khop = byNorm.get(norm(base)) ?? null;
  let cachKhop = "khớp tên đầy đủ";
  if (!khop) {
    const d = dims(base);
    const cand = d ? byNorm.get(norm(d)) : undefined;
    if (cand) {
      khop = cand;
      cachKhop = `khớp theo kích thước ${d}`;
    }
  }

  const canhBao = [...kq.canhBao];
  if (khop) {
    const cu = await db.estimateItem.count({ where: { projectId: khop.id } });
    if (cu > 0) {
      canhBao.unshift(
        `Dự án ${khop.code} đang có ${cu} dòng dự toán — xác nhận sẽ THAY THẾ toàn bộ bằng ${kq.dong.length} dòng mới.`
      );
    }
  }

  return {
    kind: "estimate",
    fileName,
    duAn: {
      projectId: khop?.id ?? null,
      code: khop?.code ?? null,
      name: khop?.name ?? base,
      cachKhop: khop ? cachKhop : "không khớp dự án nào — sẽ TẠO DỰ ÁN MỚI",
      taoMoi: !khop,
    },
    thongKe: [
      { nhan: "Số dòng vật tư", giaTri: String(kq.dong.length) },
      { nhan: "Tổng chi phí", giaTri: kq.total.toLocaleString("vi-VN") + " ₫" },
      { nhan: "Diện tích", giaTri: kq.area ? kq.area.toLocaleString("vi-VN") + " m²" : "—" },
      { nhan: "Giá bán (ô J1)", giaTri: kq.sale ? kq.sale.toLocaleString("vi-VN") + " ₫" : "—" },
    ],
    canhBao,
    tieuDeCot: ["Nhóm", "Tên vật tư", "ĐV", "Khối lượng", "Đơn giá", "Thành tiền"],
    dongMau: kq.dong.slice(0, 15).map((l) => ({
      cot: [
        l.groupCode,
        l.name,
        l.unit ?? "—",
        l.designQty?.toLocaleString("vi-VN") ?? "—",
        l.unitPrice?.toLocaleString("vi-VN") ?? "—",
        l.amount.toLocaleString("vi-VN"),
      ],
    })),
    tongSoDong: kq.dong.length,
    payload: {
      projectId: khop?.id ?? null,
      projectName: khop?.name ?? base,
      area: kq.area,
      sale: kq.sale,
      dong: kq.dong,
    } satisfies EstimatePayload,
  };
}

export async function applyEstimate(raw: unknown, actor: SessionUser): Promise<ImportResult> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, thongDiep: `Dữ liệu không hợp lệ: ${parsed.error.issues[0].message}` };
  }
  const p = parsed.data;

  let projectId = p.projectId;
  let code: string;

  if (projectId) {
    const ton = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
    if (!ton) return { ok: false, thongDiep: "Dự án đích không còn tồn tại." };
    code = ton.code;
  } else {
    code = await sinhMaMoi();
    const created = await db.project.create({ data: { code, name: p.projectName } });
    projectId = created.id;
    await recordAudit({
      actor,
      entity: "Project",
      entityId: projectId,
      entityLabel: code,
      projectId,
      action: "CREATE",
      changes: { name: { truoc: null, sau: p.projectName } },
    });
  }

  const capNhat: { area?: number; salePrice?: number } = {};
  if (p.area != null) capNhat.area = p.area;
  if (p.sale != null) capNhat.salePrice = p.sale;

  // Một giao dịch: xóa dòng cũ và ghi dòng mới phải cùng thành công hoặc cùng hủy —
  // nếu không, lỗi giữa chừng sẽ xóa trắng dự toán của dự án.
  await db.$transaction(async (tx) => {
    if (Object.keys(capNhat).length) {
      await tx.project.update({ where: { id: projectId! }, data: capNhat });
    }
    await tx.estimateItem.deleteMany({ where: { projectId: projectId! } });
    if (p.dong.length) {
      await tx.estimateItem.createMany({
        data: p.dong.map((l) => ({ projectId: projectId!, ...l })),
      });
    }
  });

  await recordAudit({
    actor,
    entity: "Project",
    entityId: projectId,
    entityLabel: code,
    projectId,
    action: "UPDATE",
    changes: {
      duToan: { truoc: "(thay toàn bộ)", sau: `${p.dong.length} dòng nhập từ Excel` },
      ...(capNhat.area != null ? { area: { truoc: null, sau: capNhat.area } } : {}),
      ...(capNhat.salePrice != null ? { salePrice: { truoc: null, sau: capNhat.salePrice } } : {}),
    },
  });

  return {
    ok: true,
    projectId,
    thongDiep: `Đã nhập ${p.dong.length} dòng dự toán vào dự án ${code}.`,
  };
}

/** Sinh mã DT01, DT02... tránh trùng mã đã có. */
async function sinhMaMoi(): Promise<string> {
  const daCo = new Set((await db.project.findMany({ select: { code: true } })).map((p) => p.code));
  for (let i = 1; i < 1000; i++) {
    const c = `DT${String(i).padStart(2, "0")}`;
    if (!daCo.has(c)) return c;
  }
  throw new Error("Không sinh được mã dự án mới.");
}
