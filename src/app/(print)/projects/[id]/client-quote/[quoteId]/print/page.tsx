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

  // Mô tả chung của hạng mục in dưới tên mọi đầu việc; dòng nào có mô tả riêng
  // thì mô tả riêng đè lên.
  const moTaCua = (l: { detail: string | null }) => l.detail ?? quote.lineDetail;

  // Số thứ tự tự đánh, chạy liên tục qua các phần — đúng như báo giá mẫu (01…05).
  let stt = 0;

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

        {/* Bảng giá đứng trước bảng vật liệu: người nhận báo giá mở ra là thấy ngay
            con số, phần thông số kỹ thuật là tra cứu nên để sau. */}
        <MucTieuDe so="1" ten="Báo giá" />
        {/* Chia cột bằng colgroup + table-fixed thay vì để trình duyệt tự co: cột nội
            dung chứa cả tên đầu việc lẫn các gạch đầu dòng mô tả nên phải rộng hẳn,
            còn mấy cột số chỉ cần vừa đủ con số dài nhất ("695.000.000"). */}
        <table className="mt-2 w-full table-fixed border-collapse text-[10.5px]">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[41%]" />
            {/* Đủ rộng để chữ "Đơn vị" nằm gọn một dòng, không gãy đôi tiêu đề. */}
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            {/* Đủ cho chữ "Quy cách" nằm gọn, không gãy làm ba dòng. */}
            <col className="w-[11%]" />
          </colgroup>
          <thead>
            <tr className="bg-green-50">
              <Th>STT</Th>
              <Th>Nội dung công việc</Th>
              <Th>Đơn vị</Th>
              <Th>Tổng khối lượng</Th>
              <Th>Đơn giá</Th>
              <Th>Thành tiền (VND)</Th>
              <Th>Ghi chú/ Quy cách</Th>
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
                    {/* STT tự đánh liên tục 01, 02… cho cả bảng; chỉ nhường chỗ khi
                        người lập cố ý nhập số riêng. */}
                    <Td className="text-center">{l.code ?? hai(++stt)}</Td>
                    {/* Ô nội dung dài nhiều dòng nên bám mép trên; các ô còn lại căn
                        giữa theo chiều cao hàng cho thẳng hàng với tên đầu việc. */}
                    <Td className="align-top">
                      {l.name}
                      {moTaCua(l) && (
                        <div className="whitespace-pre-line">{moTaCua(l)}</div>
                      )}
                    </Td>
                    <Td className="text-center">{l.unit ?? ""}</Td>
                    <Td className="text-right">{soHoacTrong(l.qty, formatQty)}</Td>
                    <Td className="text-right">{soHoacTrong(l.unitPrice, formatNumber)}</Td>
                    <Td className="text-right">{soHoacTrong(lineAmount(l), formatNumber)}</Td>
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

        {/* ===================== TRANG 2 ===================== */}
        <div className="sang-trang-moi">
          <MucTieuDe so="2" ten="Vật liệu áp dụng và thông số kỹ thuật của vật liệu" />
          <table className="mt-2 w-full table-fixed border-collapse text-[10.5px]">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[40%]" />
              <col className="w-[24%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead>
              <tr className="bg-green-50">
                <Th>STT</Th>
                <Th>Nội dung</Th>
                <Th>Thông số kỹ thuật</Th>
                <Th>Ghi chú và xuất xứ</Th>
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
        </div>

        {/* ===================== TRANG 3 ===================== */}
        <div className="sang-trang-moi">
          <div className="text-[11.5px] font-bold">Ghi chú:</div>
          <table className="mt-2 w-full border-collapse text-[10.5px]">
            <tbody>
              <GhiChu so={1} noiDung="Tải trọng tính toán">
                <DongPhu
                  rows={[
                    ["+ Hoạt tải mái", quote.loadRoof, "kg/m2"],
                    ["+ Tải treo", quote.loadHanging, "kg/m2"],
                    ["+ Tải sàn", quote.loadFloor, "kg/m2"],
                  ]}
                />
              </GhiChu>
              <GhiChu so={2} noiDung={quote.colorNote} />
              <GhiChu so={3} noiDung={quote.volumeNote} />
              <GhiChu
                so={4}
                noiDung={`- Thời gian thi công: ${soNgayThiCong} ngày kể từ khi hợp đồng có hiệu lực`}
              >
                <DongPhu
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
                <div className="mt-0.5 space-y-0.5 pl-4">
                  {quote.payments.map((p) => {
                    const canCu = [p.basis, p.note].filter(Boolean).join(", ");
                    return (
                      <div key={p.id} className="italic">
                        + {p.label}:{" "}
                        <span className="font-semibold not-italic">
                          {p.percent != null ? `${phanTram(p.percent)}%` : ""}
                        </span>
                        {canCu && ` — ${canCu}`}
                      </div>
                    );
                  })}
                </div>
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

/** Ô tiêu đề bảng — luôn căn giữa, kể cả cột dữ liệu bên dưới căn phải. */
function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`border border-slate-400 px-2 py-1.5 text-center font-semibold ${className}`}>
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
    <td colSpan={colSpan} className={`border border-slate-400 px-2 py-1 align-middle ${className}`}>
      {children}
    </td>
  );
}

/** Ô KHÔNG kẻ khung — dùng cho khối ghi chú cuối báo giá. */
function TdTron({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-2 py-1 align-top ${className}`}>
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
      <TdTron className="w-8 text-center">{so}</TdTron>
      <TdTron>
        {noiDung && <div className="whitespace-pre-line">{noiDung}</div>}
        {children}
      </TdTron>
    </tr>
  );
}

/**
 * Các dòng phụ trong ghi chú: "+ Hoạt tải mái: 10 kg/m2".
 *
 * Cố ý KHÔNG dùng bảng. Bản Excel phải tách cột nên con số bị đẩy ra tận mép phải,
 * cách chữ mô tả cả gang tay; ở đây là văn bản tự do nên cho số nằm ngay sau chữ
 * cho dễ đọc.
 */
function DongPhu({ rows }: { rows: [string, number | null, string][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-0.5 space-y-0.5 pl-4">
      {rows.map(([ten, so, dv]) => (
        <div key={ten} className="italic">
          {ten}: <span className="font-semibold not-italic">{formatNumber(so)}</span> {dv}
        </div>
      ))}
    </div>
  );
}

/** Số thứ tự hai chữ số như báo giá mẫu: 1 -> "01". */
function hai(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Ô số để TRỐNG khi chưa có giá trị.
 *
 * Hạng mục chưa điền đơn giá thì `lineAmount` ra 0; in số 0 ra báo giá gửi khách
 * trông như báo giá 0 đồng chứ không phải "chưa có giá". Để trống thì người đọc
 * hiểu ngay là còn thiếu.
 */
function soHoacTrong(v: number | null, dinhDang: (n: number | null) => string): string {
  if (v == null || v === 0) return "";
  return dinhDang(v);
}

/** Tỷ lệ phần trăm: bỏ số 0 thừa (50 -> "50") nhưng giữ số lẻ thật (33,33). */
const dinhDangPhanTram = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
function phanTram(v: number): string {
  return dinhDangPhanTram.format(v);
}
