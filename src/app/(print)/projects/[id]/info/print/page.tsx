import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatDate, formatNumber, formatVND } from "@/lib/utils";
import { CONTACT_ROLE_MAP, PROJECT_COMPONENT, PROJECT_STATUS_MAP } from "@/lib/constants";
import { danhSachMoc, tenMoc } from "@/lib/tienDo";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintHeader, PrintPage } from "@/components/print/PrintFrame";

/** Phiếu thông tin dự án — bản in của khối "Thông tin chung" + tiến độ trên trang dự án. */
export default async function ProjectInfoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireProjectView("project", id);

  const p = await db.project.findUnique({
    where: { id },
    include: {
      customer: true,
      khuVuc: { select: { ten: true } },
      suppliers: { include: { supplier: { select: { name: true } } } },
      milestones: true,
      contacts: { orderBy: { sortOrder: "asc" } },
      materialSpecs: { orderBy: { sortOrder: "asc" } },
      members: { include: { user: { select: { name: true } } } },
    },
  });
  if (!p) notFound();

  const dim =
    p.kK || p.kL || p.kH
      ? `${formatNumber(p.kK)} × ${formatNumber(p.kL)} × ${formatNumber(p.kH)}`
      : null;
  const nccTheoHangMuc = Object.fromEntries(p.suppliers.map((s) => [s.component, s.supplier.name]));
  const mocs = danhSachMoc(p.milestones);
  const vatTu = [
    p.mauSon && ["Sơn kết cấu", p.mauSon],
    p.mauTonMai && ["Tôn mái", p.mauTonMai],
    p.mauTonVach && ["Tôn vách", p.mauTonVach],
  ].filter(Boolean) as [string, string][];

  return (
    <>
      <PrintToolbar quayVe={`/projects/${id}`} nhan="Quay lại dự án" />

      <PrintPage>
        <PrintHeader />

        <div className="giu-nguyen-khoi text-center">
          <h1 className="text-xl font-bold uppercase">Phiếu thông tin dự án</h1>
          <div className="mt-1 text-[11px]">
            {p.code} — {p.name}
          </div>
          <div className="mt-0.5 text-[10.5px] italic text-slate-600">
            In ngày {formatDate(new Date())}
          </div>
        </div>

        <TieuDe>1. Thông tin công trình</TieuDe>
        <BangKv
          dong={[
            ["Mã dự án", p.code],
            ["Tên công trình", p.name],
            ["Loại công trình", p.buildingType],
            ["Trạng thái", PROJECT_STATUS_MAP[p.status]?.label ?? p.status],
            ["Địa điểm", p.location],
            ["Khu vực", p.khuVuc?.ten],
            ["Kích thước (K×L×H)", dim],
            ["Diện tích", p.area ? `${formatNumber(p.area)} m²` : null],
            // Giá bán theo cùng RBAC với số liệu tiền ở các trang khác.
            ["Giá bán", can(session.role, "profit", "view") && p.salePrice ? formatVND(p.salePrice) : null],
            ["Ngày bắt đầu", p.startDate ? formatDate(p.startDate) : null],
            ["Ngày hoàn thành", p.endDate ? formatDate(p.endDate) : null],
            ["Ghi chú", p.note],
          ]}
        />

        <TieuDe>2. Chủ đầu tư</TieuDe>
        <BangKv
          dong={[
            ["Chủ đầu tư", p.customer?.name],
            ["Địa chỉ", p.customer?.address],
            ["Người liên hệ", p.customer?.contactPerson],
            ["Điện thoại", p.customer?.phone],
          ]}
        />

        {p.contacts.length > 0 && (
          <>
            <TieuDe>3. Người liên hệ dự án</TieuDe>
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-slate-100">
                  <Th className="w-8 text-center">TT</Th>
                  <Th>Họ tên</Th>
                  <Th className="w-28">Vai trò</Th>
                  <Th className="w-28">Điện thoại</Th>
                  <Th>Email</Th>
                  <Th>Ghi chú</Th>
                </tr>
              </thead>
              <tbody>
                {p.contacts.map((c, i) => (
                  <tr key={c.id}>
                    <Td className="text-center">{i + 1}</Td>
                    <Td>{c.name}</Td>
                    <Td>{c.role ? (CONTACT_ROLE_MAP[c.role]?.label ?? c.role) : ""}</Td>
                    <Td>{c.phone ?? ""}</Td>
                    <Td>{c.email ?? ""}</Td>
                    <Td>{c.note ?? ""}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <TieuDe>4. Nhà cung cấp theo hạng mục</TieuDe>
        <BangKv dong={PROJECT_COMPONENT.map((c) => [c.label, nccTheoHangMuc[c.value] ?? "—"])} />

        {(vatTu.length > 0 || p.materialSpecs.length > 0 || p.ghiChuVatTu) && (
          <>
            <TieuDe>5. Vật tư</TieuDe>
            {vatTu.length > 0 && <BangKv dong={vatTu} />}
            {p.materialSpecs.length > 0 && (
              <table className="mt-2 w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100">
                    <Th className="w-8 text-center">TT</Th>
                    <Th>Vật tư</Th>
                    <Th>Quy cách</Th>
                    <Th className="w-32">Xuất xứ</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.materialSpecs.map((m, i) => (
                    <tr key={m.id}>
                      <Td className="text-center">{i + 1}</Td>
                      <Td>{m.name}</Td>
                      <Td>{m.spec ?? ""}</Td>
                      <Td>{m.origin ?? ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {p.ghiChuVatTu && (
              <div className="mt-2 whitespace-pre-wrap text-[11px]">
                <span className="font-semibold">Ghi chú vật tư: </span>
                {p.ghiChuVatTu}
              </div>
            )}
          </>
        )}

        <TieuDe>6. Tiến độ thực hiện</TieuDe>
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-slate-100">
              <Th className="w-8 text-center">TT</Th>
              <Th>Mốc</Th>
              <Th className="w-24 text-center">Kế hoạch</Th>
              <Th className="w-24 text-center">Thực tế</Th>
              <Th className="w-20 text-center">Trạng thái</Th>
              <Th>Ghi chú</Th>
            </tr>
          </thead>
          <tbody>
            {mocs.map(({ type, row }, i) => (
              <tr key={type}>
                <Td className="text-center">{i + 1}</Td>
                <Td>{tenMoc(row ?? { type })}</Td>
                <Td className="text-center">{row?.planDate ? formatDate(row.planDate) : ""}</Td>
                <Td className="text-center">{row?.actualDate ? formatDate(row.actualDate) : ""}</Td>
                <Td className="text-center">{row?.done ? "Xong" : ""}</Td>
                <Td>{row?.note ?? ""}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        {p.members.length > 0 && (
          <div className="giu-nguyen-khoi mt-4 text-[11px]">
            <span className="font-semibold">Thành viên dự án: </span>
            {p.members.map((m) => m.user.name).join(", ")}
          </div>
        )}
      </PrintPage>
    </>
  );
}

function TieuDe({ children }: { children: React.ReactNode }) {
  return <h2 className="giu-nguyen-khoi mb-1.5 mt-5 text-[12.5px] font-bold uppercase">{children}</h2>;
}

function BangKv({ dong }: { dong: (readonly [string, string | null | undefined])[] }) {
  const co = dong.filter(([, v]) => v);
  if (co.length === 0) return <div className="text-[11px] italic text-slate-500">Chưa có thông tin.</div>;
  return (
    <table className="w-full border-collapse text-[11px]">
      <tbody>
        {co.map(([k, v]) => (
          <tr key={k}>
            <td className="w-44 border border-slate-400 bg-slate-50 px-2 py-1 font-semibold">{k}</td>
            <td className="whitespace-pre-wrap border border-slate-400 px-2 py-1">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`border border-slate-400 px-2 py-1.5 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-slate-400 px-2 py-1 ${className}`}>{children}</td>;
}
