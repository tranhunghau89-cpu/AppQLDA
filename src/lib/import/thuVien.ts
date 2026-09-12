// Nhập thư viện đơn giá từ sheet "DV" của file báo giá (Bảng danh mục công việc).
// Phần bóc tách thuần nằm ở thuVien-parse.ts (test được, không cần Next).
//
// Khác mọi bộ nhập khác: file này KHÔNG thuộc dự án nào. Thư viện là dữ liệu toàn cục.
import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { nhomChiPhiTheoNhomMa, workGroupOf } from "@/lib/constants";
import { chonDonGia, type DongGiaUngVien } from "@/lib/thuVien/gia";
import type { SessionUser } from "@/lib/session";
import {
  bocTachThuVien,
  ngayHieuLucTuTenFile,
  soSanhVoiThuVien,
  type GiaHienCo,
  type SheetLike,
} from "./thuVien-parse";
import type { ImportPreview, ImportResult } from "./types";

export { bocTachThuVien, ngayHieuLucTuTenFile, soSanhVoiThuVien } from "./thuVien-parse";
export type { CongTacNhap, KetQuaBocThuVien } from "./thuVien-parse";

const SHEET = "DV";

const congTacSchema = z.object({
  ma: z.string().min(1),
  ten: z.string().min(1),
  tenNgan: z.string().nullable(),
  quyCach: z.string().nullable(),
  donVi: z.string().nullable(),
  vatTu: z.number().nullable(),
  nhanCongMay: z.number().nullable(),
  heSo: z.number().nullable(),
  donGia: z.number().nullable(),
  ghiChu: z.string().nullable(),
  sortOrder: z.number().int(),
});

const payloadSchema = z.object({
  hieuLucTu: z.string().min(1),
  congTac: z.array(congTacSchema),
});

export type ThuVienPayload = z.infer<typeof payloadSchema>;

const tien = (n: number | null) => (n == null ? "—" : n.toLocaleString("vi-VN") + " ₫");

/**
 * Đơn giá đang áp dụng của từng mã tại một ngày.
 *
 * Hai truy vấn cho cả danh mục chứ không phải một truy vấn mỗi mã — 135 mã thì cách
 * kia là 135 lượt đi về cơ sở dữ liệu chỉ để dựng một bảng xem trước.
 */
async function giaDangApDung(ngay: Date): Promise<GiaHienCo[]> {
  const [congTacs, banGias] = await Promise.all([
    db.congTac.findMany({ select: { id: true, ma: true } }),
    db.donGiaCongTac.findMany({
      where: { hieuLucTu: { lte: ngay } },
      select: {
        id: true,
        congTacId: true,
        congTacVatTuId: true,
        khuVucId: true,
        donGia: true,
        hieuLucTu: true,
        createdAt: true,
      },
    }),
  ]);

  const theoCongTac = new Map<string, DongGiaUngVien[]>();
  for (const g of banGias) {
    const ds = theoCongTac.get(g.congTacId);
    if (ds) ds.push(g);
    else theoCongTac.set(g.congTacId, [g]);
  }

  return congTacs.map((c) => ({
    ma: c.ma,
    daCoCongTac: true,
    donGia: chonDonGia(theoCongTac.get(c.id) ?? [], { congTacId: c.id, ngay }).donGia,
  }));
}

export async function parseThuVien(buffer: Buffer, fileName: string): Promise<ImportPreview> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`File không có sheet "${SHEET}" (Bảng danh mục công việc).`);

  const base = fileName.replace(/\.xlsx?$/i, "");
  const kq = bocTachThuVien(ws as unknown as SheetLike);
  const canhBao = [...kq.canhBao];

  // Ngày hiệu lực đọc từ tên file theo quy ước BG_..._D<ngày>_<năm>. Không đọc được
  // thì lùi về HÔM NAY và nói rõ — đoán bừa một ngày trong quá khứ sẽ chèn bản giá
  // xuống dưới các bản đã có và âm thầm không có tác dụng gì.
  const tuTen = ngayHieuLucTuTenFile(base);
  const hieuLucTu = tuTen ?? new Date();
  if (!tuTen) {
    canhBao.unshift(
      `Không đọc được ngày hiệu lực từ tên file "${base}" — dùng ngày hôm nay ` +
        `(${hieuLucTu.toLocaleDateString("vi-VN")}). Đổi tên theo dạng ..._D2504_23 để lấy đúng ngày.`
    );
  }

  const hienCo = await giaDangApDung(hieuLucTu);
  const ss = soSanhVoiThuVien(kq.congTac, hienCo);

  if (ss.congTacMoi === 0 && ss.doiGia === 0) {
    canhBao.unshift(
      "Không có gì để ghi: mọi mã trong file đều trùng đơn giá đang áp dụng. " +
        "Nhập lại cùng một bảng giá là vô hại, nhưng cũng không thay đổi gì."
    );
  }

  // Chỉ hiện những dòng THẬT SỰ đổi — danh sách 135 dòng mà 134 dòng "không đổi" thì
  // người duyệt sẽ lướt qua, và đó là lúc một thay đổi sai lọt lưới.
  const dangKe = ss.dong.filter((d) => d.loai === "CONG_TAC_MOI" || d.loai === "DOI_GIA" || d.loai === "GIA_MOI");

  const nhanLoai: Record<string, string> = {
    CONG_TAC_MOI: "Công tác mới",
    GIA_MOI: "Giá đầu tiên",
    DOI_GIA: "Đổi giá",
  };

  return {
    kind: "thuVien",
    fileName,
    thongKe: [
      // "Đưa vào thư viện" chứ không phải "trong file": hai con số đã khác nhau kể từ
      // khi mã trọn gói theo m² bị loại, và nhãn cũ sẽ thành một lời nói sai.
      { nhan: "Mã đưa vào thư viện", giaTri: String(kq.congTac.length) },
      { nhan: "Công tác mới", giaTri: String(ss.congTacMoi) },
      { nhan: "Đổi đơn giá", giaTri: String(ss.doiGia) },
      { nhan: "Hiệu lực từ", giaTri: hieuLucTu.toLocaleDateString("vi-VN") },
    ],
    canhBao,
    tieuDeCot: ["Mã CV", "Nội dung", "Thay đổi", "Giá đang dùng", "Giá trong file"],
    dongMau: dangKe.slice(0, 20).map((d) => ({
      cot: [d.ma, d.ten, nhanLoai[d.loai] ?? d.loai, tien(d.giaCu), tien(d.giaMoi)],
    })),
    tongSoDong: dangKe.length,
    payload: { hieuLucTu: hieuLucTu.toISOString(), congTac: kq.congTac } satisfies ThuVienPayload,
  };
}

