// Nhập bảng Tổng hợp chi phí (quyết toán thực tế) từ Excel, mỗi file = 1 dự án
// -> CostSummary + CostCategory (A–K) + CostItem.
// Phần bóc tách thuần nằm ở thcp-parse.ts (test được, không cần Next).
import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";
import { type SheetLike } from "./cells";
import { HANG_MUC, bocTachThcp, khopDuAn, soKichThuoc } from "./thcp-parse";
import type { ImportPreview, ImportResult } from "./types";

export { bocTachThcp, khopDuAn, laSoGiaThanh, loiKichThuoc, soKichThuoc } from "./thcp-parse";
export type { DongChiPhi, KetQuaThcp, NhomChiPhi, TaiChinh } from "./thcp-parse";

// ---------- Phần chạm DB ----------

const nhomSchema = z.object({
  code: z.string().regex(/^[A-K]$/),
  name: z.string().min(1),
  supplier: z.string().nullable(),
  value: z.number().nullable(),
  payment: z.number().nullable(),
  invoice: z.number().nullable(),
});

const dongSchema = z.object({
  cat: z.string().regex(/^[A-K]$/),
  name: z.string().min(1),
  qty: z.number().nullable(),
  unitPrice: z.number().nullable(),
  amount: z.number().nullable(),
  ref: z.string().nullable(),
  note: z.string().nullable(),
});

const payloadSchema = z.object({
  projectId: z.string().nullable(),
  projectName: z.string().min(1),
  location: z.string().nullable(),
  customer: z.string().nullable(),
  fileName: z.string(),
  fin: z.object({
    revenue: z.number().nullable(),
    cost: z.number().nullable(),
    profit: z.number().nullable(),
    extraVat: z.number().nullable(),
    paid: z.number().nullable(),
    collected: z.number().nullable(),
    receivable: z.number().nullable(),
    collectionNote: z.string().nullable(),
  }),
  nhom: z.array(nhomSchema),
  dong: z.array(dongSchema),
});

export type ThcpPayload = z.infer<typeof payloadSchema>;

const tien = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(n).toLocaleString("vi-VN") + " ₫";

export async function parseThcp(buffer: Buffer, fileName: string): Promise<ImportPreview> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có sheet nào.");

  const kq = bocTachThcp(ws as unknown as SheetLike, fileName);
  const canhBao = [...kq.canhBao];

  const projects = await db.project.findMany({
    select: { id: true, code: true, name: true, location: true },
  });
  const kh = khopDuAn(kq, projects, fileName);
  const khop = kh.duAn;
  canhBao.unshift(...kh.canhBao);

  if (khop) {
    const cu = await db.costSummary.findUnique({
      where: { projectId: khop.id },
      select: { id: true, revenue: true, cost: true },
    });
    if (cu) {
      canhBao.unshift(
        `Dự án ${khop.code} đã có bảng quyết toán (doanh thu ${tien(cu.revenue)}, chi phí ${tien(
          cu.cost
        )}) — xác nhận sẽ THAY THẾ toàn bộ.`
      );
    }
    if (kq.fin.revenue != null) {
      canhBao.push(
        `Giá bán của dự án ${khop.code} sẽ được đặt lại bằng doanh thu trong file: ${tien(kq.fin.revenue)}.`
      );
    }
  }

  // Nhóm nào có dòng chi tiết nhưng không có trong bảng tổng hợp (và ngược lại) vẫn
  // được tạo — hiện ra ở đây để người dùng biết trước.
  const maNhom = Array.from(
    new Set([...kq.nhom.map((c) => c.code), ...kq.dong.map((i) => i.cat)])
  ).sort();

  return {
    kind: "thcp",
    fileName,
    duAn: {
      projectId: khop?.id ?? null,
      code: khop?.code ?? null,
      name: khop?.name ?? kq.dims,
      cachKhop: kh.cachKhop,
      taoMoi: !khop,
    },
    thongKe: [
      { nhan: "Dạng file", giaTri: kq.dang === "so-gia-thanh" ? "Sổ giá thành" : "Quyết toán" },
      { nhan: "Doanh thu", giaTri: tien(kq.fin.revenue) },
      { nhan: "Chi phí", giaTri: tien(kq.fin.cost) },
      { nhan: "LNTT", giaTri: tien(kq.fin.profit) },
      { nhan: "Đã chi (cả VAT)", giaTri: tien(kq.fin.paid) },
      { nhan: "Đã thu (cả VAT)", giaTri: tien(kq.fin.collected) },
      { nhan: "Còn phải thu", giaTri: kq.fin.collectionNote ?? tien(kq.fin.receivable) },
      { nhan: "Nhóm / dòng chi phí", giaTri: `${maNhom.length} nhóm · ${kq.dong.length} dòng` },
    ],
    canhBao,
    tieuDeCot: ["Nhóm", "Hạng mục", "Khối lượng", "Đơn giá", "Thành tiền", "Chứng từ"],
    dongMau: kq.dong.slice(0, 15).map((i) => ({
      cot: [
        `${i.cat} — ${HANG_MUC[i.cat]?.label ?? ""}`.trim(),
        i.name,
        i.qty?.toLocaleString("vi-VN") ?? "—",
        i.unitPrice?.toLocaleString("vi-VN") ?? "—",
        i.amount?.toLocaleString("vi-VN") ?? "—",
        i.ref ?? "—",
      ],
    })),
    tongSoDong: kq.dong.length,
    payload: {
      projectId: khop?.id ?? null,
      projectName: khop?.name ?? kq.dims,
      location: kq.location || null,
      customer: kq.customer || null,
      fileName,
      fin: kq.fin,
      nhom: kq.nhom,
      dong: kq.dong,
    } satisfies ThcpPayload,
  };
}

