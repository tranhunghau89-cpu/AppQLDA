import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATUS, CONTRACT_STATUS_MAP } from "@/lib/constants";
import { formatVND, formatDate } from "@/lib/utils";

export default async function ContractsPage() {
  await requireView("contract");

  const contracts = await db.contract.findMany({
    orderBy: [{ status: "asc" }, { signDate: "desc" }],
    include: {
      project: { select: { id: true, code: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  const signed = contracts.filter((c) => c.status === "SIGNED");
  const totalSigned = signed.reduce((s, c) => s + (c.valueWithVat ?? 0), 0);
  const counts: Record<string, number> = {};
  for (const c of contracts) counts[c.status] = (counts[c.status] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Hợp đồng & Báo giá</h1>
        <p className="text-sm text-slate-500">
          Quản lý hợp đồng theo từng hạng mục, giá trị và trạng thái
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {CONTRACT_STATUS.map((s) => (
          <div key={s.value} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{counts[s.value] ?? 0}</div>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng giá trị đã ký (gồm VAT)</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{formatVND(totalSigned)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Dự án</Th>
              <Th>Số HĐ / Báo giá</Th>
              <Th>Chủ đầu tư</Th>
              <Th className="text-center">Trạng thái</Th>
              <Th className="text-right">Chưa VAT</Th>
              <Th className="text-right">Tổng (gồm VAT)</Th>
              <Th>Ngày ký</Th>
              <Th>File</Th>
            </tr>
          </THead>
          <tbody>
            {contracts.map((c) => {
              const st = CONTRACT_STATUS_MAP[c.status];
              return (
                <Tr key={c.id}>
                  <Td className="font-medium">
                    <Link
                      href={`/projects/${c.project.id}/contract`}
                      className="text-blue-600 hover:underline"
                    >
                      <span className="font-mono">{c.project.code}</span> {c.project.name}
                    </Link>
                  </Td>
                  <Td className="text-slate-700">{c.contractNo ?? c.subject ?? "—"}</Td>
                  <Td className="text-slate-700">{c.partyAName ?? c.project.name}</Td>
                  <Td className="text-center">
                    <Badge tone={st?.tone ?? "slate"}>{st?.label ?? c.status}</Badge>
                  </Td>
                  <Td className="text-right">{formatVND(c.valueBeforeVat ?? 0)}</Td>
                  <Td className="text-right font-medium">{formatVND(c.valueWithVat ?? 0)}</Td>
                  <Td className="text-slate-500">{c.signDate ? formatDate(c.signDate) : "—"}</Td>
                  <Td>
                    {c.filePath ? (
                      <a
                        href={`/api/contracts/${c.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <FileText className="h-4 w-4" /> Mở
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
