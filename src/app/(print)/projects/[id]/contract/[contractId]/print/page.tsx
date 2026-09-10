import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { computeContractTotals, lineAmount } from "@/lib/contract";
import { docTienVietNam } from "@/lib/money-words";
import { formatDate, formatNumber } from "@/lib/utils";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintHeader, PrintPage, PrintSignatures } from "@/components/print/PrintFrame";
import { congTy } from "@/lib/company";

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string; contractId: string }>;
}) {
  const { id, contractId } = await params;
  await requireProjectView("contract", id);

  const hd = await db.contract.findUnique({
    where: { id: contractId },
    include: {
      project: { select: { id: true, code: true, name: true, location: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  // Quyền được kiểm theo `id` trên URL nên phải chắc hợp đồng này đúng là của dự án đó.
  if (!hd || hd.projectId !== id) notFound();

  const tong = computeContractTotals(hd.items, hd.vatPercent);
  const bangChu = docTienVietNam(tong.withVat);
  const c = congTy();

  return (
    <>
      <PrintToolbar quayVe={`/projects/${id}/contract`} nhan="Quay lại hợp đồng" />

      <PrintPage>
        <PrintHeader />

        <div className="giu-nguyen-khoi text-center">
          <h1 className="text-xl font-bold uppercase">Bảng giá trị hợp đồng</h1>
          {hd.contractNo && <div className="mt-1 text-[11px]">Số: {hd.contractNo}</div>}
          {hd.subject && <div className="mt-0.5 text-[11px] italic">V/v: {hd.subject}</div>}
        </div>

        <dl className="giu-nguyen-khoi mt-5 space-y-1 text-[11.5px]">
          <Dong nhan="Bên A" giaTri={hd.partyAName} />
          {hd.partyAInfo && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0" />
              <dd className="min-w-0 whitespace-pre-wrap text-[11px] text-slate-600">
                {hd.partyAInfo}
              </dd>
            </div>
          )}
          <Dong nhan="Bên B" giaTri={c.ten} />
          <Dong nhan="Công trình" giaTri={`${hd.project.code} — ${hd.project.name}`} />
          <Dong nhan="Địa điểm" giaTri={hd.project.location} />
          <Dong nhan="Ngày ký" giaTri={hd.signDate ? formatDate(hd.signDate) : null} />
        </dl>

        <table className="mt-4 w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-slate-100">
              <Th className="w-10 text-center">TT</Th>
              <Th>Hạng mục</Th>
              <Th className="w-14 text-center">ĐVT</Th>
              <Th className="w-24 text-right">Khối lượng</Th>
              <Th className="w-28 text-right">Đơn giá</Th>
              <Th className="w-32 text-right">Thành tiền</Th>
            </tr>
          </thead>
          <tbody>
            {hd.items.map((it, i) => (
              <tr key={it.id}>
                <td className="border border-slate-400 px-2 py-1 text-center">{i + 1}</td>
                <td className="border border-slate-400 px-2 py-1">{it.name}</td>
                <td className="border border-slate-400 px-2 py-1 text-center">{it.unit ?? ""}</td>
                <td className="border border-slate-400 px-2 py-1 text-right">
                  {formatNumber(it.qty)}
                </td>
                <td className="border border-slate-400 px-2 py-1 text-right">
                  {formatNumber(it.unitPrice)}
                </td>
                <td className="border border-slate-400 px-2 py-1 text-right">
                  {formatNumber(lineAmount(it))}
                </td>
              </tr>
            ))}

            <TongDong nhan="Cộng (chưa VAT)" tien={tong.beforeVat} />
            <TongDong nhan={`Thuế VAT (${hd.vatPercent ?? 0}%)`} tien={tong.vat} />
            <TongDong nhan="TỔNG CỘNG (đã gồm VAT)" tien={tong.withVat} damNet />
          </tbody>
        </table>

        {bangChu && (
          <div className="giu-nguyen-khoi mt-2 text-[11.5px]">
            <span className="font-semibold">Bằng chữ: </span>
            <span className="italic">{bangChu}</span>
          </div>
        )}

        {hd.paymentTerms && (
          <div className="giu-nguyen-khoi mt-5 text-[11px]">
            <div className="font-semibold">Điều khoản thanh toán:</div>
            <div className="whitespace-pre-wrap">{hd.paymentTerms}</div>
          </div>
        )}

        {hd.note && (
          <div className="giu-nguyen-khoi mt-4 text-[11px]">
            <div className="font-semibold">Ghi chú:</div>
            <div className="whitespace-pre-wrap">{hd.note}</div>
          </div>
        )}

        <PrintSignatures
          traiTieuDe="ĐẠI DIỆN BÊN A"
          phaiTieuDe="ĐẠI DIỆN BÊN B"
          traiPhu={hd.partyAName}
          phaiPhu={c.ten}
          diaDiem={hd.project.location}
          ngay={hd.signDate}
        />
      </PrintPage>
    </>
  );
}

function Dong({ nhan, giaTri }: { nhan: string; giaTri: string | null }) {
  if (!giaTri) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-semibold">{nhan}:</dt>
      <dd className="min-w-0">{giaTri}</dd>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`border border-slate-400 px-2 py-1.5 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function TongDong({
  nhan,
  tien,
  damNet = false,
}: {
  nhan: string;
  tien: number;
  damNet?: boolean;
}) {
  return (
    <tr className={damNet ? "bg-slate-100 font-bold" : "font-semibold"}>
      <td colSpan={5} className="border border-slate-400 px-2 py-1.5 text-right">
        {nhan}
      </td>
      <td className="border border-slate-400 px-2 py-1.5 text-right">{formatNumber(tien)}</td>
    </tr>
  );
}
