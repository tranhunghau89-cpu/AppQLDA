// Đọc / ghi phía server cho quy trình dự án. Luật thuần nằm ở quyTrinh.ts.
import { db } from "@/lib/db";
import {
  BUOC_THONG_TIN,
  CAC_BUOC,
  TEN_BUOC,
  boPhanMacDinh,
  loiGuiQc,
  thieuThongTin,
  tinhChuoi,
  type TrangThaiHien,
  type TrangThaiLuu,
} from "@/lib/quyTrinh";

export interface BuocView {
  id: string;
  buoc: string;
  ten: string;
  trangThai: TrangThaiHien;
  phuTrachId: string | null;
  phuTrachTen: string | null;
  boPhanMacDinh: string;
  /** Hạn đặt tay, hoặc ngày kế hoạch của mốc tiến độ cùng giai đoạn. */
  han: string | null;
  hanDatTay: boolean;
  guiLuc: string | null;
  duyetLuc: string | null;
  /** Chỉ định duyệt: người > phòng > (trống) Ban giám đốc. */
  duyetBoPhan: string | null;
  duyetNguoiId: string | null;
  duyetNguoiTen: string | null;
  /** Người đã bấm Duyệt (khi đã duyệt). */
  nguoiDuyetTen: string | null;
  /** Lý do chưa gửi duyệt được (thiếu thông tin / còn mục QC chưa đạt). null = gửi được. */
  chuaDu: string | null;
}

/** Tạo đủ các dòng bước còn thiếu cho dự án (chạy lại an toàn). */
export async function damBaoBuoc(projectIds: string[]) {
  if (projectIds.length === 0) return;
  await db.buocQuyTrinh.createMany({
    data: projectIds.flatMap((projectId) => CAC_BUOC.map((b) => ({ projectId, buoc: b.value }))),
    skipDuplicates: true,
  });
}

export async function napQuyTrinh(projectId: string): Promise<BuocView[]> {
  return (await napQuyTrinhNhieu([projectId])).get(projectId) ?? [];
}

/** Chuỗi bước của nhiều dự án trong một lượt truy vấn (Tổng quan, Việc quy trình). */
export async function napQuyTrinhNhieu(projectIds: string[]): Promise<Map<string, BuocView[]>> {
  const out = new Map<string, BuocView[]>();
  if (projectIds.length === 0) return out;
  await damBaoBuoc(projectIds);
  const where = { projectId: { in: projectIds } };
  const [rows, projects, qc, mocs] = await Promise.all([
    db.buocQuyTrinh.findMany({ where }),
    db.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        customerId: true,
        location: true,
        khuVucId: true,
        kK: true,
        kL: true,
        kH: true,
        area: true,
        salePrice: true,
        mauSon: true,
        mauTonMai: true,
        mauTonVach: true,
        _count: { select: { contacts: true, materialSpecs: true } },
      },
    }),
    db.qcMuc.findMany({ where, select: { projectId: true, giaiDoan: true, ketQua: true, boPhan: true } }),
    db.milestone.findMany({ where, select: { projectId: true, type: true, planDate: true } }),
  ]);

  const nguoiIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.phuTrachId, r.duyetNguoiId, r.nguoiDuyetId])
        .filter((x): x is string => !!x),
    ),
  ];
  const nguoi = new Map(
    (
      await db.user.findMany({ where: { id: { in: nguoiIds } }, select: { id: true, name: true } })
    ).map((u) => [u.id, u.name]),
  );
  const nhom = <T extends { projectId: string }>(ds: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of ds) (m.get(x.projectId) ?? m.set(x.projectId, []).get(x.projectId)!).push(x);
    return m;
  };
  const rowsTheoDa = nhom(rows);
  const qcTheoDa = nhom(qc);
  const mocTheoDa = nhom(mocs);

  for (const project of projects) {
    const soMuc: Record<string, number> = {};
    const xong: Record<string, number> = {};
    const boPhan: Record<string, string[]> = {};
    for (const m of qcTheoDa.get(project.id) ?? []) {
      soMuc[m.giaiDoan] = (soMuc[m.giaiDoan] ?? 0) + 1;
      if (m.ketQua === "DAT" || m.ketQua === "KHONG_AP_DUNG")
        xong[m.giaiDoan] = (xong[m.giaiDoan] ?? 0) + 1;
      (boPhan[m.giaiDoan] ??= []).push(m.boPhan);
    }
    const thieu = thieuThongTin({
      ...project,
      soNguoiLienHe: project._count.contacts,
      soQuyCachVatTu: project._count.materialSpecs,
    });
    const keHoach = new Map((mocTheoDa.get(project.id) ?? []).map((m) => [m.type, m.planDate]));
    const ds = rowsTheoDa.get(project.id) ?? [];
    const theoBuoc = new Map(ds.map((r) => [r.buoc, r]));
    const chuoi = tinhChuoi(
      ds.map((r) => ({ buoc: r.buoc, trangThai: r.trangThai as TrangThaiLuu })),
      soMuc,
    );

    out.set(
      project.id,
      chuoi.map(({ buoc, trangThai }) => {
        const r = theoBuoc.get(buoc)!;
        const han = r.hanXuLy ?? keHoach.get(buoc) ?? null;
        return {
          id: r.id,
          buoc,
          ten: TEN_BUOC[buoc],
          trangThai,
          phuTrachId: r.phuTrachId,
          phuTrachTen: r.phuTrachId ? (nguoi.get(r.phuTrachId) ?? "(đã xoá)") : null,
          boPhanMacDinh: boPhanMacDinh(buoc, boPhan[buoc] ?? []),
          han: han?.toISOString() ?? null,
          hanDatTay: r.hanXuLy != null,
          duyetBoPhan: r.duyetBoPhan,
          duyetNguoiId: r.duyetNguoiId,
          duyetNguoiTen: r.duyetNguoiId ? (nguoi.get(r.duyetNguoiId) ?? "(đã xoá)") : null,
          nguoiDuyetTen: r.nguoiDuyetId ? (nguoi.get(r.nguoiDuyetId) ?? "(đã xoá)") : null,
          guiLuc: r.guiLuc?.toISOString() ?? null,
          duyetLuc: r.duyetLuc?.toISOString() ?? null,
          chuaDu:
            buoc === BUOC_THONG_TIN
              ? thieu.length
                ? `Còn thiếu: ${thieu.join(", ")}.`
                : null
              : loiGuiQc({ tong: soMuc[buoc] ?? 0, xong: xong[buoc] ?? 0 }),
        };
      }),
    );
  }
  return out;
}


