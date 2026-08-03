import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  PROJECT_STATUS_MAP,
  MILESTONE_TYPE,
  MILESTONE_TYPE_MAP,
  PO_CATEGORY_MAP,
  PO_STATUS_MAP,
  PROPOSAL_KIND_MAP,
  PROPOSAL_STATUS_MAP,
} from "@/lib/constants";
import { paymentDb } from "@/lib/payments";
import { proposalDb } from "@/lib/proposals";

function d(x: Date | null | undefined): string {
  if (!x) return "";
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "project", "view"))
    return new Response("Forbidden", { status: 403 });

  const canViewDebt = can(session.role, "debt", "view");

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    include: {
      customer: { select: { name: true } },
      milestones: true,
    },
  });
  const orders = await db.purchaseOrder.findMany({
    orderBy: [{ orderDate: "desc" }],
    include: {
      project: { select: { code: true } },
      supplier: { select: { name: true } },
    },
  });
  const proposals = await proposalDb.findMany({ orderBy: [{ createdAt: "desc" }] });
  const payments = canViewDebt ? await paymentDb.findMany({}) : [];
  const projCode = new Map(projects.map((p) => [p.id, p.code]));

  const now = Date.now();
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const headerStyle = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EEF9" },
    };
  };

  // ===== Sheet 1: Dự án & tiến độ =====
  const ws1 = wb.addWorksheet("Du an & tien do");
  ws1.columns = [
    { header: "Mã", key: "code", width: 10 },
    { header: "Tên dự án", key: "name", width: 20 },
    { header: "Trạng thái", key: "status", width: 14 },
    { header: "CĐT", key: "customer", width: 24 },
    { header: "Vị trí", key: "location", width: 18 },
    { header: "% tiến độ (mốc)", key: "pct", width: 14 },
    { header: "Mốc trễ", key: "late", width: 10 },
    { header: "Bắt đầu", key: "start", width: 12 },
    { header: "Kết thúc", key: "end", width: 12 },
  ];
  for (const p of projects) {
    const doneCount = p.milestones.filter((m) => m.done).length;
    const late = p.milestones.filter(
      (m) => !m.done && m.planDate && m.planDate.getTime() < now
    ).length;
    ws1.addRow({
      code: p.code,
      name: p.name,
      status: PROJECT_STATUS_MAP[p.status]?.label ?? p.status,
      customer: p.customer?.name ?? "",
      location: p.location ?? "",
      pct: `${Math.round((doneCount / MILESTONE_TYPE.length) * 100)}%`,
      late,
      start: d(p.startDate),
      end: d(p.endDate),
    });
  }
  headerStyle(ws1);

  // ===== Sheet 2: Mốc trễ hạn =====
  const ws2 = wb.addWorksheet("Moc tre han");
  ws2.columns = [
    { header: "Mã DA", key: "code", width: 10 },
    { header: "Mốc", key: "type", width: 16 },
    { header: "Ngày kế hoạch", key: "plan", width: 14 },
    { header: "Trễ (ngày)", key: "days", width: 12 },
    { header: "Ghi chú mốc", key: "note", width: 30 },
  ];
  for (const p of projects) {
    for (const m of p.milestones) {
      if (!m.done && m.planDate && m.planDate.getTime() < now) {
        ws2.addRow({
          code: p.code,
          type: MILESTONE_TYPE_MAP[m.type]?.label ?? m.type,
          plan: d(m.planDate),
          days: Math.floor((now - m.planDate.getTime()) / 86400000),
          note: m.note ?? "",
        });
      }
    }
  }
  headerStyle(ws2);

  // ===== Sheet 3: Đơn hàng =====
  const ws3 = wb.addWorksheet("Don hang");
  ws3.columns = [
    { header: "Mã DA", key: "code", width: 10 },
    { header: "Số đơn", key: "no", width: 16 },
    { header: "Nhóm", key: "cat", width: 14 },
    { header: "NCC", key: "sup", width: 24 },
    { header: "Trạng thái", key: "st", width: 12 },
    { header: "Ngày đặt", key: "ordered", width: 12 },
    { header: "Dự kiến giao", key: "expected", width: 12 },
    { header: "Ngày nhận", key: "received", width: 12 },
    { header: "Trễ (ngày)", key: "late", width: 10 },
    { header: "Giá trị", key: "value", width: 16 },
  ];
  for (const o of orders) {
    const exp = (o as { expectedDate?: Date | null }).expectedDate ?? null;
    let late = 0;
    if (exp) {
      const end = o.receivedDate ? o.receivedDate.getTime() : now;
      late = Math.max(0, Math.floor((end - exp.getTime()) / 86400000));
    }
    ws3.addRow({
      code: o.project?.code ?? "",
      no: o.orderNo ?? "",
      cat: PO_CATEGORY_MAP[o.category]?.label ?? o.category,
      sup: o.supplier?.name ?? "",
      st: PO_STATUS_MAP[o.status]?.label ?? o.status,
      ordered: d(o.orderedDate),
      expected: d(exp),
      received: d(o.receivedDate),
      late: late || "",
      value: o.value ?? "",
    });
  }
  headerStyle(ws3);

  // ===== Sheet 4: Đề xuất =====
  const ws4 = wb.addWorksheet("De xuat");
  ws4.columns = [
    { header: "Tiêu đề", key: "title", width: 30 },
    { header: "Loại", key: "kind", width: 16 },
    { header: "Số tiền", key: "amount", width: 16 },
    { header: "Dự án", key: "proj", width: 10 },
    { header: "Trạng thái", key: "st", width: 12 },
    { header: "Người gửi", key: "by", width: 18 },
    { header: "Ngày gửi", key: "at", width: 12 },
    { header: "Người duyệt", key: "decBy", width: 18 },
    { header: "Ghi chú duyệt", key: "decNote", width: 24 },
  ];
  for (const x of proposals) {
    ws4.addRow({
      title: x.title,
      kind: PROPOSAL_KIND_MAP[x.kind]?.label ?? x.kind,
      amount: x.amount ?? "",
      proj: x.projectId ? (projCode.get(x.projectId) ?? "") : "",
      st: PROPOSAL_STATUS_MAP[x.status]?.label ?? x.status,
      by: x.createdBy,
      at: d(x.createdAt),
      decBy: x.decidedBy ?? "",
      decNote: x.decisionNote ?? "",
    });
  }
  headerStyle(ws4);

  // ===== Sheet 5: Thanh toán (nếu có quyền) =====
  if (canViewDebt) {
    const ws5 = wb.addWorksheet("Thanh toan");
    ws5.columns = [
      { header: "Mã DA", key: "code", width: 10 },
      { header: "Loại", key: "dir", width: 8 },
      { header: "Đợt", key: "name", width: 18 },
      { header: "Đối tác", key: "cp", width: 22 },
      { header: "Kế hoạch", key: "amount", width: 16 },
      { header: "Hạn", key: "due", width: 12 },
      { header: "Ngày thực tế", key: "paid", width: 12 },
      { header: "Số thực tế", key: "paidAmt", width: 16 },
      { header: "Tình trạng", key: "st", width: 14 },
    ];
    for (const x of payments) {
      let st = "Chờ";
      if (x.paidDate) st = x.direction === "THU" ? "Đã thu" : "Đã trả";
      else if (x.dueDate && x.dueDate.getTime() < now)
        st = `Quá hạn ${Math.floor((now - x.dueDate.getTime()) / 86400000)} ngày`;
      ws5.addRow({
        code: projCode.get(x.projectId) ?? "",
        dir: x.direction,
        name: x.name,
        cp: x.counterpart ?? "",
        amount: x.amount ?? "",
        due: d(x.dueDate),
        paid: d(x.paidDate),
        paidAmt: x.paidAmount ?? "",
        st,
      });
    }
    headerStyle(ws5);
  }

  const buf = await wb.xlsx.writeBuffer();
  const today = new Date();
  const fname = `bao-cao-tong-hop-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.xlsx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
