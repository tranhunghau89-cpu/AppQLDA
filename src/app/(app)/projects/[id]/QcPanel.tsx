"use client";

import { useRef, useState, useTransition } from "react";
import {
  ClipboardCheck,
  History,
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
import {
  QC_GIAI_DOAN,
  QC_KET_QUA_MAP,
  QC_LOAI,
  QC_LOAI_MAP,
} from "@/lib/constants";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { dongTieuChi, duocDanhQc, tomTatGiaiDoan } from "@/lib/qc";
import { formatDate } from "@/lib/utils";
import {
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
  createdAt: string;
  tep: { ten: string; url: string | null }[];
}
export interface QcMucView {
  id: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
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
  loai: string;
  tieuChi: string | null;
};

const NUT_KET_QUA = ["DAT", "KHONG_DAT", "KHONG_AP_DUNG"] as const;

export function QcPanel({
  projectId,
  muc,
  role,
  canEdit,
  coKho,
  soSanh,
}: {
  projectId: string;
  muc: QcMucView[];
  role: Role;
  canEdit: boolean;
  coKho: boolean;
  soSanh: SoSanhData | null;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

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
        <Input
          className="sm:col-span-2"
          placeholder="Nội dung kiểm tra *"
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
        <Select value={draft.loai} onChange={set("loai")}>
          {QC_LOAI.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
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

  return (
    <div className="space-y-4">
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
      {QC_GIAI_DOAN.map((gd) => {
        const ds = muc.filter((m) => m.giaiDoan === gd.value);
        if (ds.length === 0 && draft?.giaiDoan !== gd.value) return null;
        const t = tomTatGiaiDoan(ds);
        return (
          <div key={gd.value} className="rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{gd.label}</span>
                <span className="text-sm text-slate-500">
                  đạt {t.dat}/{t.tong}
                </span>
                {t.khongDat > 0 && (
                  <Badge tone="red">{t.khongDat} không đạt</Badge>
                )}
              </div>
              {canEdit && !draft && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      giaiDoan: gd.value,
                      noiDung: "",
                      boPhan: "ENGINEERING",
                      loai: "THUONG",
                      tieuChi: "",
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Thêm mục
                </Button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {ds.map((m) =>
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
                    soSanh={soSanh}
                    pending={pending}
                    onSua={() =>
                      setDraft({
                        id: m.id,
                        giaiDoan: m.giaiDoan,
                        noiDung: m.noiDung,
                        boPhan: m.boPhan,
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
              {!draft?.id && draft?.giaiDoan === gd.value && (
                <div className="p-3">{formMuc(gd.value)}</div>
              )}
            </div>
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
  soSanh: SoSanhData | null;
  pending: boolean;
  onSua: () => void;
  onXoa: () => void;
}) {
  const toast = useToast();
  const [mo, setMo] = useState<null | "danh" | "lichSu" | "soSanh">(null);
  const [ketQua, setKetQua] = useState<string>("DAT");
  const [dangLuu, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const kq = QC_KET_QUA_MAP[m.ketQua];
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
    });
  }

  const bat = (k: "danh" | "lichSu" | "soSanh") =>
    setMo((x) => (x === k ? null : k));
  const tepMoiNhat = m.lanKiem[0]?.tep ?? [];

  return (
    <div className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={kq?.tone ?? "slate"}>{kq?.label ?? m.ketQua}</Badge>
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
                {xemTc || mo === "danh" ? "Ẩn" : "Xem"} tiêu chí ({tieuChi.length})
              </button>
            )}
            {soGhiChuTc > 0 && (
              <span className="text-amber-700">{soGhiChuTc} tiêu chí có ghi chú</span>
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
          {tepMoiNhat.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
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
              Đánh giá
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
            {NUT_KET_QUA.map((k) => (
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
                {QC_KET_QUA_MAP[k].label}
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
          {coKho && (
            <input
              type="file"
              name="tep"
              multiple
              accept="image/*,application/pdf"
              className="block text-sm text-slate-600"
            />
          )}
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
              <Badge tone={QC_KET_QUA_MAP[l.ketQua]?.tone ?? "slate"}>
                {QC_KET_QUA_MAP[l.ketQua]?.label ?? l.ketQua}
              </Badge>{" "}
              {l.nguoiTen} · {formatDate(l.createdAt)}
              {l.ghiChu && (
                <span className="text-slate-800"> — {l.ghiChu}</span>
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
              <Button size="sm" variant="ghost" onClick={() => setDangSua(false)}>
                Huỷ
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
