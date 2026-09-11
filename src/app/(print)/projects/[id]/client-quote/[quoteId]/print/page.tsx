import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { congTy } from "@/lib/company";
import {
  computeClientQuoteTotals,
  lineAmount,
  partTotals,
  sumStageDays,
} from "@/lib/clientQuote";
import { docTienVietNam } from "@/lib/money-words";
import { formatNumber, formatQty } from "@/lib/utils";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintHeader, PrintPage, dongNgayThang } from "@/components/print/PrintFrame";

export default async function ClientQuotePrintPage({
  params,
}: {
  params: Promise<{ id: string; quoteId: string }>;
}) {
  const { id, quoteId } = await params;
  await requireProjectView("quote", id);

  const quote = await db.clientQuote.findUnique({
    where: { id: quoteId },
    include: {
      project: { select: { id: true, code: true, name: true, location: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      specs: { orderBy: { sortOrder: "asc" } },
      stages: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { sortOrder: "asc" } },
    },
  });
  // Kiểm quyền ở trên theo `id` trên URL, nên phải chắc báo giá này đúng là của dự án
  // đó — nếu không, đổi quoteId trên thanh địa chỉ là đọc được báo giá dự án khác.
  if (!quote || quote.projectId !== id) notFound();

  const c = congTy();
  const tong = computeClientQuoteTotals(quote.lines, quote.vatPercent);
  const tienPhan = partTotals(quote.lines);
  const soNgayThiCong = sumStageDays(quote.stages);

  // Gom dòng theo phần, giữ nguyên thứ tự xuất hiện đầu tiên của mỗi phần.
  const phans: { code: string; name: string; lines: typeof quote.lines }[] = [];
  for (const l of quote.lines) {
    let p = phans.find((x) => x.code === l.partCode);
    if (!p) {
      p = { code: l.partCode, name: l.partName, lines: [] };
      phans.push(p);
    }
    p.lines.push(l);
  }

  const nhomA = quote.specs.filter((s) => s.groupCode === "A");
  const nhomB = quote.specs.filter((s) => s.groupCode === "B");

  return (
    <>
      <PrintToolbar quayVe={`/projects/${id}/client-quote`} nhan="Quay lại báo giá" />

      <PrintPage>
        {/* ===================== TRANG 1 ===================== */}
        <PrintHeader />

        <div className="giu-nguyen-khoi text-center">
          <h1 className="text-xl font-bold uppercase">Báo giá công trình</h1>
        </div>

        <div className="mt-2 text-right text-[11px] italic">
          {dongNgayThang(quote.location ?? quote.project.location, quote.quoteDate)}
        </div>

        <dl className="giu-nguyen-khoi mt-4 space-y-1 text-[11.5px]">
          <Dong nhan="Kính gửi" giaTri={quote.recipient} dam />
          <Dong nhan="Dự án" giaTri={`${quote.project.code} — ${quote.project.name}`} dam />
          <Dong nhan="Địa điểm" giaTri={quote.location ?? quote.project.location} dam />
          <Dong nhan="SĐT" giaTri={quote.customerPhone} dam />
          <Dong nhan="Hạng mục" giaTri={quote.scope} dam />
        </dl>

        {(quote.salesName || quote.salesPhone || quote.salesEmail) && (
          <div className="giu-nguyen-khoi mt-4 text-[11.5px]">
            <div className="italic">- Mọi thông tin xin vui lòng liên hệ:</div>
            <dl className="mt-1 space-y-0.5 pl-16">
              <Dong nhan="Họ và tên" giaTri={quote.salesName} dam />
              <Dong nhan="SĐT" giaTri={quote.salesPhone} dam />
              <Dong nhan="Email" giaTri={quote.salesEmail} dam />
            </dl>
          </div>
        )}

        {quote.greeting && (
          <p className="mt-4 whitespace-pre-line text-[11.5px] leading-relaxed">
            {quote.greeting}
          </p>
        )}

        <MucTieuDe so="1" ten="Vật liệu áp dụng và thông số kỹ thuật của vật liệu" />
        <table className="mt-2 w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-green-50">
              <Th className="w-10 text-center">STT</Th>
              <Th>Nội dung</Th>
              <Th className="w-36 text-center">Thông số kỹ thuật</Th>
              <Th className="w-48">Ghi chú và xuất xứ</Th>
            </tr>
          </thead>
          <tbody>
            <NhomVatLieu ma="A" ten="Vật liệu kết cấu thép" rows={nhomA} />
            <NhomVatLieu ma="B" ten="Vật liệu tôn lợp và bao che" rows={nhomB} />
            {quote.specs.length === 0 && (
              <tr>
                <Td colSpan={4} className="py-4 text-center italic text-slate-500">
                  Chưa có dòng vật liệu nào.
                </Td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ===================== TRANG 2 ===================== */}
        <div className="sang-trang-moi">
          <MucTieuDe so="2" ten="Báo giá" />
          <table className="mt-2 w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-green-50">
                <Th className="w-10 text-center">STT</Th>
                <Th>Nội dung công việc</Th>
                <Th className="w-14 text-center">Đơn vị</Th>
                <Th className="w-20 text-right">Tổng khối lượng</Th>
                <Th className="w-24 text-right">Đơn giá</Th>
                <Th className="w-28 text-right">Thành tiền (VND)</Th>
                <Th className="w-24">Ghi chú/ Quy cách</Th>
              </tr>
            </thead>
            <tbody>
              {phans.map((phan) => (
                <PhanGroup key={phan.code}>
                  <tr className="bg-slate-50 font-bold">
                    <Td className="text-center">{phan.code}</Td>
                    <Td colSpan={4}>{phan.name}</Td>
                    <Td className="text-right text-blue-700">
                      {formatNumber(tienPhan.get(phan.code) ?? 0)}
                    </Td>
                    <Td />
                  </tr>
                  {phan.lines.map((l) => (
                    <tr key={l.id}>
                      <Td className="text-center">{l.code ?? ""}</Td>
                      <Td>
                        {l.name}
                        {l.detail && (
                          <div className="whitespace-pre-line">{l.detail}</div>
                        )}
                      </Td>
                      <Td className="text-center">{l.unit ?? ""}</Td>
                      <Td className="text-right">{formatQty(l.qty)}</Td>
                      <Td className="text-right">{formatNumber(l.unitPrice)}</Td>
                      <Td className="text-right">{formatNumber(lineAmount(l))}</Td>
                      <Td>{l.note ?? ""}</Td>
                    </tr>
                  ))}
                </PhanGroup>
              ))}
              {quote.lines.length === 0 && (
                <tr>
                  <Td colSpan={7} className="py-4 text-center italic text-slate-500">
                    Chưa có hạng mục nào.
                  </Td>
                </tr>
              )}

              <DongTong nhan="Cộng trước thuế" tien={tong.beforeVat} />
              <DongTong nhan={`Thuế VAT ${quote.vatPercent ?? 0}%`} tien={tong.vat} />
              <DongTong nhan="Tổng giá trị sau thuế" tien={tong.withVat} dam />
            </tbody>
          </table>

          <div className="giu-nguyen-khoi mt-2 text-center text-[11.5px] font-semibold italic">
            {docTienVietNam(tong.withVat)}
          </div>
        </div>

        {/* ===================== TRANG 3 ===================== */}
        <div className="sang-trang-moi">
          <div className="text-[11.5px] font-bold">Ghi chú:</div>
          <table className="mt-2 w-full border-collapse text-[10.5px]">
            <tbody>
              <GhiChu so={1} noiDung="Tải trọng tính toán">
                <BangCon
                  rows={[
                    ["+ Hoạt tải mái:", quote.loadRoof, "kg/m2"],
                    ["+ Tải treo:", quote.loadHanging, "kg/m2"],
                    ["+ Tải sàn:", quote.loadFloor, "kg/m2"],
                  ]}
                />
              </GhiChu>
              <GhiChu so={2} noiDung={quote.colorNote} />
              <GhiChu so={3} noiDung={quote.volumeNote} />
              <GhiChu
                so={4}
                noiDung={`- Thời gian thi công: ${soNgayThiCong} ngày kể từ khi hợp đồng có hiệu lực`}
              >
                <BangCon
                  rows={quote.stages.map((st) => [`+ ${st.name}`, st.days, "ngày"])}
                />
              </GhiChu>
              <GhiChu
                so={5}
                noiDung={`- Thời gian bảo hành: ${quote.warrantyMonths ?? "—"} tháng kể từ ngày công trình nghiệm thu`}
              />
              <GhiChu
                so={6}
                noiDung={`- Bảo trì phần kết cấu thép: ${quote.maintenanceMonths ?? "—"} tháng kể từ ngày công trình nghiệm thu`}
              />
              <GhiChu so={7} noiDung={`- Hiệu lực báo giá: ${quote.validDays ?? "—"} ngày`} />
              <GhiChu so={8} noiDung="- Tiến độ thanh toán: 100% GTHĐ">
                <table className="w-full border-collapse">
                  <tbody>
                    {quote.payments.map((p) => (
                      <tr key={p.id}>
                        <Td className="italic">+ {p.label}</Td>
                        <Td className="w-14 text-center font-semibold">
                          {p.percent != null ? `${formatNumber(p.percent)}%` : ""}
                        </Td>
                        <Td className="w-48">
                          {[p.basis, p.note].filter(Boolean).join(", ")}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GhiChu>
              <GhiChu so={9} noiDung={quote.excludeNote} />
            </tbody>
          </table>

          {quote.closing && (
            <p className="giu-nguyen-khoi mt-6 text-center text-[11.5px] font-bold">
              {quote.closing}
            </p>
          )}

          <div className="giu-nguyen-khoi mt-10 text-center text-[10px] italic text-slate-400">
            _{c.ten}_
          </div>
        </div>
      </PrintPage>
    </>
  );
}

function PhanGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Dong({
  nhan,
  giaTri,
  dam,
}: {
  nhan: string;
  giaTri: string | null;
  dam?: boolean;
}) {
  if (!giaTri) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 italic">{nhan}:</dt>
      <dd className={`min-w-0 ${dam ? "font-bold text-blue-700" : ""}`}>{giaTri}</dd>
    </div>
  );
}

function MucTieuDe({ so, ten }: { so: string; ten: string }) {
  return (
    <div className="giu-nguyen-khoi mt-5 flex gap-2 text-[11.5px] font-bold">
      <span>{so}</span>
      <span>{ten}</span>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`border border-slate-400 px-2 py-1.5 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`border border-slate-400 px-2 py-1 align-top ${className}`}>
      {children}
    </td>
  );
}

function NhomVatLieu({
  ma,
  ten,
  rows,
}: {
  ma: string;
  ten: string;
  rows: { id: string; name: string; spec: string | null; origin: string | null }[];
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <tr className="bg-green-50 font-bold">
        <Td className="text-center">{ma}</Td>
        <Td colSpan={3}>{ten}</Td>
      </tr>
      {rows.map((r, i) => (
        <tr key={r.id}>
          <Td className="text-center">{i + 1}</Td>
          <Td className="italic">{r.name}</Td>
          <Td className="text-center italic">{r.spec ?? ""}</Td>
          <Td className="italic">{r.origin ?? ""}</Td>
        </tr>
      ))}
    </>
  );
}

function DongTong({ nhan, tien, dam }: { nhan: string; tien: number; dam?: boolean }) {
  return (
    <tr className={dam ? "font-bold" : ""}>
      <Td colSpan={5} className="text-right italic">
        {nhan}
      </Td>
      <Td className="text-right text-blue-700">{formatNumber(tien)}</Td>
      <Td />
    </tr>
  );
}

function GhiChu({
  so,
  noiDung,
  children,
}: {
  so: number;
  noiDung?: string | null;
  children?: React.ReactNode;
}) {
  if (!noiDung && !children) return null;
  return (
    <tr>
      <Td className="w-8 text-center">{so}</Td>
      <Td>
        {noiDung && <div className="whitespace-pre-line">{noiDung}</div>}
        {children}
      </Td>
    </tr>
  );
}

/** Bảng con hai cột số + đơn vị, dùng cho tải trọng và tiến độ thi công. */
function BangCon({ rows }: { rows: [string, number | null, string][] }) {
  if (rows.length === 0) return null;
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([ten, so, dv]) => (
          <tr key={ten}>
            <Td className="italic">{ten}</Td>
            <Td className="w-16 text-center font-semibold">{formatNumber(so)}</Td>
            <Td className="w-24 italic">{dv}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
