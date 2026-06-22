import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { computeAmount, computeProfit } from "@/lib/profit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "estimate", "view"))
    return new Response("Forbidden", { status: 403 });

  const project = await db.project.findUnique({
    where: { id },
    include: {
      estimateItems: {
        include: { supplier: { select: { name: true } } },
        orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!project) return new Response("Not found", { status: 404 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Dự toán ${project.code}`);

  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = `DỰ TOÁN — ${project.code} ${project.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };

  ws.addRow([]);
  const header = ws.addRow([
    "Nhóm",
    "Hạng mục",
    "ĐV",
    "KL TK",
    "KL TT",
    "Đơn giá",
    "Thành tiền",
    "NCC",
  ]);
  header.font = { bold: true };

  for (const it of project.estimateItems) {
    ws.addRow([
      ESTIMATE_GROUP_MAP[it.groupCode]?.label ?? it.groupCode,
      it.name,
      it.unit ?? "",
      it.designQty ?? "",
      it.actualQty ?? "",
      it.unitPrice ?? "",
      computeAmount(it),
      it.supplier?.name ?? "",
    ]);
  }

  const s = computeProfit(project.estimateItems, project.salePrice, project.area);
  ws.addRow([]);
  ws.addRow(["", "", "", "", "", "Tổng chi phí", s.totalCost]).font = { bold: true };
  if (can(session.role, "profit", "view")) {
    ws.addRow(["", "", "", "", "", "Giá bán", s.salePrice]);
    ws.addRow(["", "", "", "", "", "Lợi nhuận", s.profit]).font = { bold: true };
  }

  ws.getColumn(4).numFmt = "#,##0.00";
  ws.getColumn(5).numFmt = "#,##0.00";
  ws.getColumn(6).numFmt = "#,##0";
  ws.getColumn(7).numFmt = "#,##0";
  ws.columns.forEach((c) => {
    c.width = 16;
  });
  ws.getColumn(2).width = 24;

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="du-toan-${project.code}.xlsx"`,
    },
  });
}
