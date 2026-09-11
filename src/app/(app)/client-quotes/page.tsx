import Link from "next/link";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { whereKhachHangTrongPhamVi } from "@/lib/crmScope";
import { LapNhanh } from "./LapNhanh";
import { myProjectIds } from "@/lib/scope";
import { whereBaoGiaTrongPhamVi } from "@/lib/crmScope";
import { docGiaiDoan, ghepLoc } from "@/lib/giaiDoan";
import { GiaiDoanChips } from "@/components/GiaiDoanChips";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatVND, formatDate } from "@/lib/utils";
import { computeClientQuoteTotals } from "@/lib/clientQuote";
import { CLIENT_QUOTE_OPEN, CLIENT_QUOTE_STATUS_MAP } from "@/lib/constants";

export default async function ClientQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireView("quote");
  const giaiDoan = docGiaiDoan((await searchParams)["giai-doan"]);

  // Báo giá sống ở hai nơi từ Phase 8.4 — phạm vi gộp dự án được phân công và cơ hội
  // của khách mình phụ trách.
  const pham = whereBaoGiaTrongPhamVi(session, await myProjectIds(session));

  const canEdit = can(session.role as Role, "quote", "edit");
  const canTaoKhach = can(session.role as Role, "customer", "edit");

  // Đếm trong CÙNG phạm vi, không phải toàn bảng.
  const [quotes, soChaoGia, soDuAn, khachRows, mauRows] = await Promise.all([
    db.clientQuote.findMany({
      where: ghepLoc(pham, giaiDoan),
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, code: true, name: true } },
        coHoi: { select: { id: true, tenCongTrinh: true } },
        customer: { select: { name: true } },
        lines: { select: { qty: true, unitPrice: true, amount: true } },
      },
    }),
    db.clientQuote.count({ where: ghepLoc(pham, "CHAO_GIA") }),
    db.clientQuote.count({ where: ghepLoc(pham, "DU_AN") }),
    // Nguồn cho hộp thoại lập nhanh. Chỉ nạp khi thật sự lập được — không thì đây là
    // danh sách khách gửi xuống trình duyệt mà chẳng để làm gì.
    canEdit
      ? db.khachHang.findMany({
          where: whereKhachHangTrongPhamVi(session),
          orderBy: { tenCty: "asc" },
          select: {
            id: true,
            tenCty: true,
            // Công trình đã thành dự án thì lập báo giá ở trang dự án, không ở đây.
            coHoi: {
              where: { projectId: null, trangThai: { not: "MAT" } },
              orderBy: { createdAt: "desc" },
              select: { id: true, tenCongTrinh: true },
            },
          },
        })
      : Promise.resolve([]),
    canEdit
      ? db.quoteTemplate.findMany({
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, buildingType: true },
        })
      : Promise.resolve([]),
  ]);

  const rows = quotes.map((q) => ({
    ...q,
    totals: computeClientQuoteTotals(q.lines, q.vatPercent),
  }));

  const dangTheoDuoi = rows.filter((q) => CLIENT_QUOTE_OPEN.includes(q.status));
  const daChot = rows.filter((q) => q.status === "CHOT");
  const tongDaChot = daChot.reduce((s, q) => s + q.totals.withVat, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Báo giá gửi khách</h1>
          <p className="text-sm text-slate-500">
            Báo giá theo hạng mục (m²) — {rows.length} bản
          </p>
        </div>
        {canEdit && (
          <LapNhanh khach={khachRows} mau={mauRows} canTaoKhach={canTaoKhach} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng số</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Đang theo đuổi</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{dangTheoDuoi.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Đã chốt</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{daChot.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Giá trị đã chốt</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{formatVND(tongDaChot)}</div>
        </div>
      </div>

      <GiaiDoanChips
        duongDan="/client-quotes"
        hienTai={giaiDoan}
        dem={{ TAT_CA: soChaoGia + soDuAn, CHAO_GIA: soChaoGia, DU_AN: soDuAn }}
      />

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Dự án / công trình</Th>
              <Th hideBelow="md">Số BG</Th>
              <Th>Kính gửi</Th>
              <Th>Trạng thái</Th>
              <Th hideBelow="lg" className="text-right">Trước thuế</Th>
              <Th hideBelow="lg" className="text-right">VAT</Th>
              <Th className="text-right">Sau thuế</Th>
              <Th hideBelow="sm">Hiệu lực đến</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((q) => {
              const tt = CLIENT_QUOTE_STATUS_MAP[q.status];
              return (
                <Tr key={q.id}>
                  <Td className="font-medium">
                    {q.project ? (
                      <Link
                        href={`/projects/${q.project.id}/client-quote`}
                        className="text-blue-600 hover:underline"
                      >
                        <span className="font-mono">{q.project.code}</span> {q.project.name}
                      </Link>
                    ) : q.coHoi ? (
                      <Link
                        href={`/co-hoi/${q.coHoi.id}/client-quote`}
                        className="text-blue-600 hover:underline"
                      >
                        {q.coHoi.tenCongTrinh}
                        <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-normal text-amber-700">
                          đang chào giá
                        </span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td hideBelow="md" className="font-mono text-slate-500">
                    {q.quoteNo ?? "—"}
                  </Td>
                  <Td className="text-slate-700">
                    {q.recipient ?? q.customer?.name ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={tt?.tone ?? "slate"}>{tt?.label ?? q.status}</Badge>
                  </Td>
                  <Td hideBelow="lg" className="text-right text-slate-500">
                    {formatVND(q.totals.beforeVat)}
                  </Td>
                  <Td hideBelow="lg" className="text-right text-slate-500">
                    {formatVND(q.totals.vat)}
                  </Td>
                  <Td className="text-right font-medium">{formatVND(q.totals.withVat)}</Td>
                  <Td hideBelow="sm" className="text-slate-500">
                    {q.expiryDate ? formatDate(q.expiryDate) : "—"}
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={8} className="py-8 text-center text-slate-400">
                  Chưa có báo giá gửi khách nào
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