/** Ghi một tin Trao đổi gắn vào bước — chuông + hộp thư của người nhận. */
export async function nhanTinBuoc(v: {
  buocId: string;
  projectId: string;
  nhanDe: string;
  loai: "GHI_CHU" | "XIN_DUYET" | "CAN_SUA" | "DONG_Y";
  noiDung: string;
  tacGia: { userId: string; name: string };
  nguoiNhanIds: string[];
}) {
  const nhan = [...new Set(v.nguoiNhanIds)].filter((id) => id !== v.tacGia.userId);
  await db.traoDoi.create({
    data: {
      doiTuong: "BUOC",
      doiTuongId: v.buocId,
      projectId: v.projectId,
      nhanDe: v.nhanDe,
      loai: v.loai,
      noiDung: v.noiDung,
      tacGiaId: v.tacGia.userId,
      tacGiaTen: v.tacGia.name,
      nguoiNhan: { create: nhan.map((userId) => ({ userId })) },
    },
  });
}

/** Mục QC bị đánh "Không đạt" sau khi bước đã gửi / đã duyệt → bước quay về Đang làm. */
export async function moLaiBuocQc(
  projectId: string,
  giaiDoan: string,
  tacGia: { userId: string; name: string },
  noiDungMuc: string,
) {
  const b = await db.buocQuyTrinh.findUnique({
    where: { projectId_buoc: { projectId, buoc: giaiDoan } },
  });
  if (!b || (b.trangThai !== "DA_DUYET" && b.trangThai !== "CHO_DUYET")) return;
  await db.buocQuyTrinh.update({
    where: { id: b.id },
    data: { trangThai: "DANG_LAM", duyetLuc: null, nguoiDuyetId: null },
  });
  const p = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  await nhanTinBuoc({
    buocId: b.id,
    projectId,
    nhanDe: `${p?.code ?? ""} · ${TEN_BUOC[giaiDoan]}`,
    loai: "CAN_SUA",
    noiDung: `Mục "${noiDungMuc}" vừa bị đánh Không đạt — bước quay về Đang làm.`,
    tacGia,
    nguoiNhanIds: [...admins.map((a) => a.id), ...(b.phuTrachId ? [b.phuTrachId] : [])],
  });
}

/** Đầu vào cờ sức khoẻ từ chuỗi bước đã nạp. */
export function quyTrinhChoCo(ds: BuocView[]) {
  return ds.map((b) => ({
    buoc: b.buoc,
    ten: b.ten,
    trangThai: b.trangThai,
    han: b.han ? new Date(b.han) : null,
    daGiao: b.phuTrachId != null,
  }));
}
