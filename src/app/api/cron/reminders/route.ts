// Nhắc việc hằng ngày — chạy bằng Vercel Cron (xem vercel.json).
//
// KHÔNG gửi đi đâu nếu chưa cấu hình `REMINDER_WEBHOOK_URL`. Mặc định chỉ tính toán
// và ghi ra log, để bật/tắt việc gửi ra ngoài là quyết định có chủ đích của quản trị.
//
// Endpoint này KHÔNG dùng phiên đăng nhập (cron không có cookie) nên phải tự bảo vệ
// bằng CRON_SECRET. Nó cũng cố tình KHÔNG lọc theo phạm vi dự án: đây là bản tin gửi
// cho ban quản lý, không phải trang cho người dùng cuối.
import { db } from "@/lib/db";
import {
  buildReminderReport,
  formatReminderText,
  type BaoGiaTheoDoiInput,
  type DotThanhToanInput,
  type HenLienHeInput,
  type MocTreInput,
} from "@/lib/reminders";
import { computeClientQuoteTotals } from "@/lib/clientQuote";
import { CLIENT_QUOTE_OPEN, MILESTONE_TYPE_MAP } from "@/lib/constants";

export const dynamic = "force-dynamic";

function duocPhep(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Chưa đặt secret -> từ chối hết. Thà không chạy còn hơn để endpoint mở toang.
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!duocPhep(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = Date.now();

  // Cùng cửa sổ "sắp tới" với phần còn lại của bản tin.
  const SAP_TOI_NGAY = 7;
  const hanSap = new Date(now + SAP_TOI_NGAY * 86_400_000);

  const [mocRows, dotRows, baoGiaRows, henRows] = await Promise.all([
    db.milestone.findMany({
      where: { done: false, planDate: { lt: new Date(now) } },
      select: {
        type: true,
        planDate: true,
        project: { select: { id: true, code: true, name: true, status: true } },
      },
    }),
    db.payment.findMany({
      where: { paidDate: null, dueDate: { not: null } },
      select: {
        direction: true,
        name: true,
        counterpart: true,
        amount: true,
        dueDate: true,
        project: { select: { id: true, code: true } },
      },
    }),
    // Báo giá còn đang theo đuổi và đã có hạn hiệu lực. Đã chốt / đã hủy / còn nháp
    // thì không nhắc. Chỉ số @@index([status, expiryDate]) phục vụ đúng truy vấn này.
    db.clientQuote.findMany({
      where: { status: { in: CLIENT_QUOTE_OPEN }, expiryDate: { not: null } },
      select: {
        id: true,
        quoteNo: true,
        recipient: true,
        expiryDate: true,
        vatPercent: true,
        project: { select: { code: true } },
        coHoi: { select: { tenCongTrinh: true } },
        lines: { select: { qty: true, unitPrice: true, amount: true } },
        customer: { select: { name: true } },
        // Hẹn liên hệ lại còn ở phía trước, gần nhất đứng đầu.
        contacts: {
          where: { nextFollowUpDate: { gte: new Date(now) } },
          orderBy: { nextFollowUpDate: "asc" },
          take: 1,
          select: { nextFollowUpDate: true },
        },
      },
    }),
    // Ghi chép CRM có hẹn liên hệ lại, còn trong cửa sổ hoặc đã quá hẹn. Chỉ lấy
    // ghi chép treo ở KHÁCH — ghi chép của chủ đầu tư đã ký thuộc việc khác.
    db.customerNote.findMany({
      where: {
        khachHangId: { not: null },
        nextFollowUpDate: { not: null, lte: hanSap },
      },
      orderBy: { nextFollowUpDate: "asc" },
      select: {
        content: true,
        nextFollowUpDate: true,
        khachHang: { select: { id: true, tenCty: true, ownerName: true } },
      },
    }),
  ]);

  const moc: MocTreInput[] = mocRows
    // Dự án đã hoàn thành thì mốc trễ không còn ý nghĩa nhắc nữa.
    .filter((m) => m.project.status !== "HOAN_THANH" && m.planDate !== null)
    .map((m) => ({
      projectId: m.project.id,
      projectCode: m.project.code,
      projectName: m.project.name,
      type: MILESTONE_TYPE_MAP[m.type]?.label ?? m.type,
      planDate: m.planDate as Date,
    }));

  const dot: DotThanhToanInput[] = dotRows.map((d) => ({
    projectId: d.project.id,
    projectCode: d.project.code,
    direction: d.direction,
    name: d.name,
    counterpart: d.counterpart,
    amount: d.amount,
    dueDate: d.dueDate as Date,
  }));

  // Hẹn gọi lại ghi ở khách trong CRM. Đây là thứ dễ rơi nhất: khách mới gọi một
  // cuộc, chưa có báo giá nào, nên không có bản ghi nào khác nhắc tới cái hẹn đó.
  const hen: HenLienHeInput[] = henRows
    .filter((n) => n.khachHang != null)
    .map((n) => ({
      khachHangId: n.khachHang!.id,
      tenCty: n.khachHang!.tenCty,
      phuTrach: n.khachHang!.ownerName,
      noiDung: n.content,
      ngayHen: n.nextFollowUpDate as Date,
    }));

  const baoGia: BaoGiaTheoDoiInput[] = baoGiaRows.map((q) => ({
    clientQuoteId: q.id,
    quoteNo: q.quoteNo,
    // Báo giá ở cơ hội chưa có mã dự án; lấy tên công trình đang chào để bản tin vẫn
    // gọi được tên nó.
    projectCode: q.project?.code ?? q.coHoi?.tenCongTrinh ?? "—",
    // Tên chụp lúc lập ("Kính gửi") là thứ in trên văn bản; CĐT đang gắn chỉ để dự phòng.
    customer: q.recipient ?? q.customer?.name ?? null,
    total: computeClientQuoteTotals(q.lines, q.vatPercent).withVat,
    expiryDate: q.expiryDate as Date,
    henLienHeLai: q.contacts[0]?.nextFollowUpDate ?? null,
  }));

  // Tham số 5 và 6; giữ nguyên mặc định của tham số thứ 4.
  const banTin = buildReminderReport(moc, dot, now, SAP_TOI_NGAY, baoGia, hen);
  const noiDung = formatReminderText(banTin);

  let daGui = false;
  let loiGui: string | null = null;
  const url = process.env.REMINDER_WEBHOOK_URL;

  if (banTin.rong) {
    console.log("[cron/reminders] không có gì để nhắc.");
  } else if (!url) {
    // Chưa cấu hình nơi nhận — chỉ ghi log. Vào Vercel > Logs để xem.
    console.log("[cron/reminders] chưa đặt REMINDER_WEBHOOK_URL, chỉ ghi log:\n" + noiDung);
  } else {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `text` hợp với Slack/Google Chat; `content` hợp với Discord; ai cần định dạng
        // khác thì đặt một endpoint trung gian chuyển đổi.
        body: JSON.stringify({ text: noiDung, content: noiDung }),
      });
      daGui = res.ok;
      if (!res.ok) loiGui = `HTTP ${res.status}`;
    } catch (e) {
      loiGui = e instanceof Error ? e.message : String(e);
    }
    if (loiGui) console.error("[cron/reminders] gửi thất bại:", loiGui);
  }

  return Response.json({
    ok: true,
    thoiDiem: new Date(now).toISOString(),
    soMocTre: banTin.mocTre.length,
    soDotQuaHan: banTin.quaHan.length,
    soDotSapToiHan: banTin.sapToiHan.length,
    soBaoGiaHetHan: banTin.baoGiaHetHan.length,
    soBaoGiaSapHetHan: banTin.baoGiaSapHetHan.length,
    soHenLienHe: banTin.henLienHe.length,
    // Cho biết bản tin có bị bỏ qua vì không có gì để nhắc — thứ duy nhất phân biệt
    // "sáng nay yên ả" với "mục mới tính xong nhưng không bao giờ gửi".
    rong: banTin.rong,
    tongPhaiThuQuaHan: banTin.tongPhaiThuQuaHan,
    tongPhaiTraQuaHan: banTin.tongPhaiTraQuaHan,
    daGui,
    loiGui,
  });
}
