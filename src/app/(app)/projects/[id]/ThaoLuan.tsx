"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { dangThaoLuan, ghimThaoLuan, xoaThaoLuan } from "./thaoLuanActions";

export interface TinThaoLuan {
  id: string;
  noiDung: string;
  tacGiaId: string;
  tacGiaTen: string;
  boPhan: string | null;
  createdAt: string;
  ghim: boolean;
  /** Chủ đề (Vật tư, Tiến độ…) — null = trao đổi chung. */
  chuDe: string | null;
  canXuLy: boolean;
}

type ChuDe = "VAT_TU" | "TIEN_DO" | "THIET_KE" | "HOP_DONG" | "THANH_TOAN" | "BAO_HANH";

/** Chủ đề nhập nhanh: bộ phận nhận mặc định + câu mẫu bấm là điền. */
const CHU_DE: { ma: ChuDe; ten: string; phong: Role[]; mau: string[] }[] = [
  {
    ma: "VAT_TU",
    ten: "Vật tư",
    phong: ["PROCUREMENT", "ENGINEERING"],
    mau: ["Điều chỉnh chủng loại/quy cách vật tư: ", "Bổ sung khối lượng vật tư: ", "Đổi nhà cung cấp: "],
  },
  {
    ma: "TIEN_DO",
    ten: "Tiến độ",
    phong: ["ENGINEERING"],
    mau: ["Tiến độ đang chậm, đề nghị đẩy nhanh hạng mục: ", "Đề nghị báo cáo tiến độ thực tế trước ngày ", "CĐT yêu cầu hoàn thành sớm: "],
  },
  {
    ma: "THIET_KE",
    ten: "Thiết kế",
    phong: ["ENGINEERING"],
    mau: ["Đề nghị kiểm tra lại quy cách thiết kế: ", "Bản vẽ chưa khớp hiện trạng tại: ", "CĐT yêu cầu điều chỉnh thiết kế: "],
  },
  {
    ma: "HOP_DONG",
    ten: "Hợp đồng",
    phong: ["ADMIN", "ACCOUNTING"],
    mau: ["Phát sinh ngoài hợp đồng: ", "Đề nghị lập phụ lục hợp đồng: "],
  },
  {
    ma: "THANH_TOAN",
    ten: "Thanh toán",
    phong: ["ACCOUNTING"],
    mau: ["Đề nghị đôn đốc thu tiền đợt: ", "Đề nghị thanh toán cho NCC: "],
  },
  { ma: "BAO_HANH", ten: "Bảo hành", phong: ["ENGINEERING"], mau: ["CĐT báo lỗi cần kiểm tra: "] },
];
const TEN_CHU_DE = Object.fromEntries(CHU_DE.map((c) => [c.ma, c.ten]));

const thoiGian = (s: string) => new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
/** Tên bộ phận gọn cho ô chọn hẹp: "Kế toán / Tài chính" → "Kế toán". */
const tenNgan = (r: Role) => ROLE_LABEL[r].split(" / ")[0];

/** Khung "Chú ý" ghim ở đầu trang dự án — ai mở dự án cũng thấy. */
export function ChuYDuAn({ tin }: { tin: TinThaoLuan[] }) {
  if (tin.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-800">
        <Pin className="h-4 w-4" /> Chú ý
      </p>
      <ul className="space-y-1.5">
        {tin.map((t) => (
          <li key={t.id} className="text-slate-800">
            <span className="whitespace-pre-line">{t.noiDung}</span>
            <span className="ml-2 text-xs text-slate-500">
              — {t.tacGiaTen}, {thoiGian(t.createdAt)}
            </span>
          </li>
        ))}
      </ul>
      <a href="#thao-luan" className="mt-1 inline-block text-xs text-amber-700 hover:underline">
        Xem trao đổi dự án →
      </a>
    </div>
  );
}