/**
 * Ghi vào thư viện.
 *
 * Chỉ thêm bản giá cho mã THẬT SỰ đổi giá. Bảng giá được chép từ file báo giá này
 * sang file báo giá khác nên hai file cách nhau ba năm vẫn gần như y hệt; chèn thẳng
 * 135 bản giá mỗi lần nhập là chôn lịch sử giá dưới đống dòng trùng.
 *
 * Công tác đã có thì CẬP NHẬT phần mô tả (tên, quy cách, đơn vị) nhưng KHÔNG đụng
 * `nhomChiPhi`: đó là giá trị quản trị viên sửa trên giao diện, file Excel không biết.
 */
export async function applyThuVien(raw: unknown, actor: SessionUser): Promise<ImportResult> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, thongDiep: `Dữ liệu không hợp lệ: ${parsed.error.issues[0].message}` };
  }
  const p = parsed.data;
  const hieuLucTu = new Date(p.hieuLucTu);
  if (Number.isNaN(hieuLucTu.getTime())) {
    return { ok: false, thongDiep: "Ngày hiệu lực không hợp lệ." };
  }

  const hienCo = await giaDangApDung(hieuLucTu);
  const ss = soSanhVoiThuVien(p.congTac, hienCo);
  const theoMa = new Map(p.congTac.map((c) => [c.ma, c]));
  const canGhi = ss.dong.filter(
    (d) => d.loai === "CONG_TAC_MOI" || d.loai === "DOI_GIA" || d.loai === "GIA_MOI"
  );

  if (canGhi.length === 0) {
    return { ok: true, thongDiep: "Không có thay đổi nào — thư viện giữ nguyên." };
  }

  const dsCu = await db.congTac.findMany({ select: { id: true, ma: true } });
  const idTheoMa = new Map(dsCu.map((c) => [c.ma, c.id]));
  let taoCongTac = 0;
  let themBanGia = 0;

  // Một giao dịch cho cả lô: nhập nửa chừng sẽ để thư viện ở trạng thái mà không ai
  // biết mã nào đã vào mã nào chưa, và lần nhập lại sau đó không sửa được điều đó.
  await db.$transaction(async (tx) => {
    for (const d of canGhi) {
      const c = theoMa.get(d.ma);
      if (!c || c.donGia == null) continue;

      let congTacId = idTheoMa.get(c.ma);
      if (!congTacId) {
        const nhomMa = workGroupOf(c.ma);
        const moi = await tx.congTac.create({
          data: {
            ma: c.ma,
            ten: c.ten,
            tenNgan: c.tenNgan,
            quyCach: c.quyCach,
            donVi: c.donVi,
            nhomMa,
            nhomChiPhi: nhomChiPhiTheoNhomMa(nhomMa),
            heSo: c.heSo,
            ghiChu: c.ghiChu,
            sortOrder: c.sortOrder,
          },
          select: { id: true },
        });
        congTacId = moi.id;
        taoCongTac++;
      } else {
        await tx.congTac.update({
          where: { id: congTacId },
          data: {
            ten: c.ten,
            tenNgan: c.tenNgan,
            quyCach: c.quyCach,
            donVi: c.donVi,
            ghiChu: c.ghiChu,
          },
        });
      }

      await tx.donGiaCongTac.create({
        data: {
          congTacId,
          hieuLucTu,
          vatTu: c.vatTu,
          nhanCongMay: c.nhanCongMay,
          heSo: c.heSo,
          donGia: c.donGia,
          nguon: "IMPORT_EXCEL",
          createdById: actor.userId,
          createdByName: actor.name,
        },
      });
      themBanGia++;
    }
  });

  await recordAudit({
    actor,
    entity: "CongTac",
    entityId: "import",
    entityLabel: `Nhập Excel ${hieuLucTu.toLocaleDateString("vi-VN")}`,
    action: "UPDATE",
    changes: {
      congTac: { truoc: String(dsCu.length), sau: `${dsCu.length + taoCongTac} (thêm ${taoCongTac})` },
      donGia: { truoc: null, sau: `${themBanGia} bản giá mới, hiệu lực ${hieuLucTu.toLocaleDateString("vi-VN")}` },
    },
  });

  return {
    ok: true,
    thongDiep:
      `Đã thêm ${themBanGia} bản giá hiệu lực ${hieuLucTu.toLocaleDateString("vi-VN")}` +
      (taoCongTac > 0 ? ` và tạo ${taoCongTac} công tác mới` : "") +
      `. ${ss.khongDoi} mã không đổi giá — bỏ qua.`,
  };
}