export async function applyThcp(raw: unknown, actor: SessionUser): Promise<ImportResult> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, thongDiep: `Dữ liệu không hợp lệ: ${parsed.error.issues[0].message}` };
  }
  const p = parsed.data;

  if (!p.projectId && !p.projectName.trim()) {
    return { ok: false, thongDiep: "Không xác định được tên dự án từ file — không thể tạo mới." };
  }

  let projectId = p.projectId;
  let code: string;
  let laMoi = false;

  if (projectId) {
    const ton = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
    if (!ton) return { ok: false, thongDiep: "Dự án đích không còn tồn tại." };
    code = ton.code;
  } else {
    // Khách hàng: dùng lại nếu đã có, không tạo trùng tên.
    let customerId: string | null = null;
    if (p.customer) {
      const cu =
        (await db.customer.findFirst({ where: { name: p.customer }, select: { id: true } })) ??
        (await db.customer.create({ data: { name: p.customer }, select: { id: true } }));
      customerId = cu.id;
    }
    const { k, l } = soKichThuoc(p.projectName);
    code = await sinhMaMoi();
    const created = await db.project.create({
      data: {
        code,
        name: p.projectName,
        location: p.location,
        customerId,
        kK: k,
        kL: l,
        // File quyết toán chỉ tồn tại khi công trình đã xong.
        status: "HOAN_THANH",
      },
      select: { id: true },
    });
    projectId = created.id;
    laMoi = true;
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

  const maNhom = Array.from(
    new Set([...p.nhom.map((c) => c.code), ...p.dong.map((i) => i.cat)])
  ).sort();

  // Xóa quyết toán cũ và ghi cái mới phải cùng thành công hoặc cùng hủy — nếu không,
  // lỗi giữa chừng để lại dự án không còn số liệu quyết toán nào.
  await db.$transaction(async (tx) => {
    await tx.costSummary.deleteMany({ where: { projectId: projectId! } });

    const summary = await tx.costSummary.create({
      data: {
        projectId: projectId!,
        revenue: p.fin.revenue,
        cost: p.fin.cost,
        profit: p.fin.profit,
        extraVat: p.fin.extraVat,
        paidWithVat: p.fin.paid,
        collectedWithVat: p.fin.collected,
        receivable: p.fin.receivable,
        collectionNote: p.fin.collectionNote,
        // Nhập qua web thì không có đường dẫn trên đĩa, chỉ có tên file người dùng tải lên.
        filePath: p.fileName,
      },
      select: { id: true },
    });

    for (const [i, ma] of maNhom.entries()) {
      const cs = p.nhom.find((c) => c.code === ma);
      const cat = await tx.costCategory.create({
        data: {
          summaryId: summary.id,
          code: ma,
          groupCode: HANG_MUC[ma]?.group ?? "KHAC",
          name: cs?.name || HANG_MUC[ma]?.label || ma,
          supplier: cs?.supplier ?? null,
          value: cs?.value ?? null,
          payment: cs?.payment ?? null,
          invoice: cs?.invoice ?? null,
          sortOrder: i,
        },
        select: { id: true },
      });
      const items = p.dong.filter((d) => d.cat === ma);
      if (items.length) {
        await tx.costItem.createMany({
          data: items.map((it, j) => ({
            categoryId: cat.id,
            name: it.name,
            qty: it.qty,
            unitPrice: it.unitPrice,
            amount: it.amount,
            ref: it.ref,
            note: it.note,
            sortOrder: j,
          })),
        });
      }
    }

    // Doanh thu quyết toán là con số thật đã chốt, nên ghi đè giá bán để dashboard
    // và các báo cáo lợi nhuận dùng đúng nó.
    if (p.fin.revenue != null) {
      await tx.project.update({ where: { id: projectId! }, data: { salePrice: p.fin.revenue } });
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
      quyetToan: {
        truoc: "(thay toàn bộ)",
        sau: `${maNhom.length} nhóm, ${p.dong.length} dòng nhập từ ${p.fileName}`,
      },
      ...(p.fin.revenue != null ? { salePrice: { truoc: null, sau: p.fin.revenue } } : {}),
      ...(p.fin.cost != null ? { chiPhi: { truoc: null, sau: p.fin.cost } } : {}),
    },
  });

  return {
    ok: true,
    projectId,
    thongDiep: `Đã nhập quyết toán (${maNhom.length} nhóm, ${p.dong.length} dòng) vào dự án ${code}${
      laMoi ? " (dự án mới)" : ""
    }.`,
  };
}

/** Sinh mã N001, N002... theo đúng dãy mà script CLI cũ dùng cho dự án quyết toán. */
async function sinhMaMoi(): Promise<string> {
  const codes = (await db.project.findMany({ select: { code: true } })).map((p) => p.code);
  const daCo = new Set(codes);
  let max = 0;
  for (const c of codes) {
    const m = c.match(/^N(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  for (let i = max + 1; i < max + 1000; i++) {
    const c = "N" + String(i).padStart(3, "0");
    if (!daCo.has(c)) return c;
  }
  throw new Error("Không sinh được mã dự án mới.");
}
