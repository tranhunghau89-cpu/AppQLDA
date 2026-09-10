// Nhập Đơn đặt hàng vật tư từ Excel. Mỗi file = 1 đơn (nhiều sheet) ->
// PurchaseOrder + PurchaseOrderItem + PoItemImage (ảnh biên dạng nhúng trong file).
// Phần bóc tách thuần nằm ở order-parse.ts (test được, không cần Next).
import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { norm } from "@/lib/text";
import type { SessionUser } from "@/lib/session";
import {
  bocTachDonHang,
  bocTachSheet,
  ganAnhVaoDong,
  tenSheetSach,
  type DongDonHang,
  type KetQuaDonHang,
  type OrderSheetLike,
} from "./order-parse";
import type { ImportPreview, ImportResult } from "./types";

export {
  bocTachDonHang,
  bocTachSheet,
  danhMucTuTen,
  ganAnhVaoDong,
  kichThuocTuTen,
  ngayTuTen,
  tenSheetSach,
} from "./order-parse";
export type { DongDonHang, KetQuaDonHang, OrderSheetLike } from "./order-parse";

/** Nhà cung cấp của dự án được tra theo hạng mục tương ứng với loại đơn. */
const COMPONENT_THEO_LOAI: Record<string, string[]> = {
  KCT: ["KCT"],
  XA_GO: ["XA_GO"],
  TON: ["TON"],
  VTP: ["BLLK", "BL_NEO"],
};

const NHAN_LOAI: Record<string, string> = {
  KCT: "Kết cấu thép",
  XA_GO: "Xà gồ",
  TON: "Tôn - Diềm",
  VTP: "Vật tư phụ",
};

/**
 * Payload của bộ nhập đơn hàng CHỈ mang quyết định, không mang dữ liệu.
 *
 * Khác hai bộ nhập trước: file đơn hàng có ảnh biên dạng nhúng (tới ~900KB một đơn),
 * gửi vòng qua client rồi gửi ngược lên là vượt giới hạn body của server action và
 * tốn băng thông vô ích. Nên bước xác nhận GỬI LẠI FILE, server bóc lại từ đầu.
 * `fileName` + `fileSize` ở đây là để đối chiếu, chặn trường hợp người dùng đổi file
 * giữa bước xem trước và bước xác nhận.
 */
const payloadSchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  soDong: z.number().int().nonnegative(),
});

export type OrderPayload = z.infer<typeof payloadSchema>;

const tien = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(n).toLocaleString("vi-VN") + " ₫";

/** Đọc workbook thành danh sách sheet thuần để đưa vào bộ bóc tách. */
function laySheets(wb: ExcelJS.Workbook): OrderSheetLike[] {
  const out: OrderSheetLike[] = [];
  wb.eachSheet((ws) => {
    out.push(ws as unknown as OrderSheetLike);
  });
  return out;
}

/** Ảnh biên dạng nhúng trong sheet, bỏ logo nằm phía trên dòng tiêu đề. */
function trichAnh(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  si: number,
  headerRow: number
): { si: number; anchorRow: number; mime: string; buffer: Buffer }[] {
  const out: { si: number; anchorRow: number; mime: string; buffer: Buffer }[] = [];
  let imgs: ReturnType<ExcelJS.Worksheet["getImages"]>;
  try {
    imgs = ws.getImages();
  } catch {
    return out;
  }
  for (const im of imgs) {
    const tlRow = im.range?.tl?.row;
    if (typeof tlRow !== "number") continue;
    const anchorRow = Math.floor(tlRow) + 1;
    // Ảnh nằm trên dòng tiêu đề là logo công ty, không phải biên dạng vật tư.
    if (anchorRow < headerRow) continue;
    const media = wb.getImage(Number(im.imageId)) as { buffer?: Buffer; extension?: string };
    if (!media?.buffer) continue;
    out.push({ si, anchorRow, mime: "image/" + (media.extension || "png"), buffer: media.buffer });
  }
  return out;
}

interface DaBoc {
  kq: KetQuaDonHang;
  anh: { si: number; anchorRow: number; mime: string; buffer: Buffer }[];
}

async function bocFile(buffer: Buffer, fileName: string): Promise<DaBoc> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets = laySheets(wb);
  if (sheets.length === 0) throw new Error("File không có sheet nào.");

  const kq = bocTachDonHang(sheets, fileName);

  // Ảnh chỉ lấy ở sheet thực sự là bảng đặt hàng; cần headerRow nên phải bóc lại
  // từng sheet một lần nữa (rẻ, vì workbook đã nằm sẵn trong bộ nhớ).
  const anh: DaBoc["anh"] = [];
  let sort = 0;
  sheets.forEach((s, si) => {
    const r = bocTachSheet(s, tenSheetSach(s.name), sort, si);
    sort += r.dong.length;
    if (r.headerRow) {
      anh.push(...trichAnh(wb, s as unknown as ExcelJS.Worksheet, si, r.headerRow));
    }
  });

  return { kq, anh };
}

