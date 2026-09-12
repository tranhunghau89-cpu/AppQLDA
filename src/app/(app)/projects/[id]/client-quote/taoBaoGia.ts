// Dựng một bản báo giá gửi khách từ mẫu trong thư viện.
//
// Tách khỏi file action vì hai đường tạo cùng cần: hộp thoại trong trang báo giá, và
// đường "lập nhanh" từ danh sách. Cố ý KHÔNG phải "use server" — mọi export trong file
// đó đều thành server action gọi được từ trình duyệt, mà hàm này tự nó không kiểm quyền.
import "server-only";
import { db } from "@/lib/db";
import { apDungMau, type KhuonBaoGia, type MauNguon } from "@/lib/quoteTemplate";
import { dungKhuonGuiKhach } from "@/lib/thuVien/boHangMuc";
import { duLieuChu, type ChuBaoGia } from "@/lib/quoteOwner";

/**
 * Nạp một BỘ HẠNG MỤC về dạng thuần để `apDungMau` nấu.
 *
 * Nguồn đã đổi từ bảng mẫu báo giá cũ sang bộ hạng mục, nhưng hình dạng trả về giữ
 * nguyên `MauNguon` — nên `apDungMau` và cả đường sinh dòng báo giá không phải sửa
 * một chữ. Đổi nguồn mà không đổi khế ước là cách thay móng mà không dỡ nhà.
 *
 * Bộ đã bị xóa (hoặc id bịa) trả null — báo giá vẫn lập được bằng giá trị mặc định,
 * chứ không báo lỗi chặn người dùng lại.
 */
export async function napMau(templateId: string | null): Promise<MauNguon | null> {
  if (!templateId) return null;
  const t = await db.boHangMuc.findUnique({
    where: { id: templateId },
    include: {
      phan: { orderBy: { sortOrder: "asc" } },
      vatLieu: { orderBy: { sortOrder: "asc" }, include: { vatTu: true } },
      giaiDoan: { orderBy: { sortOrder: "asc" } },
      thanhToan: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!t) return null;

  return {
    vatPercent: t.vatPercent,
    validDays: t.validDays,
    warrantyMonths: t.warrantyMonths,
    maintenanceMonths: t.maintenanceMonths,
    loadRoof: t.loadRoof,
    loadHanging: t.loadHanging,
    loadFloor: t.loadFloor,
    lineDetail: t.lineDetail,
    greeting: t.greeting,
    closing: t.closing,
    colorNote: t.colorNote,
    volumeNote: t.volumeNote,
    excludeNote: t.excludeNote,
    lines: dungKhuonGuiKhach(t.phan),
    // Bảng TSKT giờ lấy chữ từ vật tư trong thư viện: sửa quy cách tôn một chỗ là
    // mọi bộ dùng nó cùng đổi, thay vì phải sửa từng mẫu như trước.
    specs: t.vatLieu.map((r) => ({
      groupCode: r.vatTu.nhomTSKT === "B" ? "B" : "A",
      tag: r.vatTu.tag,
      name: r.vatTu.ten,
      spec: r.vatTu.quyCach,
      origin: r.vatTu.xuatXu,
      inDescription: r.vatTu.inTrongMoTa,
    })),
    stages: t.giaiDoan.map((r) => ({ name: r.ten, days: r.soNgay ?? 0 })),
    payments: t.thanhToan.map((r) => ({
      label: r.nhan,
      percent: r.phanTram ?? 0,
      basis: r.canCu,
      note: r.ghiChu,
    })),
  };
}

/** Ba bảng con giống hệt nhau ở mọi đường tạo báo giá — viết một lần. */
export function bangConCuaMau(quoteId: string, k: KhuonBaoGia) {
  return {
    specs: k.specs.map((sp, i) => ({ quoteId, ...sp, sortOrder: i })),
    stages: k.stages.map((st, i) => ({ quoteId, ...st, sortOrder: i })),
    payments: k.payments.map((p, i) => ({ quoteId, ...p, sortOrder: i })),
  };
}

/**
 * Tạo báo giá mới kèm toàn bộ phần đã soạn sẵn (bảng vật liệu, tiến độ thi công,
 * tiến độ thanh toán, và hạng mục nếu mẫu có khai) trong MỘT giao dịch — báo giá
 * thiếu bảng vật liệu hay thiếu điều khoản là một văn bản hỏng, không được phép
 * tồn tại nửa vời.
 *
 * Chọn mẫu thì lấy của mẫu, không chọn thì lấy mặc định trong clientQuoteDefaults.
 * Người lập vẫn đè được từng ô trong hộp thoại — ô nào để trống mới rơi về mẫu.
 */
export async function taoMoiKemMacDinh(
  chu: ChuBaoGia,
  data: Record<string, unknown>,
  templateId: string | null
): Promise<string> {
  const k = apDungMau(await napMau(templateId));

  return db.$transaction(async (tx) => {
    const q = await tx.clientQuote.create({
      data: {
        ...duLieuChu(chu),
        ...(data as { title: string }),
        templateId,
        vatPercent: (data.vatPercent as number | null) ?? k.vatPercent,
        validDays: (data.validDays as number | null) ?? k.validDays,
        warrantyMonths: (data.warrantyMonths as number | null) ?? k.warrantyMonths,
        maintenanceMonths: (data.maintenanceMonths as number | null) ?? k.maintenanceMonths,
        loadRoof: (data.loadRoof as number | null) ?? k.loadRoof,
        loadHanging: (data.loadHanging as number | null) ?? k.loadHanging,
        loadFloor: (data.loadFloor as number | null) ?? k.loadFloor,
        lineDetail: (data.lineDetail as string | null) ?? k.lineDetail,
        greeting: (data.greeting as string | null) ?? k.greeting,
        closing: (data.closing as string | null) ?? k.closing,
        colorNote: (data.colorNote as string | null) ?? k.colorNote,
        volumeNote: (data.volumeNote as string | null) ?? k.volumeNote,
        excludeNote: (data.excludeNote as string | null) ?? k.excludeNote,
      },
    });

    const con = bangConCuaMau(q.id, k);
    if (k.lines.length > 0) {
      await tx.clientQuoteLine.createMany({
        data: k.lines.map((l, i) => ({
          quoteId: q.id,
          partCode: l.partCode,
          partName: l.partName,
          code: l.code,
          name: l.name,
          detail: l.detail,
          unit: l.unit,
          note: l.note,
          // Chưa có báo giá chi tiết để suy ra: dùng đơn giá mặc định của mẫu,
          // khối lượng để trống cho người lập điền.
          unitPrice: l.defaultUnitPrice,
          tags: l.tags,
          steelFrameKey: l.steelFrameKey,
          sortOrder: i,
        })),
      });
    }
    await tx.clientQuoteSpec.createMany({ data: con.specs });
    await tx.clientQuoteStage.createMany({ data: con.stages });
    await tx.clientQuotePayment.createMany({ data: con.payments });
    return q.id;
  });
}
