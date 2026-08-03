import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { takeoffDb, BT_GROUP_MAP } from "@/lib/takeoff";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, name: true },
  });
  if (!project) return new Response("Not found", { status: 404 });

  const items = await takeoffDb.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });

  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet("Be tong");
  ws1.columns = [
    { header: "Loại", key: "g", width: 14 },
    { header: "Mã CK", key: "code", width: 10 },
    { header: "D1 (m)", key: "d1", width: 9 },
    { header: "D2 (m)", key: "d2", width: 9 },
    { header: "D3 (m)", key: "d3", width: 9 },
    { header: "SL", key: "qty", width: 6 },
    { header: "BT (m3)", key: "c", width: 11 },
    { header: "VK (m2)", key: "f", width: 11 },
    { header: "HL thép (kg/m3)", key: "rr", width: 14 },
    { header: "Thép (kg)", key: "r", width: 11 },
    { header: "Ghi chú", key: "note", width: 24 },
  ];
  const ws2 = wb.addWorksheet("Thep");
  ws2.columns = [
    { header: "Mã CK", key: "code", width: 10 },
    { header: "Tên", key: "name", width: 36 },
    { header: "Quy cách", key: "spec", width: 24 },
    { header: "SL", key: "qty", width: 6 },
    { header: "KL (kg)", key: "s", width: 12 },
    { header: "Ghi chú", key: "note", width: 24 },
  ];
  for (const ws of [ws1, ws2]) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FB" } };
  }

  let tc = 0, tf = 0, tr = 0, ts = 0;
  for (const i of items) {
    if (i.kind === "BT") {
      const d = i.dims ? JSON.parse(i.dims) : {};
      ws1.addRow({
        g: BT_GROUP_MAP[i.group ?? ""]?.label ?? i.group,
        code: i.code ?? "", d1: d.d1, d2: d.d2, d3: d.d3, qty: i.qty,
        c: i.concrete, f: i.formwork, rr: i.rebarRatio ?? "", r: i.rebar ?? "",
        note: i.note ?? "",
      });
      tc += i.concrete ?? 0; tf += i.formwork ?? 0; tr += i.rebar ?? 0;
    } else {
      ws2.addRow({
        code: i.code ?? "", name: i.name, spec: i.spec ?? "", qty: i.qty,
        s: i.steel, note: i.note ?? "",
      });
      ts += i.steel ?? 0;
    }
  }
  const r1 = ws1.addRow({ g: "TỔNG", c: tc, f: tf, r: tr }); r1.font = { bold: true };
  const r2 = ws2.addRow({ code: "TỔNG", s: ts }); r2.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="boc-khoi-luong-${project.code}.xlsx"`,
    },
  });
}
