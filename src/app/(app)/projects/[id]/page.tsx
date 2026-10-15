import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { AuditEntries, type AuditRow } from "@/components/audit/AuditEntries";
import { serverNow } from "@/lib/now";
import { can } from "@/lib/rbac";
import { formatVND, formatDate, formatNumber } from "@/lib/utils";
import { StatusChanger, SupplierAssigner } from "./ProjectDetail";
import { ProjectMembers, type MemberUser } from "./ProjectMembers";
import { Milestones, type MilestoneValue } from "./Milestones";
import { ProjectNotes } from "./Notes";
import { DocVersions } from "./DocVersions";
import { docVersionDb } from "@/lib/doc-versions";
import { ProjectPayments } from "./Payments";
import { paymentDb } from "@/lib/payments";
import { projectNoteDb, noteImageDb } from "@/lib/project-notes";
import { signedUrl } from "@/lib/storage";
import { computeProfit, formatPercent } from "@/lib/profit";
import { computeContractTotals } from "@/lib/contract";
import { docGiaTriGiaiDoan } from "@/lib/giaTriGiaiDoanDuAn";
import { BangGiaiDoan } from "@/components/BangGiaiDoan";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATUS_MAP, MILESTONE_TYPE, PO_CATEGORY_MAP, PO_STATUS_MAP } from "@/lib/constants";
import { Calculator, FileSignature, ShoppingCart, Wallet } from "lucide-react";
import { tinhChiSo, tinhCo } from "@/lib/projectHealth";
import { HealthBanner } from "./HealthBanner";
import { ProjectContacts } from "./ProjectContacts";
import { MaterialInfo } from "./MaterialInfo";
import { QcPanel, type QcMucView } from "./QcPanel";
import { QuyTrinhPanel, type TinBuoc } from "./QuyTrinhPanel";
import { napQuyTrinh, quyTrinhChoCo } from "@/lib/quyTrinhDb";
import type { SoSanhData } from "./QcSoSanhVatTu";
import { isStorageConfigured } from "@/lib/storage";
import { tomTatGiaiDoan } from "@/lib/qc";
import { MucDuAn, MucLuc, OThongTin } from "./MucDuAn";
import { MoMucTheoHash } from "./MoMucTheoHash";
import { SuaThongTinDuAn } from "./SuaThongTinDuAn";
import { salePriceFromContracts } from "@/lib/contract";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireProjectView("project", id);
  const canEdit = can(session.role, "project", "edit");

  // Guard phân quyền ở trên đã chạy xong; 5 truy vấn dưới đây độc lập nhau nên chạy
  // song song thay vì nối tiếp — trước đây trang này tốn ~5 round-trip tới DB.
  const [project, noteRows, docRows, paymentRows, suppliers, auditRows] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        customer: true,
        suppliers: { include: { supplier: true } },
        milestones: true,
        estimateItems: {
          select: {
            groupCode: true,
            designQty: true,
            actualQty: true,
            unitPrice: true,
            amount: true,
          },
        },
        contracts: {
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          include: { items: { select: { qty: true, unitPrice: true, amount: true } } },
        },
        purchaseOrders: {
          orderBy: [{ category: "asc" }, { createdAt: "asc" }],
          include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
        },
        costSummary: { select: { id: true, revenue: true, cost: true, profit: true } },
        contacts: { orderBy: { sortOrder: "asc" } },
        materialSpecs: { orderBy: { sortOrder: "asc" } },
        clientQuotes: {
          select: { id: true, quoteNo: true, title: true },
          orderBy: { createdAt: "desc" },
        },
        quotes: { select: { id: true, title: true }, orderBy: { createdAt: "desc" } },
        qcMuc: { select: { giaiDoan: true, ketQua: true } },
      },
    }),
    projectNoteDb.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    }),
    docVersionDb.findMany({
      where: { projectId: id },
      orderBy: [{ docType: "asc" }, { createdAt: "desc" }],
    }),
    paymentDb.findMany({
      where: { projectId: id },
      orderBy: [{ direction: "asc" }, { dueDate: "asc" }],
    }),
    db.supplier.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
    }),
    // Nhật ký thay đổi của riêng dự án này — nằm trong cùng lượt song song nên
    // không tốn thêm round-trip nào.
    //
    // CHỈ lấy khi người dùng được xem số liệu tiền: nhật ký chứa cả thay đổi giá bán,
    // giá trị hợp đồng, số tiền thanh toán — đúng những thứ RBAC che khỏi Kỹ thuật và
    // Vật tư. Hiện nó ra ở đây là lách chính cơ chế phân quyền.
    can(session.role, "profit", "view")
      ? db.auditLog.findMany({
          where: { projectId: id },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);
  if (!project) notFound();

  const canEditProgress = can(session.role, "progress", "edit");
  const canViewProfit = can(session.role, "profit", "view");
  const canViewContract = can(session.role, "contract", "view");
  const canViewPurchase = can(session.role, "purchase", "view");
  const canViewCost = can(session.role, "cost", "view");
  const canEditPayment = can(session.role, "cost", "edit");
  const canViewPayment = can(session.role, "debt", "view") || canEditPayment;
  const nowMs = serverNow();
  const quyTrinh = await napQuyTrinh(id);
  const healthInput = {
    milestones: project.milestones,
    payments: paymentRows,
    purchaseOrders: project.purchaseOrders,
    contracts: project.contracts,
    salePrice: project.salePrice,
    qc: project.qcMuc,
    quyTrinh: quyTrinhChoCo(quyTrinh),
  };
  const co = tinhCo(healthInput, nowMs, { anTien: !canViewPayment });
  const chiSo = tinhChiSo(healthInput);
  const profit = computeProfit(project.estimateItems, project.salePrice, project.area);
  const giaiDoan = await docGiaTriGiaiDoan(project.id);
  const milestoneMap: Record<string, MilestoneValue> = {};
  for (const m of project.milestones) {
    milestoneMap[m.type] = {
      planDate: m.planDate?.toISOString() ?? null,
      actualDate: m.actualDate?.toISOString() ?? null,
      done: m.done,
      note: m.note,
      durationDays: m.durationDays,
      overlapDays: m.overlapDays,
    };
  }
  // HĐ làm căn cứ tiến độ: HĐ đã ký ký muộn nhất, chưa có thì HĐ tạo sau cùng.
  const hdDaKy = project.contracts
    .filter((c) => c.status === "SIGNED")
    .sort((a, b) => (b.signDate?.getTime() ?? 0) - (a.signDate?.getTime() ?? 0));
  const hdCanCu = hdDaKy[0] ?? project.contracts[project.contracts.length - 1] ?? null;

  // ----- Quy trình dự án -----
  const [tinBuocRows, nguoiDungRows] = await Promise.all([
    db.traoDoi.findMany({
      where: { doiTuong: "BUOC", doiTuongId: { in: quyTrinh.map((b) => b.id) } },
      orderBy: { createdAt: "asc" },
      select: { doiTuongId: true, loai: true, noiDung: true, tacGiaTen: true, createdAt: true },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const tinBuoc: TinBuoc[] = tinBuocRows.map((t) => ({
    buocId: t.doiTuongId,
    loai: t.loai,
    noiDung: t.noiDung,
    tacGiaTen: t.tacGiaTen,
    createdAt: t.createdAt.toISOString(),
  }));

  // ----- QC theo giai đoạn -----
  const qcRows = await db.qcMuc.findMany({
    where: { projectId: id },
    orderBy: [{ giaiDoan: "asc" }, { thuTu: "asc" }],
    include: { lanKiem: { orderBy: { createdAt: "desc" }, include: { tep: true } } },
  });
  const qcTepKeys = qcRows.flatMap((m) => m.lanKiem.flatMap((l) => l.tep.map((t) => t.key)));
  const qcTepUrls = new Map(
    // Một tệp ký lỗi chỉ mất link của tệp đó, không làm hỏng cả trang dự án.
    await Promise.all(
      qcTepKeys.map(async (k) => [k, await signedUrl(k).catch(() => null)] as const)
    )
  );
  const qcMuc: QcMucView[] = qcRows.map((m) => ({
    id: m.id,
    giaiDoan: m.giaiDoan,
    noiDung: m.noiDung,
    boPhan: m.boPhan,
    nhom: m.nhom,
    loai: m.loai,
    tieuChi: m.tieuChi,
    ghiChuTc: (m.ghiChuTc ?? {}) as Record<string, string>,
    ketQua: m.ketQua,
    nguoiKiem: m.nguoiKiem,
    ngayKiem: m.ngayKiem?.toISOString() ?? null,
    ghiChu: m.ghiChu,
    lanKiem: m.lanKiem.map((l) => ({
      id: l.id,
      ketQua: l.ketQua,
      ghiChu: l.ghiChu,
      nguoiTen: l.nguoiTen,
      lienKet: l.lienKet,
      lienKetTen: l.lienKetTen,
      createdAt: l.createdAt.toISOString(),
      tep: l.tep.map((t) => ({ ten: t.ten, url: qcTepUrls.get(t.key) ?? null })),
    })),
  }));
  // Việc / hồ sơ trong mẫu mà dự án (đã có QC) chưa có — để hiện nút bổ sung.
  let soViecHoSoThieu = 0;
  if (qcRows.length > 0) {
    const da = new Set(qcRows.map((m) => `${m.giaiDoan}|${m.noiDung}`));
    soViecHoSoThieu = (
      await db.qcMau.findMany({
        where: { active: true, nhom: { in: ["VIEC", "HO_SO"] } },
        select: { giaiDoan: true, noiDung: true },
      })
    ).filter((m) => !da.has(`${m.giaiDoan}|${m.noiDung}`)).length;
  }
  // Bảng so sánh chỉ cần khi có mục đối chiếu vật tư. Không lấy đơn giá/thành tiền.
  let soSanh: SoSanhData | null = null;
  if (qcRows.some((m) => m.loai === "DOI_CHIEU_VAT_TU")) {
    const poItems = await db.purchaseOrderItem.findMany({
      where: { order: { projectId: id } },
      orderBy: [{ orderId: "asc" }, { sortOrder: "asc" }],
      select: {
        orderId: true,
        name: true,
        groupName: true,
        unit: true,
        qty: true,
        weight: true,
        note: true,
        order: { select: { orderNo: true, category: true, supplier: { select: { name: true } } } },
      },
    });
    const orders = new Map<string, SoSanhData["orders"][number]>();
    for (const it of poItems) {
      let o = orders.get(it.orderId);
      if (!o) {
        o = {
          id: it.orderId,
          tieuDe: [
            PO_CATEGORY_MAP[it.order.category]?.label ?? it.order.category,
            it.order.orderNo,
            it.order.supplier?.name,
          ]
            .filter(Boolean)
            .join(" · "),
          rows: [],
        };
        orders.set(it.orderId, o);
      }
      o.rows.push({
        name: it.name,
        groupName: it.groupName,
        unit: it.unit,
        qty: it.qty,
        weight: it.weight,
        note: it.note,
      });
    }
    soSanh = {
      info: {
        mauSon: project.mauSon,
        mauTonMai: project.mauTonMai,
        mauTonVach: project.mauTonVach,
        ghiChuVatTu: project.ghiChuVatTu,
      },
      specs: project.materialSpecs.map(({ tag, name, spec, origin }) => ({ tag, name, spec, origin })),
      orders: [...orders.values()],
    };
  }

  const noteImgs = noteRows.length
    ? await noteImageDb.findMany({ where: { noteId: { in: noteRows.map((n) => n.id) } } })
    : [];
  // Gọi signedUrl song song thay vì tuần tự từng ảnh (mỗi lần là 1 API call Storage).
  const imgUrlByNote = new Map<string, string[]>();
  const noteImgUrls = await Promise.all(noteImgs.map((im) => signedUrl(im.key)));
  noteImgs.forEach((im, i) => {
    const url = noteImgUrls[i];
    if (!url) return;
    const list = imgUrlByNote.get(im.noteId) ?? [];
    list.push(url);
    imgUrlByNote.set(im.noteId, list);
  });
  const notes = noteRows.map((n) => ({
    id: n.id,
    content: n.content,
    authorName: n.authorName,
    createdAt: n.createdAt.toISOString(),
    images: imgUrlByNote.get(n.id) ?? [],
  }));

  const docs = docRows.map((d) => ({
    id: d.id,
    docType: d.docType,
    version: d.version,
    issuedAt: d.issuedAt?.toISOString() ?? null,
    status: d.status,
    note: d.note,
    authorName: d.authorName,
    createdAt: d.createdAt.toISOString(),
  }));
  const canEditTypes = [
    can(session.role, "quote", "edit") ? "BAO_GIA" : null,
    can(session.role, "contract", "edit") ? "HOP_DONG" : null,
    can(session.role, "progress", "edit") ? "SHOP_DRAWING" : null,
  ].filter((v): v is string => v !== null);

  const payments = paymentRows.map((x) => ({
    id: x.id,
    direction: x.direction,
    counterpart: x.counterpart,
    name: x.name,
    amount: x.amount,
    dueDate: x.dueDate?.toISOString() ?? null,
    paidDate: x.paidDate?.toISOString() ?? null,
    paidAmount: x.paidAmount,
    note: x.note,
  }));
  const auditLog: AuditRow[] = auditRows.map((r) => ({
    id: r.id,
    actorName: r.actorName,
    actorRole: r.actorRole,
    entity: r.entity,
    entityId: r.entityId,
    entityLabel: r.entityLabel,
    projectId: r.projectId,
    action: r.action,
    changes: r.changes,
    createdAt: r.createdAt.toISOString(),
  }));

  const assigned: Record<string, { id: string; name: string }> = {};
  for (const link of project.suppliers) {
    assigned[link.component] = { id: link.supplier.id, name: link.supplier.name };
  }

  let memberData: { members: MemberUser[]; allUsers: MemberUser[] } | null = null;
  if (session.role === "ADMIN") {
    const [memberRows, users] = await Promise.all([
      db.projectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, role: true } } },
      }),
      db.user.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);
    memberData = {
      members: memberRows.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        role: m.user.role as MemberUser["role"],
      })),
      allUsers: users.map((u) => ({ id: u.id, name: u.name, role: u.role as MemberUser["role"] })),
    };
  }

  const dim =
    project.kK || project.kL || project.kH
      ? `${formatNumber(project.kK)} × ${formatNumber(project.kL)} × ${formatNumber(project.kH)}`
      : "—";

  // Danh sách chọn cho form "Sửa thông tin" — chỉ nạp khi người xem được sửa.
  const [dsCdt, dsKhuVuc] = canEdit
    ? await Promise.all([
        db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        db.khuVuc.findMany({
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
          select: { id: true, ma: true, ten: true },
        }),
      ])
    : [[], []];

  // Tài liệu đang có ngay trong app — chọn nhanh làm bằng chứng cho mục "Hồ sơ cần có"
  // thay vì xuất file rồi đính kèm (bản đính kèm sẽ cũ đi khi dữ liệu trong app đổi).
  const goc = `/projects/${project.id}`;
  const taiLieuApp = [
    ...(project.clientQuotes.length > 0
      ? [
          {
            nhan: `Báo giá gửi khách${project.clientQuotes[0].quoteNo ? ` ${project.clientQuotes[0].quoteNo}` : ""}${
              project.clientQuotes.length > 1 ? ` (${project.clientQuotes.length} bản)` : ""
            }`,
            href: `${goc}/client-quote`,
          },
        ]
      : []),
    ...(project.quotes.length > 0
      ? [{ nhan: `Dự toán chào giá — ${project.quotes[0].title}`, href: `${goc}/quote` }]
      : []),
    ...(project.estimateItems.length > 0
      ? [{ nhan: `Dự toán thi công (${formatVND(profit.totalCost)})`, href: `${goc}/estimate` }]
      : []),
    ...(project.contracts.length > 0
      ? [
          {
            nhan: `Hợp đồng ${project.contracts
              .map((c) => c.contractNo ?? c.subject ?? "")
              .filter(Boolean)
              .join(", ")}`.trim(),
            href: `${goc}/contract`,
          },
        ]
      : []),
  ];

  const qcTom = tomTatGiaiDoan(qcMuc);
  const mocXong = project.milestones.filter((m) => m.done).length;
  // Thứ tự mục = thứ tự đánh số; mục không có quyền xem thì bỏ, số tự dồn lên.
  const cacMuc = [
    { id: "quy-trinh", tieuDe: "Quy trình" },
    { id: "tong-quan", tieuDe: "Thông tin chung" },
    { id: "tien-do", tieuDe: "Tiến độ" },
    { id: "qc", tieuDe: "QC giai đoạn", canChuY: qcTom.khongDat > 0 },
    { id: "vat-tu", tieuDe: "Vật tư & NCC" },
    { id: "tai-chinh", tieuDe: "Dự toán & tài chính" },
    canViewPurchase && { id: "mua-hang", tieuDe: "Đơn hàng" },
    { id: "ho-so", tieuDe: "Hồ sơ" },
    { id: "nhat-ky", tieuDe: "Nhật ký" },
    canViewProfit && { id: "lich-su", tieuDe: "Lịch sử" },
  ]
    .filter((m): m is { id: string; tieuDe: string; canChuY?: boolean } => !!m)
    .map((m, i) => ({ ...m, so: i + 1 }));
  const so = (id: string) => cacMuc.find((m) => m.id === id)?.so ?? 0;
  const nutMo = (href: string, icon: React.ReactNode, text: string) => (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
    >
      {icon} {text}
    </Link>
  );

  return (
    <div className="space-y-4">
      <MoMucTheoHash />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              <span className="font-mono">{project.code}</span> — {project.name}
            </h1>
            <p className="text-sm text-slate-500">
              {project.buildingType || "Công trình"} · {project.location || "—"}
            </p>
          </div>
        </div>
        <StatusChanger projectId={project.id} status={project.status} canEdit={canEdit} />
      </div>

      <HealthBanner muc={co.muc} lyDo={co.lyDo} {...chiSo} hienTien={canViewPayment} />

      <MucLuc muc={cacMuc} />

      <MucDuAn id="quy-trinh" so={so("quy-trinh")} tieuDe="Quy trình dự án">
        <QuyTrinhPanel
          projectId={project.id}
          buoc={quyTrinh}
          tin={tinBuoc}
          nguoiDung={nguoiDungRows}
          toiLa={session.userId}
          vaiTro={session.role}
          canEdit={canEdit}
          nowMs={nowMs}
        />
      </MucDuAn>

      <MucDuAn
        id="tong-quan"
        so={so("tong-quan")}
        tieuDe="Thông tin chung"
        tomTat={`${project.customer?.name ?? "Chưa có CĐT"} · ${project.contacts.length} người liên hệ`}
      >
        {canEdit && (
          <div className="-mt-1 mb-3 flex justify-end">
            <SuaThongTinDuAn
              duAn={{
                id: project.id,
                code: project.code,
                name: project.name,
                buildingType: project.buildingType,
                status: project.status,
                location: project.location,
                khuVucId: project.khuVucId,
                customerId: project.customerId,
                startDate: project.startDate?.toISOString() ?? null,
                endDate: project.endDate?.toISOString() ?? null,
                kK: project.kK,
                kL: project.kL,
                kH: project.kH,
                area: project.area,
                salePrice: project.salePrice,
                note: project.note,
              }}
              customers={dsCdt}
              khuVucs={dsKhuVuc}
              giaBanKhoa={salePriceFromContracts(project.contracts).locked}
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Công trình
            </h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <OThongTin nhan="Vị trí">{project.location ?? "—"}</OThongTin>
              <OThongTin nhan="Kích thước (K×L×H)">{dim}</OThongTin>
              <OThongTin nhan="Diện tích">
                {project.area ? `${formatNumber(project.area)} m²` : "—"}
              </OThongTin>
              <OThongTin nhan="Giá bán">
                {project.salePrice ? formatVND(project.salePrice) : "—"}
              </OThongTin>
              <OThongTin nhan="Ngày bắt đầu">{formatDate(project.startDate)}</OThongTin>
              <OThongTin nhan="Ngày hoàn thành">{formatDate(project.endDate)}</OThongTin>
              {project.note && (
                <OThongTin nhan="Ghi chú" rong>
                  <span className="font-normal text-slate-700">{project.note}</span>
                </OThongTin>
              )}
            </dl>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Chủ đầu tư & người liên hệ
            </h4>
            <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <OThongTin nhan="Chủ đầu tư">{project.customer?.name ?? "—"}</OThongTin>
              <OThongTin nhan="Địa chỉ">{project.customer?.address ?? "—"}</OThongTin>
              {project.customer?.contactPerson && (
                <OThongTin nhan="Liên hệ (hồ sơ CĐT)" rong>
                  {[project.customer.contactPerson, project.customer.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </OThongTin>
              )}
            </dl>
            <ProjectContacts
              projectId={project.id}
              contacts={project.contacts.map(({ id, name, role, phone, email, note }) => ({
                id,
                name,
                role,
                phone,
                email,
                note,
              }))}
              canEdit={canEdit}
            />
          </div>
        </div>
        {memberData && (
          <div className="mt-4">
            <ProjectMembers
              projectId={project.id}
              members={memberData.members}
              allUsers={memberData.allUsers}
            />
          </div>
        )}
      </MucDuAn>

      <MucDuAn
        id="tien-do"
        so={so("tien-do")}
        tieuDe="Tiến độ thực hiện"
        tomTat={`${mocXong}/${MILESTONE_TYPE.length} mốc xong`}
      >
        <Milestones
          projectId={project.id}
          milestones={milestoneMap}
          canEdit={canEditProgress}
          canEditContract={can(session.role, "contract", "edit")}
          hopDong={
            hdCanCu && {
              id: hdCanCu.id,
              ten: hdCanCu.contractNo ?? hdCanCu.subject ?? "Hợp đồng",
              daKy: hdCanCu.status === "SIGNED",
              signDate: hdCanCu.signDate?.toISOString() ?? null,
              effectiveDate: hdCanCu.effectiveDate?.toISOString() ?? null,
              durationDays: hdCanCu.durationDays,
            }
          }
          nowMs={nowMs}
        />
      </MucDuAn>

      <MucDuAn
        id="qc"
        so={so("qc")}
        tieuDe="QC theo giai đoạn"
        mo={false}
        tomTat={
          qcMuc.length === 0 ? (
            "Chưa tạo"
          ) : (
            <>
              xong {qcTom.dat}/{qcTom.tong}
              {qcTom.khongDat > 0 && (
                <span className="ml-2 font-medium text-red-600">
                  {qcTom.khongDat} không đạt
                </span>
              )}
            </>
          )
        }
      >
        <QcPanel
          projectId={project.id}
          muc={qcMuc}
          role={session.role}
          canEdit={canEdit}
          coKho={isStorageConfigured()}
          soSanh={soSanh}
          soViecHoSoThieu={soViecHoSoThieu}
          taiLieuApp={taiLieuApp}
        />
      </MucDuAn>

      <MucDuAn
        id="vat-tu"
        so={so("vat-tu")}
        tieuDe="Vật tư & nhà cung cấp"
        tomTat={`${project.materialSpecs.length} quy cách`}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
          <MaterialInfo
            projectId={project.id}
            info={{
              mauSon: project.mauSon,
              mauTonMai: project.mauTonMai,
              mauTonVach: project.mauTonVach,
              ghiChuVatTu: project.ghiChuVatTu,
            }}
            specs={project.materialSpecs.map(({ id, tag, name, spec, origin }) => ({
              id,
              tag,
              name,
              spec,
              origin,
            }))}
            orders={
              canViewPurchase
                ? project.purchaseOrders.map((o) => ({
                    id: o.id,
                    category: o.category,
                    status: o.status,
                    supplierName: o.supplier?.name ?? null,
                    value: canViewProfit ? o.value : null,
                    totalWeight: o.totalWeight,
                    expectedDate: o.expectedDate?.toISOString() ?? null,
                    receivedDate: o.receivedDate?.toISOString() ?? null,
                  }))
                : []
            }
            canEdit={canEdit}
            coBaoGia={project.clientQuotes.length > 0}
            nowMs={nowMs}
          />
          <div className="lg:border-l lg:border-slate-100 lg:pl-6">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nhà cung cấp theo hạng mục
            </h4>
            <SupplierAssigner
              projectId={project.id}
              assigned={assigned}
              suppliers={suppliers}
              canEdit={canEdit}
            />
          </div>
        </div>
      </MucDuAn>

      <MucDuAn
        id="tai-chinh"
        so={so("tai-chinh")}
        tieuDe="Dự toán & tài chính"
        hanhDong={nutMo(
          `/projects/${project.id}/estimate`,
          <Calculator className="h-3.5 w-3.5" />,
          "Mở dự toán",
        )}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Summary label="Tổng chi phí" value={formatVND(profit.totalCost)} />
            {canViewProfit && <Summary label="Giá bán" value={formatVND(profit.salePrice)} />}
            {canViewProfit && (
              <Summary
                label="Lợi nhuận"
                value={formatVND(profit.profit)}
                valueClass={profit.profit >= 0 ? "text-green-600" : "text-red-600"}
              />
            )}
            {canViewProfit && <Summary label="Biên LN" value={formatPercent(profit.margin)} />}
            {!canViewProfit && (
              <Summary
                label="CP / m²"
                value={profit.costPerM2 != null ? formatVND(profit.costPerM2) : "—"}
              />
            )}
          </div>
          {canViewProfit && giaiDoan && (
            <div className="max-w-xl">
              <BangGiaiDoan g={giaiDoan} />
            </div>
          )}

          {canViewContract && (
            <PhanCon
              tieuDe="Hợp đồng & báo giá"
              hanhDong={nutMo(
                `/projects/${project.id}/contract`,
                <FileSignature className="h-3.5 w-3.5" />,
                "Mở hợp đồng",
              )}
            >
              {project.contracts.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có hợp đồng / báo giá</p>
              ) : (
                <div className="space-y-2">
                  {project.contracts.map((c) => {
                    const t = computeContractTotals(c.items, c.vatPercent);
                    const st = CONTRACT_STATUS_MAP[c.status];
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone={st?.tone ?? "slate"}>{st?.label ?? c.status}</Badge>
                          <span className="text-sm font-medium text-slate-800">
                            {c.contractNo ?? c.subject ?? "—"}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600">
                          Chưa VAT: <span className="font-medium">{formatVND(t.beforeVat)}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          Tổng:{" "}
                          <span className="font-semibold text-green-600">
                            {formatVND(t.withVat)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </PhanCon>
          )}

          {canViewPayment && (
            <PhanCon tieuDe="Thanh toán theo đợt">
              <ProjectPayments
                projectId={project.id}
                payments={payments}
                canEdit={canEditPayment}
                now={nowMs}
              />
            </PhanCon>
          )}

          {canViewCost && project.costSummary && (
            <PhanCon
              tieuDe="Tổng hợp chi phí (quyết toán)"
              hanhDong={nutMo(
                `/projects/${project.id}/cost`,
                <Wallet className="h-3.5 w-3.5" />,
                "Xem chi tiết",
              )}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Summary
                  label="Doanh thu"
                  value={formatVND(project.costSummary.revenue ?? 0)}
                  valueClass="text-blue-600"
                />
                <Summary
                  label="Chi phí"
                  value={formatVND(project.costSummary.cost ?? 0)}
                  valueClass="text-amber-600"
                />
                {canViewProfit && (
                  <Summary
                    label="LNTT"
                    value={formatVND(project.costSummary.profit ?? 0)}
                    valueClass="text-green-600"
                  />
                )}
              </div>
            </PhanCon>
          )}
        </div>
      </MucDuAn>

      {canViewPurchase && (
        <MucDuAn
          id="mua-hang"
          so={so("mua-hang")}
          tieuDe="Đơn hàng & mua hàng"
          tomTat={`${project.purchaseOrders.length} đơn`}
          hanhDong={nutMo(
            `/projects/${project.id}/purchase`,
            <ShoppingCart className="h-3.5 w-3.5" />,
            "Mở đơn hàng",
          )}
        >
          {project.purchaseOrders.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có đơn đặt hàng</p>
          ) : (
            <div className="space-y-2">
              {project.purchaseOrders.map((o) => {
                const cat = PO_CATEGORY_MAP[o.category];
                const st = PO_STATUS_MAP[o.status];
                return (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={cat?.tone ?? "slate"}>{cat?.label ?? o.category}</Badge>
                      <Badge tone={st?.tone ?? "slate"}>{st?.label ?? o.status}</Badge>
                      <span className="text-sm text-slate-600">
                        {o.supplier?.name ?? "Chưa gán NCC"}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {o._count.items} dòng
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-medium text-blue-600">
                        {formatNumber(o.totalWeight)} kg
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </MucDuAn>
      )}

      <MucDuAn
        id="ho-so"
        so={so("ho-so")}
        tieuDe="Hồ sơ & phiên bản"
        tomTat={`${docs.length} bản`}
        mo={false}
      >
        <DocVersions
          projectId={project.id}
          docs={docs}
          canEditTypes={canEditTypes}
          canDelete={session.role === "ADMIN"}
        />
      </MucDuAn>

      <MucDuAn
        id="nhat-ky"
        so={so("nhat-ky")}
        tieuDe="Nhật ký dự án"
        tomTat={`${notes.length} ghi chép`}
        mo={false}
      >
        <ProjectNotes
          projectId={project.id}
          notes={notes}
          canEdit={canEdit}
          canDelete={session.role === "ADMIN"}
        />
      </MucDuAn>

      {canViewProfit && (
        <MucDuAn id="lich-su" so={so("lich-su")} tieuDe="Lịch sử thay đổi" mo={false}>
          <AuditEntries rows={auditLog} />
          {auditLog.length === 30 && (
            <p className="pt-2 text-xs text-slate-400">
              Hiển thị 30 thay đổi gần nhất.
              {session.role === "ADMIN" ? " Xem đầy đủ ở mục Nhật ký thay đổi." : ""}
            </p>
          )}
        </MucDuAn>
      )}
    </div>
  );
}

/** Phần con trong một mục (vd. Hợp đồng, Thanh toán trong mục Tài chính). */
function PhanCon({
  tieuDe,
  hanhDong,
  children,
}: {
  tieuDe: string;
  hanhDong?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tieuDe}</h4>
        {hanhDong}
      </div>
      {children}
    </div>
  );
}

function Summary({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold text-slate-900 ${valueClass ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
