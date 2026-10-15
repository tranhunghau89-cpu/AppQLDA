"use client";

import { useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  History,
  Link2,
  Pencil,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { QC_GIAI_DOAN, QC_LOAI, QC_LOAI_MAP, QC_NHOM } from "@/lib/constants";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import {
  KET_QUA_THEO_NHOM,
  dongTieuChi,
  duocDanhQc,
  nhanKetQua,
  tomTatGiaiDoan,
} from "@/lib/qc";
import { formatDate } from "@/lib/utils";
import {
  boSungViecHoSoTuMau,
  chepMauGiaiDoan,
  danhGiaQc,
  ghiChuTieuChiQc,
  luuQcMuc,
  taoQcTuMau,
  xoaQcMuc,
} from "./qcActions";
import { QcSoSanhVatTu, type SoSanhData } from "./QcSoSanhVatTu";
import { TieuChiEditor } from "../../qc-mau/TieuChiEditor";

export interface QcLanKiemView {
  id: string;
  ketQua: string;
  ghiChu: string | null;
  nguoiTen: string;
  lienKet: string | null;
  lienKetTen: string | null;
  createdAt: string;
  tep: { ten: string; url: string | null }[];
}
export interface QcMucView {
  id: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
  nhom: string;
  loai: string;
  tieuChi: string | null;
  ghiChuTc: Record<string, string>;
  ketQua: string;
  nguoiKiem: string | null;
  ngayKiem: string | null;
  ghiChu: string | null;
  lanKiem: QcLanKiemView[];
}
type Draft = {
  id?: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
  nhom: string;
  loai: string;
  tieuChi: string | null;
};

export interface TaiLieuApp {
  nhan: string;
  href: string;
}

/** Liên kết bằng chứng: trang trong app mở cùng tab, link ngoài mở tab mới. */
function LienKetBangChung({
  href,
  ten,
  className = "",
}: {
  href: string;
  ten: string | null;
  className?: string;
}) {
  const ngoai = !href.startsWith("/");
  return (
    <a
      href={href}
      {...(ngoai ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`inline-flex items-center gap-1 text-blue-600 hover:underline ${className}`}
      title={href}
    >
      <Link2 className="h-3.5 w-3.5" />
      {ten ?? href}
    </a>
  );
}

const NUT_DANH: Record<string, string> = {
  VIEC: "Cập nhật",
  HO_SO: "Nộp hồ sơ",
  KIEM_TRA: "Đánh giá",
};
const GOI_Y_NOI_DUNG: Record<string, string> = {
  VIEC: "Việc cần làm *",
  HO_SO: "Hồ sơ cần có *",
  KIEM_TRA: "Nội dung kiểm tra *",
};

export function QcPanel({
  projectId,
  muc,
  role,
  canEdit,
  coKho,
  soSanh,
  soViecHoSoThieu,
  taiLieuApp,
}: {
  projectId: string;
  muc: QcMucView[];
  role: Role;
  canEdit: boolean;
  coKho: boolean;
  soSanh: SoSanhData | null;
  soViecHoSoThieu: number;
  /** Tài liệu đang có trong app (báo giá, dự toán, hợp đồng) — chọn nhanh làm bằng chứng. */
  taiLieuApp: TaiLieuApp[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  // Giai đoạn đang mở. null = chưa ai bấm: mở giai đoạn đầu tiên chưa xong (hoặc có lỗi).
  const [moGd, setMoGd] = useState<Set<string> | null>(null);

  function run(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      after?.();
    });
  }

  if (muc.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4 text-sm">
        <span className="text-slate-500">Dự án chưa có danh mục QC.</span>
        {canEdit && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => taoQcTuMau(projectId))}
          >
            <ClipboardCheck className="h-4 w-4" /> Tạo danh mục QC từ mẫu
          </Button>
        )}
      </div>
    );
  }

  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  const formMuc = (giaiDoan: string) =>
    draft && draft.giaiDoan === giaiDoan ? (
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
        <Select value={draft.nhom} onChange={set("nhom")}>
          {QC_NHOM.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          className="sm:col-span-3"
          placeholder={GOI_Y_NOI_DUNG[draft.nhom]}
          value={draft.noiDung}
          onChange={set("noiDung")}
        />
        <Select value={draft.boPhan} onChange={set("boPhan")}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        {draft.nhom === "KIEM_TRA" && (
          <Select value={draft.loai} onChange={set("loai")}>
            {QC_LOAI.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        <TieuChiEditor
          className="sm:col-span-4"
          value={draft.tieuChi ?? ""}
          onChange={(v) => setDraft((d) => (d ? { ...d, tieuChi: v } : d))}
        />
        <div className="flex gap-2 sm:col-span-4">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                () => luuQcMuc(projectId, draft),
                () => setDraft(null),
              )
            }
          >
            Lưu
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
            Huỷ
          </Button>
        </div>
      </div>
    ) : null;

  const gdTrong = QC_GIAI_DOAN.filter(
    (gd) => !muc.some((m) => m.giaiDoan === gd.value),
  );
  const gdCoMuc = QC_GIAI_DOAN.map((gd) => {
    const ds = muc.filter((m) => m.giaiDoan === gd.value);
    return { ...gd, ds, t: tomTatGiaiDoan(ds) };
  }).filter((g) => g.ds.length > 0);
  const gdDangLam = gdCoMuc.find((g) => g.t.khongDat > 0 || g.t.dat < g.t.tong);
  const dangMo = moGd ?? new Set(gdDangLam ? [gdDangLam.value] : []);
  const latGd = (v: string, mo?: boolean) => {
    const t = new Set(dangMo);
    if (mo ?? !t.has(v)) t.add(v);
    else t.delete(v);
    setMoGd(t);
  };
  /** Màu chip / thanh tiến độ: đỏ có lỗi, xanh xong hết, xanh dương đang làm, xám chưa đụng. */
  const mauGd = (t: { dat: number; tong: number; khongDat: number }) =>
    t.khongDat > 0
      ? { chip: "bg-red-50 text-red-700 ring-red-200", thanh: "bg-red-500" }
      : t.tong > 0 && t.dat === t.tong
        ? {
            chip: "bg-green-50 text-green-700 ring-green-200",
            thanh: "bg-green-500",
          }
        : t.dat > 0
          ? {
              chip: "bg-blue-50 text-blue-700 ring-blue-200",
              thanh: "bg-blue-500",
            }
          : {
              chip: "bg-slate-50 text-slate-600 ring-slate-200",
              thanh: "bg-slate-300",
            };

  return (
    <div className="space-y-4">
      {canEdit && soViecHoSoThieu > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
          <span className="text-blue-900">
            Mẫu có {soViecHoSoThieu} việc cần làm / hồ sơ cần có mà dự án chưa
            có.
          </span>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => boSungViecHoSoTuMau(projectId))}
          >
            <Plus className="h-4 w-4" /> Bổ sung từ mẫu
          </Button>
        </div>
      )}
      {canEdit && gdTrong.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
          <span className="text-slate-500">Giai đoạn chưa có mục:</span>
          {gdTrong.map((gd) => (
            <Button
              key={gd.value}
              size="sm"
              variant="outline"
              disabled={pending}
              title="Chép các mục mẫu của giai đoạn này vào dự án"
              onClick={() => run(() => chepMauGiaiDoan(projectId, gd.value))}
            >
              <Plus className="h-4 w-4" /> {gd.label}
            </Button>
          ))}
        </div>
      )}
      {gdCoMuc.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {gdCoMuc.map((g, i) => (
            <button
              key={g.value}
              type="button"
              onClick={() => latGd(g.value, true)}
              title={`${g.label}: xong ${g.t.dat}/${g.t.tong}${g.t.khongDat ? `, ${g.t.khongDat} không đạt` : ""}`}
              className={`rounded-md px-2 py-1 text-xs ring-1 ring-inset ${mauGd(g.t).chip} ${
                dangMo.has(g.value) ? "font-semibold" : ""
              }`}
            >
              {i + 1}. {g.label}{" "}
              <span className="tabular-nums opacity-80">
                {g.t.dat}/{g.t.tong}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-xs text-blue-600 hover:underline"
            onClick={() =>
              setMoGd(
                gdCoMuc.every((g) => dangMo.has(g.value))
                  ? new Set()
                  : new Set(gdCoMuc.map((g) => g.value)),
              )
            }
          >
            {gdCoMuc.every((g) => dangMo.has(g.value))
              ? "Thu gọn tất cả"
              : "Mở tất cả"}
          </button>
        </div>
      )}
      {QC_GIAI_DOAN.map((gd) => {
        const ds = muc.filter((m) => m.giaiDoan === gd.value);
        if (ds.length === 0 && draft?.giaiDoan !== gd.value) return null;
        const t = tomTatGiaiDoan(ds);
        const mo = dangMo.has(gd.value) || draft?.giaiDoan === gd.value;
        const so = gdCoMuc.findIndex((g) => g.value === gd.value) + 1;
        return (
          <div
            key={gd.value}
            className="overflow-hidden rounded-xl border border-slate-200"
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 ${
                mo ? "border-b border-slate-100" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => latGd(gd.value)}
                aria-expanded={mo}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
              >
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  {mo ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  {so > 0 && <span className="text-slate-400">{so}.</span>}
                  {gd.label}
                </span>
                <span className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full ${mauGd(t).thanh}`}
                      style={{
                        width: `${t.tong ? Math.round((t.dat / t.tong) * 100) : 0}%`,
                      }}
                    />
                  </span>
                  <span className="tabular-nums">
                    {t.dat}/{t.tong}
                  </span>
                </span>
                {!mo && (
                  <span className="text-xs text-slate-400">
                    {QC_NHOM.map((nh) => {
                      const tn = tomTatGiaiDoan(
                        ds.filter((m) => m.nhom === nh.value),
                      );
                      return tn.tong
                        ? `${nh.label} ${tn.dat}/${tn.tong}`
                        : null;
                    })
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {t.khongDat > 0 && (
                  <Badge tone="red">{t.khongDat} không đạt</Badge>
                )}
              </button>
              {canEdit && !draft && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      giaiDoan: gd.value,
                      noiDung: "",
                      boPhan: "ENGINEERING",
                      nhom: "KIEM_TRA",
                      loai: "THUONG",
                      tieuChi: "",
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Thêm mục
                </Button>
              )}
            </div>
            {mo && (
              <div className="divide-y divide-slate-100">
                {QC_NHOM.map((nh) => {
                  const dsNhom = ds.filter((m) => m.nhom === nh.value);
                  if (dsNhom.length === 0) return null;
                  const tn = tomTatGiaiDoan(dsNhom);
                  // Giai đoạn chỉ có mục kiểm tra (dự án cũ) thì khỏi tiêu đề nhóm.
                  const coTieuDe = ds.some((m) => m.nhom !== "KIEM_TRA");
                  return (
                    <div key={nh.value} className="divide-y divide-slate-100">
                      {coTieuDe && (
                        <div className="flex items-center gap-2 bg-slate-50/70 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                          {nh.label}
                          <span className="font-normal normal-case tabular-nums">
                            {tn.dat}/{tn.tong}
                          </span>
                        </div>
                      )}
                      {dsNhom.map((m) =>
                        draft?.id === m.id ? (
                          <div key={m.id} className="p-3">
                            {formMuc(gd.value)}
                          </div>
                        ) : (
                          <QcDong
                            key={m.id}
                            projectId={projectId}
                            m={m}
                            duocDanh={duocDanhQc(role, m.boPhan)}
                            canEdit={canEdit}
                            coKho={coKho}
                            taiLieuApp={taiLieuApp}
                            soSanh={soSanh}
                            pending={pending}
                            onSua={() =>
                              setDraft({
                                id: m.id,
                                giaiDoan: m.giaiDoan,
                                noiDung: m.noiDung,
                                boPhan: m.boPhan,
                                nhom: m.nhom,
                                loai: m.loai,
                                tieuChi: m.tieuChi,
                              })
                            }
                            onXoa={async () => {
                              const coLichSu = m.lanKiem.length > 0;
                              if (
                                !(await confirm(
                                  coLichSu
                                    ? `Xoá mục "${m.noiDung}"? ${m.lanKiem.length} lần kiểm sẽ bị xoá theo.`
                                    : `Xoá mục "${m.noiDung}"?`,
                                ))
                              )
                                return;
                              run(() => xoaQcMuc(projectId, m.id));
                            }}
                          />
                        ),
                      )}
                    </div>
                  );
                })}
                {!draft?.id && draft?.giaiDoan === gd.value && (
                  <div className="p-3">{formMuc(gd.value)}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QcDong({
  projectId,
  m,
  duocDanh,
  canEdit,
  coKho,
  taiLieuApp,
  soSanh,
  pending,
  onSua,
  onXoa,
}: {
  projectId: string;
  m: QcMucView;
  duocDanh: boolean;
  canEdit: boolean;
  coKho: boolean;
  taiLieuApp: TaiLieuApp[];
  soSanh: SoSanhData | null;
  pending: boolean;
  onSua: () => void;
  onXoa: () => void;
}) {
  const toast = useToast();
  const [mo, setMo] = useState<null | "danh" | "lichSu" | "soSanh">(null);
  const [ketQua, setKetQua] = useState<string>("DAT");
  const [lienKet, setLienKet] = useState({ href: "", ten: "" });
  const [dangLuu, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const kq = nhanKetQua(m.nhom, m.ketQua);
  const laHoSo = m.nhom === "HO_SO";
  const [xemTc, setXemTc] = useState(false);
  const tieuChi = dongTieuChi(m.tieuChi);
  const soGhiChuTc = tieuChi.filter((t) => m.ghiChuTc[t]).length;

  function luu() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("ketQua", ketQua);
    start(async () => {
      const r = await danhGiaQc(projectId, m.id, fd);
      if (!r.ok) return toast.error(r.error);
      setMo(null);
      setLienKet({ href: "", ten: "" });
    });
  }

  const bat = (k: "danh" | "lichSu" | "soSanh") =>
    setMo((x) => (x === k ? null : k));
  const tepMoiNhat = m.lanKiem[0]?.tep ?? [];
  const lkMoiNhat = m.lanKiem[0]?.lienKet ?? null;

  return (
    <div className="space-y-1.5 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={kq.tone}>{kq.label}</Badge>
            <span className="text-slate-900">{m.noiDung}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
            <span>{ROLE_LABEL[m.boPhan as Role] ?? m.boPhan}</span>
            {m.loai !== "THUONG" && <span>{QC_LOAI_MAP[m.loai]?.label}</span>}
            {m.nguoiKiem && (
              <span>
                {m.nguoiKiem} · {formatDate(m.ngayKiem)}
              </span>
            )}
            {tieuChi.length > 0 && (
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => setXemTc((x) => !x)}
              >
                {xemTc || mo === "danh" ? "Ẩn" : "Xem"} tiêu chí (
                {tieuChi.length})
              </button>
            )}
            {soGhiChuTc > 0 && (
              <span className="text-amber-700">
                {soGhiChuTc} tiêu chí có ghi chú
              </span>
            )}
          </div>
          {tieuChi.length > 0 && (xemTc || mo === "danh") && (
            <ol className="mt-1 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-slate-700">
              {tieuChi.map((t, i) => (
                <TieuChiDong
                  key={t}
                  stt={i + 1}
                  noiDung={t}
                  ghiChu={m.ghiChuTc[t] ?? ""}
                  sua={duocDanh || canEdit}
                  onLuu={(v) => ghiChuTieuChiQc(projectId, m.id, t, v)}
                />
              ))}
            </ol>
          )}
          {m.ghiChu && (
            <div className="mt-1 whitespace-pre-line text-slate-700">
              {m.ghiChu}
            </div>
          )}
          {(tepMoiNhat.length > 0 || lkMoiNhat) && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {lkMoiNhat && (
                <LienKetBangChung
                  href={lkMoiNhat}
                  ten={m.lanKiem[0].lienKetTen}
                />
              )}
              {tepMoiNhat.map((f, i) =>
                f.url ? (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {f.ten}
                  </a>
                ) : (
                  <span key={i} className="text-slate-400">
                    {f.ten}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {duocDanh && (
            <Button
              size="sm"
              variant={mo === "danh" ? "secondary" : "outline"}
              onClick={() => bat("danh")}
            >
              {NUT_DANH[m.nhom] ?? "Đánh giá"}
            </Button>
          )}
          {m.loai === "DOI_CHIEU_VAT_TU" && soSanh && (
            <Button size="sm" variant="ghost" onClick={() => bat("soSanh")}>
              <Scale className="h-4 w-4" /> So sánh
            </Button>
          )}
          {m.lanKiem.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => bat("lichSu")}>
              <History className="h-4 w-4" /> {m.lanKiem.length}
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sửa"
                onClick={onSua}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Xoá"
                disabled={pending}
                onClick={onXoa}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {mo === "danh" && (
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            luu();
          }}
          className="space-y-2 rounded-lg bg-slate-50 p-3"
        >
          <div className="flex flex-wrap gap-2">
            {(KET_QUA_THEO_NHOM[m.nhom] ?? []).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setKetQua(k)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  ketQua === k
                    ? k === "KHONG_DAT"
                      ? "bg-red-600 text-white"
                      : k === "DAT"
                        ? "bg-green-600 text-white"
                        : "bg-slate-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-300"
                }`}
              >
                {k === "KHONG_AP_DUNG"
                  ? "Không áp dụng"
                  : nhanKetQua(m.nhom, k).label}
              </button>
            ))}
          </div>
          <Textarea
            name="ghiChu"
            placeholder={
              ketQua === "KHONG_DAT"
                ? "Lỗi cụ thể và hướng xử lý (bắt buộc)"
                : "Ghi chú"
            }
            required={ketQua === "KHONG_DAT"}
          />
          {laHoSo && ketQua === "DAT" && (
            <p className="text-xs font-medium text-purple-700">
              Cần bằng chứng để đánh Đủ: đính kèm tệp (ảnh / PDF) hoặc chọn liên
              kết bên dưới.
            </p>
          )}
          {coKho && (
            <input
              type="file"
              name="tep"
              multiple
              accept="image/*,application/pdf"
              className="block text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
            />
          )}
          <div className="space-y-1.5">
            <input type="hidden" name="lienKet" value={lienKet.href} />
            <input type="hidden" name="lienKetTen" value={lienKet.ten} />
            {taiLieuApp.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">
                  Tài liệu trong app:
                </span>
                {taiLieuApp.map((t) => (
                  <button
                    key={t.href}
                    type="button"
                    onClick={() =>
                      setLienKet((cu) =>
                        cu.href === t.href
                          ? { href: "", ten: "" }
                          : { href: t.href, ten: t.nhan },
                      )
                    }
                    className={`rounded-md px-2 py-1 text-xs ring-1 ring-inset ${
                      lienKet.href === t.href
                        ? "bg-blue-600 text-white ring-blue-600"
                        : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {t.nhan}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
              <Input
                value={lienKet.href}
                onChange={(e) => setLienKet({ href: e.target.value, ten: "" })}
                placeholder="Hoặc dán link ngoài (Google Drive, OneDrive…)"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={dangLuu}>
              Lưu kết quả
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setMo(null)}
            >
              Huỷ
            </Button>
          </div>
        </form>
      )}

      {mo === "soSanh" && soSanh && <QcSoSanhVatTu data={soSanh} />}

      {mo === "lichSu" && (
        <ul className="space-y-1 rounded-lg bg-slate-50 p-3">
          {m.lanKiem.map((l) => (
            <li key={l.id} className="text-xs text-slate-600">
              <Badge tone={nhanKetQua(m.nhom, l.ketQua).tone}>
                {nhanKetQua(m.nhom, l.ketQua).label}
              </Badge>{" "}
              {l.nguoiTen} · {formatDate(l.createdAt)}
              {l.ghiChu && (
                <span className="text-slate-800"> — {l.ghiChu}</span>
              )}
              {l.lienKet && (
                <LienKetBangChung
                  href={l.lienKet}
                  ten={l.lienKetTen}
                  className="ml-2"
                />
              )}
              {l.tep.map((f, i) =>
                f.url ? (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    {f.ten}
                  </a>
                ) : null,
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TieuChiDong({
  stt,
  noiDung,
  ghiChu,
  sua,
  onLuu,
}: {
  stt: number;
  noiDung: string;
  ghiChu: string;
  sua: boolean;
  onLuu: (v: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const toast = useToast();
  const [dangSua, setDangSua] = useState(false);
  const [nhap, setNhap] = useState(ghiChu);
  const [dangLuu, start] = useTransition();

  function luu(v: string) {
    start(async () => {
      const r = await onLuu(v);
      if (!r.ok) return toast.error(r.error);
      setDangSua(false);
    });
  }

  return (
    <li className="flex gap-2">
      <span className="w-5 shrink-0 text-right text-slate-500">{stt}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-x-2">
          <span className="flex-1">{noiDung}</span>
          {sua && !dangSua && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => {
                setNhap(ghiChu);
                setDangSua(true);
              }}
            >
              {ghiChu ? "Sửa ghi chú" : "+ Ghi chú"}
            </button>
          )}
        </div>
        {ghiChu && !dangSua && (
          <div className="mt-0.5 whitespace-pre-line rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
            {ghiChu}
          </div>
        )}
        {dangSua && (
          <div className="mt-1 space-y-1">
            <Textarea
              rows={2}
              autoFocus
              placeholder="Cần chỉnh sửa gì, đang vướng vấn đề gì…"
              value={nhap}
              onChange={(e) => setNhap(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={dangLuu} onClick={() => luu(nhap)}>
                Lưu
              </Button>
              {ghiChu && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={dangLuu}
                  onClick={() => luu("")}
                >
                  Xoá ghi chú
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDangSua(false)}
              >
                Huỷ
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