export async function parseOrder(
  buffer: Buffer,
  fileName: string,
  fileSize: number
): Promise<ImportPreview> {
  const { kq, anh } = await bocFile(buffer, fileName);
  const canhBao = [...kq.canhBao];

  // Khớp dự án theo kích thước rút từ tên file. Đơn hàng KHÔNG tự tạo dự án mới:
  // một đơn đặt hàng luôn thuộc về một dự án đã có, và tên file thì không đủ thông
  // tin để dựng một dự án tử tế.
  const projects = await db.project.findMany({ select: { id: true, code: true, name: true } });
  const khop = kq.dims ? projects.find((p) => norm(p.name) === norm(kq.dims!)) ?? null : null;

  if (!khop) {
    canhBao.unshift(
      kq.dims
        ? `Không có dự án nào tên "${kq.dims}" — không nhập được. Tạo dự án trước, hoặc sửa tên file cho khớp.`
        : "Tên file không chứa kích thước dạng K##L## nên không biết đơn này thuộc dự án nào."
    );
  }

  let ncc: string | null = null;
  let daCoDon: { orderNo: string | null; soDong: number } | null = null;
  if (khop) {
    const comps = COMPONENT_THEO_LOAI[kq.category];
    if (comps) {
      const link = await db.projectSupplier.findFirst({
        where: { projectId: khop.id, component: { in: comps } },
        select: { supplier: { select: { name: true } } },
      });
      ncc = link?.supplier?.name ?? null;
    }
    if (!ncc) {
      canhBao.push(
        `Dự án ${khop.code} chưa gán nhà cung cấp cho hạng mục ${NHAN_LOAI[kq.category] ?? kq.category} — đơn sẽ để trống NCC.`
      );
    }

    const cu = await db.purchaseOrder.findFirst({
      where: { projectId: khop.id, category: kq.category },
      select: { orderNo: true, _count: { select: { items: true } } },
    });
    if (cu) {
      daCoDon = { orderNo: cu.orderNo, soDong: cu._count.items };
      canhBao.unshift(
        `Dự án ${khop.code} đã có đơn ${NHAN_LOAI[kq.category] ?? kq.category} ("${cu.orderNo ?? "không tên"}", ${cu._count.items} dòng) — xác nhận sẽ THAY THẾ đơn đó.`
      );
    }
  }

  const ganDuoc = ganAnhVaoDong(kq.dong, anh).filter((s) => s >= 0).length;
  if (anh.length > ganDuoc) {
    canhBao.push(`${anh.length - ganDuoc}/${anh.length} ảnh biên dạng không gắn được vào dòng nào, sẽ bỏ qua.`);
  }

  return {
    kind: "order",
    fileName,
    duAn: {
      projectId: khop?.id ?? null,
      code: khop?.code ?? null,
      name: khop?.name ?? kq.dims ?? "(không xác định)",
      cachKhop: khop
        ? `khớp tên dự án theo kích thước ${kq.dims}`
        : "KHÔNG khớp dự án nào — không nhập được",
      // Đơn hàng không bao giờ tạo dự án mới; cờ này chỉ để giao diện tô màu cảnh báo.
      taoMoi: !khop,
    },
    thongKe: [
      { nhan: "Loại đơn", giaTri: NHAN_LOAI[kq.category] ?? kq.category },
      { nhan: "Số đơn", giaTri: kq.orderNo },
      {
        nhan: "Ngày đặt",
        giaTri: kq.orderDate ? kq.orderDate.toLocaleDateString("vi-VN") : "— (không đọc được từ tên file)",
      },
      { nhan: "Nhà cung cấp", giaTri: ncc ?? "— (chưa gán)" },
      { nhan: "Giá trị đơn", giaTri: tien(kq.tongTien) },
      { nhan: "Tổng trọng lượng", giaTri: kq.tongTrongLuong ? kq.tongTrongLuong.toLocaleString("vi-VN") + " kg" : "—" },
      { nhan: "Ảnh biên dạng", giaTri: ganDuoc ? `${ganDuoc} ảnh` : "—" },
      { nhan: "Đơn hiện có", giaTri: daCoDon ? `${daCoDon.soDong} dòng (sẽ bị thay)` : "chưa có" },
    ],
    canhBao,
    tieuDeCot: ["Sheet", "Hạng mục", "Tên hàng", "ĐV", "SL", "Trọng lượng", "Thành tiền"],
    dongMau: kq.dong.slice(0, 15).map((d) => ({
      cot: [
        d.category,
        d.groupName ?? "—",
        d.name,
        d.unit ?? "—",
        d.qty?.toLocaleString("vi-VN") ?? "—",
        d.weight?.toLocaleString("vi-VN") ?? "—",
        d.amount?.toLocaleString("vi-VN") ?? "—",
      ],
    })),
    tongSoDong: kq.dong.length,
    // Bước xác nhận phải gửi lại file (xem chú thích ở payloadSchema).
    canFileKhiXacNhan: true,
    payload: khop
      ? ({
          projectId: khop.id,
          fileName,
          fileSize,
          soDong: kq.dong.length,
        } satisfies OrderPayload)
      : null,
  };
}

