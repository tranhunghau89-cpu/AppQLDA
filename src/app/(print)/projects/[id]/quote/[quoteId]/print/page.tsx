import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { computeQuoteTotals, lineSell } from "@/lib/quote";
import { docTienVietNam } from "@/lib/money-words";
import { formatDate, formatNumber } from "@/lib/utils";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintHeader, PrintPage, PrintSignatures } from "@/components/print/PrintFrame";

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string; quoteId: string }>;
}) {
  const { id, quoteId } = await params;
  await requireProjectView("quote", id);

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      project: { select: { id: true, code: true, name: true, location: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  // Kiểm quyền ở trên theo `id` trên URL, nên phải chắc báo giá này đúng là của dự án
  // đó — nếu không, đổi quoteId trên thanh địa chỉ là đọc được báo giá dự án khác.
  if (!quote || quote.projectId !== id) notFound();

  const tong = computeQuoteTotals(quote.items);
  const bangChu = docTienVietNam(tong.sell);

  // Dựng cây phần > mục con, giữ nguyên thứ tự sortOrder đã có.
  const goc = quote.sections.filter((s) => !s.parentId);
  const conCua = (parentId: string) => quote.sections.filter((s) => s.parentId === parentId);
  const dongCua = (sectionId: string) => quote.items.filter((it) => it.sectionId === sectionId);

  let stt = 0;

  return (
    <>
      <PrintToolbar quayVe={`/projects/${id}/quote`} nhan="Quay lại báo giá" />

      <PrintPage>
        <PrintHeader />

        <div className="giu-nguyen-khoi text-center">
          <h1 className="text-xl font-bold uppercase">Bảng báo giá</h1>
          <div className="mt-1 text-[11px] italic">
            {quote.title}
            {quote.quoteDate ? ` — ngày ${formatDate(quote.quoteDate)}` : ""}
          </div>
        </div>

        <dl className="giu-nguyen-khoi mt-5 space-y-1 text-[11.5px]">
          <Dong nhan="Kính gửi" giaTri={quote.recipient} />
          <Dong nhan="Công trình" giaTri={`${quote.project.code} — ${quote.project.name}`} />
          <Dong nhan="Địa điểm" giaTri={quote.location ?? quote.project.location} />
          <Dong nhan="Hạng mục" giaTri={quote.scope} />
        </dl>

        <table className="mt-4 w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-slate-100">
              <Th className="w-10 text-center">TT</Th>
              <Th>Hạng mục / Nội dung công việc</Th>
              <Th className="w-14 text-center">ĐVT</Th>
              <Th className="w-20 text-right">Khối lượng</Th>
              <Th className="w-24 text-right">Đơn giá</Th>
              <Th className="w-28 text-right">Thành tiền</Th>
            </tr>
          </thead>
          <tbody>
            {goc.map((phan) => {
              const con = conCua(phan.id);
              const trongPhan = [
                ...dongCua(phan.id),
                ...con.flatMap((c) => dongCua(c.id)),
              ];
              const tienPhan = trongPhan.reduce((s, it) => s + lineSell(it), 0);

              return (
                <Phan
                  key={phan.id}
                  phan={{ code: phan.code, name: phan.name, area: phan.area }}
                  tien={tienPhan}
                >
                  {dongCua(phan.id).map((it) => (
                    <DongVatTu key={it.id} stt={++stt} it={it} />
                  ))}
                  {con.map((c) => (
                    <MucCon key={c.id} code={c.code} name={c.name}>
                      {dongCua(c.id).map((it) => (
                        <DongVatTu key={it.id} stt={++stt} it={it} />
                      ))}
                    </MucCon>
                  ))}
                </Phan>
              );
            })}

            <tr className="bg-slate-100 font-bold">
              <td colSpan={5} className="border border-slate-400 px-2 py-1.5 text-right">
                TỔNG CỘNG
              </td>
              <td className="border border-slate-400 px-2 py-1.5 text-right">
                {formatNumber(tong.sell)}
              </td>
            </tr>
          </tbody>
        </table>

        {bangChu && (
          <div className="giu-nguyen-khoi mt-2 text-[11.5px]">
            <span className="font-semibold">Bằng chữ: </span>
            <span className="italic">{bangChu}</span>
          </div>
        )}

        {quote.note && (
          <div className="giu-nguyen-khoi mt-5 text-[11px]">
            <div className="font-semibold">Ghi chú:</div>
            <div className="whitespace-pre-wrap">{quote.note}</div>
          </div>
        )}

        <PrintSignatures
          traiTieuDe="ĐẠI DIỆN BÊN MUA"
          phaiTieuDe="ĐẠI DIỆN BÊN BÁN"
          traiPhu={quote.recipient}
          diaDiem={quote.location ?? quote.project.location}
          ngay={quote.quoteDate}
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

function Phan({
  phan,
  tien,
  children,
}: {
  phan: { code: string; name: string; area: number | null };
  tien: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-slate-50 font-semibold">
        <td className="border border-slate-400 px-2 py-1 text-center">{phan.code}</td>
        <td className="border border-slate-400 px-2 py-1" colSpan={2}>
          {phan.name}
          {phan.area ? ` (${formatNumber(phan.area)} m²)` : ""}
        </td>
        <td className="border border-slate-400 px-2 py-1" colSpan={2} />
        <td className="border border-slate-400 px-2 py-1 text-right">{formatNumber(tien)}</td>
      </tr>
      {children}
    </>
  );
}

function MucCon({
  code,
  name,
  children,
}: {
  code: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="italic">
        <td className="border border-slate-400 px-2 py-1 text-center">{code}</td>
        <td className="border border-slate-400 px-2 py-1" colSpan={5}>
          {name}
        </td>
      </tr>
      {children}
    </>
  );
}

function DongVatTu({
  stt,
  it,
}: {
  stt: number;
  it: {
    name: string;
    spec: string | null;
    unit: string | null;
    qty: number | null;
    baseCost: number | null;
    sellPrice: number | null;
  };
}) {
  return (
    <tr>
      <td className="border border-slate-400 px-2 py-1 text-center">{stt}</td>
      <td className="border border-slate-400 px-2 py-1">
        {it.name}
        {it.spec ? <span className="text-slate-500"> — {it.spec}</span> : null}
      </td>
      <td className="border border-slate-400 px-2 py-1 text-center">{it.unit ?? ""}</td>
      <td className="border border-slate-400 px-2 py-1 text-right">{formatNumber(it.qty)}</td>
      <td className="border border-slate-400 px-2 py-1 text-right">{formatNumber(it.sellPrice)}</td>
      <td className="border border-slate-400 px-2 py-1 text-right">{formatNumber(lineSell(it))}</td>
    </tr>
  );
}
