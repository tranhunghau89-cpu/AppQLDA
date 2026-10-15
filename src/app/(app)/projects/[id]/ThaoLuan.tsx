"use client";

import { useState, useTransition } from "react";
import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

const thoiGian = (s: string) => new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

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
  const [chuY, setChuY] = useState(false);
  const [phong, setPhong] = useState<Role[]>([]);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, start] = useTransition();

  function chay(f: () => Promise<{ ok: true } | { ok: false; error: string }>, sau?: () => void) {
    setLoi(null);
    start(async () => {
      const r = await f();
      if (r.ok) sau?.();
      else setLoi(r.error);
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-slate-200 p-3">
        <textarea
          value={noiDung}
          onChange={(e) => setNoiDung(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Trao đổi với các bộ phận về dự án này — thông tin mới, vướng mắc, việc cần phối hợp…"
          className="w-full rounded-md border border-slate-300 p-2"
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
          <span className="text-xs">Báo thêm bộ phận:</span>
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={phong.includes(r)}
                onChange={(e) => setPhong(e.target.checked ? [...phong, r] : phong.filter((x) => x !== r))}
              />
              {ROLE_LABEL[r]}
            </label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {canEdit && (
            <label className="flex items-center gap-1.5 text-amber-700">
              <input type="checkbox" checked={chuY} onChange={(e) => setChuY(e.target.checked)} />
              Đánh dấu Chú ý (ghim lên đầu trang)
            </label>
          )}
          <span className="text-xs text-slate-400">Thành viên dự án luôn được báo.</span>
          <Button
            size="sm"
            className="ml-auto"
            disabled={dang || !noiDung.trim()}
            onClick={() =>
              chay(
                () => dangThaoLuan(projectId, { noiDung, chuY, phong }),
                () => { setNoiDung(""); setChuY(false); setPhong([]); },
              )
            }
          >
            Đăng
          </Button>
        </div>
        {loi && <p className="mt-1 text-red-600">{loi}</p>}
      </div>

      {tin.length === 0 ? (
        <p className="text-center text-slate-400">Chưa có trao đổi nào.</p>
      ) : (
        <ul className="space-y-2">
          {tin.map((t) => (
            <li
              key={t.id}
              className={`rounded-lg border p-3 ${t.ghim ? "border-amber-300 bg-amber-50/60" : "border-slate-200"}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {t.ghim && <Pin className="h-3.5 w-3.5 text-amber-600" aria-label="Chú ý" />}
                <span className="font-medium text-slate-800">{t.tacGiaTen}</span>
                {t.boPhan && <span>· {ROLE_LABEL[t.boPhan as Role] ?? t.boPhan}</span>}
                <span>· {thoiGian(t.createdAt)}</span>
                <span className="ml-auto flex gap-1">
                  {canEdit && (
                    <button
                      type="button"
                      disabled={dang}
                      onClick={() => chay(() => ghimThaoLuan(t.id, !t.ghim))}
                      className="rounded px-1.5 py-0.5 hover:bg-slate-100"
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
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-slate-800">{t.noiDung}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