export async function applyOrder(
  raw: unknown,
  file: { buffer: Buffer; name: string; size: number } | null,
  actor: SessionUser
): Promise<ImportResult> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      thongDiep: "Đơn này không khớp dự án nào nên không nhập được. Tạo dự án trước rồi thử lại.",
    };
  }
  const p = parsed.data;

  if (!file) {
    return { ok: false, thongDiep: "Thiếu file khi xác nhận — hãy chọn lại file và xem trước lần nữa." };
  }
  // Chặn đổi file giữa bước xem trước và bước xác nhận: người dùng đã duyệt một nội
  // dung cụ thể, ghi một nội dung khác vào là phản bội đúng cái họ vừa xác nhận.
  if (file.name !== p.fileName || file.size !== p.fileSize) {
    return {
      ok: false,
      thongDiep: "File khi xác nhận khác với file đã xem trước. Hãy xem trước lại rồi xác nhận.",
    };
  }

  const project = await db.project.findUnique({
    where: { id: p.projectId },
    select: { id: true, code: true },
  });
  if (!project) return { ok: false, thongDiep: "Dự án đích không còn tồn tại." };

  const { kq, anh } = await bocFile(file.buffer, file.name);
  if (kq.dong.length !== p.soDong) {
    return {
      ok: false,
      thongDiep: `File bóc ra ${kq.dong.length} dòng, khác ${p.soDong} dòng đã xem trước. Hãy xem trước lại.`,
    };
  }
  if (kq.dong.length === 0) {
    return { ok: false, thongDiep: "Không có dòng vật tư nào để nhập." };
  }

  const comps = COMPONENT_THEO_LOAI[kq.category];
  const link = comps
    ? await db.projectSupplier.findFirst({
        where: { projectId: project.id, component: { in: comps } },
        select: { supplierId: true },
      })
    : null;

  const ganVao = ganAnhVaoDong(kq.dong, anh);

  // Xóa đơn cũ và ghi đơn mới phải cùng thành công hoặc cùng hủy — nếu không, lỗi
  // giữa chừng để lại dự án không còn đơn hàng nào của loại này.
  const orderId = await db.$transaction(async (tx) => {
    await tx.purchaseOrder.deleteMany({
      where: { projectId: project.id, category: kq.category },
    });

    const created = await tx.purchaseOrder.create({
      data: {
        projectId: project.id,
        orderNo: kq.orderNo,
        orderDate: kq.orderDate,
        category: kq.category,
        supplierId: link?.supplierId ?? null,
        status: "ORDERED",
        orderedDate: kq.orderDate,
        value: kq.tongTien,
        totalWeight: kq.tongTrongLuong,
        filePath: file.name,
        items: {
          create: kq.dong.map((d: DongDonHang) => ({
            category: d.category,
            groupName: d.groupName,
            name: d.name,
            unit: d.unit,
            qty: d.qty,
            unitPrice: d.unitPrice,
            amount: d.amount,
            weight: d.weight,
            note: d.note,
            sortOrder: d.sortOrder,
          })),
        },
      },
      select: { id: true },
    });

    const coAnh = anh.filter((_, i) => ganVao[i] >= 0);
    if (coAnh.length) {
      const items = await tx.purchaseOrderItem.findMany({
        where: { orderId: created.id },
        select: { id: true, sortOrder: true },
      });
      const theoSort = new Map(items.map((it) => [it.sortOrder, it.id]));
      const rows = anh
        .map((im, i) => ({ im, itemId: theoSort.get(ganVao[i]) }))
        .filter((x): x is { im: (typeof anh)[number]; itemId: string } => !!x.itemId)
        .map((x, i) => ({
          itemId: x.itemId,
          mime: x.im.mime,
          data: Uint8Array.from(x.im.buffer),
          sortOrder: i,
        }));
      if (rows.length) await tx.poItemImage.createMany({ data: rows });
    }

    return created.id;
  });

  await recordAudit({
    actor,
    entity: "PurchaseOrder",
    entityId: orderId,
    entityLabel: kq.orderNo,
    projectId: project.id,
    action: "CREATE",
    changes: {
      donHang: {
        truoc: "(thay đơn cùng loại nếu có)",
        sau: `${kq.dong.length} dòng, ${NHAN_LOAI[kq.category] ?? kq.category}, nhập từ ${file.name}`,
      },
      value: { truoc: null, sau: kq.tongTien },
    },
  });

  const soAnh = ganVao.filter((s) => s >= 0).length;
  return {
    ok: true,
    projectId: project.id,
    thongDiep: `Đã nhập đơn ${kq.orderNo} (${kq.dong.length} dòng${
      soAnh ? `, ${soAnh} ảnh biên dạng` : ""
    }) vào dự án ${project.code}.`,
  };
}