export function ThaoLuan({
  projectId,
  tin,
  toiLa,
  laQuanTri,
  canEdit,
}: {
  projectId: string;
  tin: TinThaoLuan[];
  toiLa: string;
  laQuanTri: boolean;
  canEdit: boolean;
}) {
  const [noiDung, setNoiDung] = useState("");
  const [chuDe, setChuDe] = useState<ChuDe | null>(null);
  const [chuY, setChuY] = useState(false);
  const [canXuLy, setCanXuLy] = useState(false);
  const [phong, setPhong] = useState<Role[]>([]);
  const [moPhong, setMoPhong] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, start] = useTransition();
  const cd = CHU_DE.find((c) => c.ma === chuDe);

  function chonChuDe(ma: ChuDe) {
    const bo = ma === chuDe;
    setChuDe(bo ? null : ma);
    setPhong(bo ? [] : CHU_DE.find((c) => c.ma === ma)!.phong);
    setCanXuLy(!bo);
  }

  function chay(f: () => Promise<{ ok: true } | { ok: false; error: string }>, sau?: () => void) {
    setLoi(null);
    start(async () => {
      const r = await f();
      if (r.ok) sau?.();
      else setLoi(r.error);
    });
  }

  function dangTin() {
    if (dang || !noiDung.trim()) return;
    chay(
      () => dangThaoLuan(projectId, { noiDung, chuY, phong, chuDe, canXuLy }),
      () => {
        setNoiDung("");
        setChuY(false);
        setChuDe(null);
        setCanXuLy(false);
        setPhong([]);
        setMoPhong(false);
      },
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-2 rounded-lg border border-slate-200 p-2.5">
        <div className="flex flex-wrap gap-1">
          {CHU_DE.map((c) => (
            <button
              key={c.ma}
              type="button"
              onClick={() => chonChuDe(c.ma)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                c.ma === chuDe ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.ten}
            </button>
          ))}
        </div>
        {cd && cd.mau.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cd.mau.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setNoiDung(noiDung ? `${noiDung}\n${m}` : m)}
                className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                + {m.replace(/:\s*$/, "")}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={noiDung}
          onChange={(e) => setNoiDung(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              dangTin();
            }
          }}
          rows={3}
          maxLength={4000}
          placeholder="Thông tin mới, vướng mắc, việc cần phối hợp… (Ctrl+Enter để đăng)"
          className="w-full rounded-md border border-slate-300 p-2"
        />

        <button
          type="button"
          onClick={() => setMoPhong(!moPhong)}
          className="flex w-full items-center gap-1 text-left text-xs text-slate-600"
        >
          <span className="shrink-0">Báo thêm:</span>
          <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
            {phong.length ? phong.map(tenNgan).join(", ") : "chỉ thành viên dự án"}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${moPhong ? "rotate-180" : ""}`} />
        </button>
        {moPhong && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-md bg-slate-50 p-2">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1 text-xs" title={ROLE_LABEL[r]}>
                <input
                  type="checkbox"
                  checked={phong.includes(r)}
                  onChange={(e) => setPhong(e.target.checked ? [...phong, r] : phong.filter((x) => x !== r))}
                />
                {tenNgan(r)}
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <label className="flex items-center gap-1 text-slate-600">
            <input type="checkbox" checked={canXuLy} onChange={(e) => setCanXuLy(e.target.checked)} />
            Cần xử lý
          </label>
          {canEdit && (
            <label className="flex items-center gap-1 text-amber-700">
              <input type="checkbox" checked={chuY} onChange={(e) => setChuY(e.target.checked)} />
              Ghim Chú ý
            </label>
          )}
          <Button size="sm" className="ml-auto" disabled={dang || !noiDung.trim()} onClick={dangTin}>
            Đăng
          </Button>
        </div>
        {loi && <p className="text-red-600">{loi}</p>}
      </div>

      {tin.length === 0 ? (
        <p className="text-center text-slate-400">Chưa có trao đổi nào.</p>
      ) : (
        <ul className="space-y-2">
          {tin.map((t) => (
            <li
              key={t.id}
              className={`rounded-lg border p-2.5 ${t.ghim ? "border-amber-300 bg-amber-50/60" : "border-slate-200"}`}
            >
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                {t.ghim && <Pin className="h-3.5 w-3.5 text-amber-600" aria-label="Chú ý" />}
                <span className="font-medium text-slate-800">{t.tacGiaTen}</span>
                {t.boPhan && <span>· {tenNgan(t.boPhan as Role)}</span>}
                <span>· {thoiGian(t.createdAt)}</span>
              </div>
              {(t.chuDe || t.canXuLy) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.chuDe && <Badge tone="purple">{TEN_CHU_DE[t.chuDe] ?? t.chuDe}</Badge>}
                  {t.canXuLy && <Badge tone="amber">Cần xử lý</Badge>}
                </div>
              )}
              <p className="mt-1 whitespace-pre-line text-slate-800">{t.noiDung}</p>
              {(canEdit || t.tacGiaId === toiLa || laQuanTri) && (
                <div className="mt-1 flex justify-end gap-1 text-xs">
                  {canEdit && (
                    <button
                      type="button"
                      disabled={dang}
                      onClick={() => chay(() => ghimThaoLuan(t.id, !t.ghim))}
                      className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100"
                    >
                      {t.ghim ? "Bỏ ghim" : "Ghim"}
                    </button>
                  )}
                  {(t.tacGiaId === toiLa || laQuanTri) && (
                    <button
                      type="button"
                      disabled={dang}
                      onClick={() => confirm("Xóa tin này?") && chay(() => xoaThaoLuan(t.id))}
                      className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
