import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PROJECT_STATUS_MAP } from "@/lib/constants";
import { computeProfit } from "@/lib/profit";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "project", "view"))
    return new Response("Forbidden", { status: 403 });

  const canViewProfit = can(session.role, "profit", "view");

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    include: {
      customer: { select: { name: true } },
      estimateItems: {
        select: {
          groupCode: true,
          designQty: true,
          actualQty: true,
          unitPrice: true,
          amount: true,
        },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách dự án");

  const columns: Partial<ExcelJS.Column>[] = [
    { header: "Mã", key: "code", width: 10 },
    { header: "Tên dự án", key: "name", width: 18 },
    { header: "Trạng thái", key: "status", width: 14 },
    { header: "CĐT", key: "customer", width: 22 },
    { header: "Vị trí", key: "location", width: 20 },
    { header: "Diện tích (m²)", key: "area", width: 14 },
    { header: "Tổng chi phí", key: "cost", width: 18 },
  ];
  if (canViewProfit) {
    columns.push(
      { header: "Giá bán", key: "sale", width: 18 },
      { header: "Lợi nhuận", key: "profit", width: 18 },
      { header: "Biên LN (%)", key: "margin", width: 12 }
    );
  }
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };

  for (const p of projects) {
    const s = computeProfit(p.estimateItems, p.salePrice, p.area);
    const row: Record<string, unknown> = {
      code: p.code,
      name: p.name,
      status: PROJECT_STATUS_MAP[p.status]?.label ?? p.status,
      customer: p.customer?.name ?? "",
      location: p.location ?? "",
      area: p.area ?? "",
      cost: s.totalCost,
    };
    if (canViewProfit) {
      row.sale = s.salePrice;
      row.profit = s.profit;
      row.margin = s.margin != null ? Number((s.margin * 100).toFixed(1)) : "";
    }
    ws.addRow(row);
  }

  const moneyCols = canViewProfit ? ["cost", "sale", "profit"] : ["cost"];
  for (const key of moneyCols) {
    ws.getColumn(key).numFmt = "#,##0";
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="danh-sach-du-an.xlsx"`,
    },
  });
}
