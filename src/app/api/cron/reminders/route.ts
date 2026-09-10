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
  type DotThanhToanInput,
  type MocTreInput,
} from "@/lib/reminders";
import { MILESTONE_TYPE_MAP } from "@/lib/constants";

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

  const [mocRows, dotRows] = await Promise.all([
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

  const banTin = buildReminderReport(moc, dot, now);
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
    tongPhaiThuQuaHan: banTin.tongPhaiThuQuaHan,
    tongPhaiTraQuaHan: banTin.tongPhaiTraQuaHan,
    daGui,
    loiGui,
  });
}
