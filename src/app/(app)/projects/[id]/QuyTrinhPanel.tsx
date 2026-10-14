"use client";

import { useState, useTransition } from "react";
import { Check, ChevronRight, Send, Undo2 } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { BUOC_THONG_TIN, TRANG_THAI_BUOC, buocHienTai } from "@/lib/quyTrinh";
import { LOAI_TRAO_DOI_LABEL } from "@/lib/traoDoiNhan";
import type { BuocView } from "@/lib/quyTrinhDb";
import { chuyenBuoc, giaoBuoc } from "./quyTrinhActions";

export interface TinBuoc {
  buocId: string;
  loai: string;
  noiDung: string;
  tacGiaTen: string;
  createdAt: string;
}

const MAU_TIN: Record<string, string> = {
  XIN_DUYET: "text-blue-700",
  CAN_SUA: "text-red-700",
  DONG_Y: "text-green-700",
  GHI_CHU: "text-slate-600",
};

export function QuyTrinhPanel({
  projectId,
  buoc,
  tin,
  nguoiDung,
  toiLa,
  laAdmin,
  canEdit,
  nowMs,
}: {
  projectId: string;
  buoc: BuocView[];
  tin: TinBuoc[];
  nguoiDung: { id: string; name: string }[];
  toiLa: string;
  laAdmin: boolean;
  canEdit: boolean;
  nowMs: number;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const hienTai = buocHienTai(buoc);
  const [chon, setChon] = useState<string>(hienTai ?? buoc[buoc.length - 1].buoc);
  const [ghiChu, setGhiChu] = useState("");
  const b = buoc.find((x) => x.buoc === chon)!;
  const tinBuoc = tin.filter((t) => t.buocId === b.id);
  const quaHan =
    b.phuTrachId != null &&
    b.han != null &&
    b.trangThai !== "DA_DUYET" &&
    b.trangThai !== "BO_QUA" &&
    new Date(b.han).getTime() < nowMs;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      setGhiChu("");
    });
  }

  const duocGui = (b.phuTrachId === toiLa || canEdit) &&
    (b.trangThai === "DANG_LAM" || b.trangThai === "TRA_LAI");
  const duocDuyet = laAdmin && b.trangThai === "CHO_DUYET";

  return (
    <div className="space-y-4">
      {/* Thanh bước */}
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {buoc.map((x, i) => {
          const tt = TRANG_THAI_BUOC[x.trangThai];
          const dangChon = x.buoc === chon;
          return (
            <li key={x.buoc} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => setChon(x.buoc)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  dangChon ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                } ${x.trangThai === "BO_QUA" ? "opacity-50" : ""}`}
              >
                <div className="font-medium text-slate-800">
                  {i}. {x.ten}
                </div>
                <div className="mt-1">
                  <Badge tone={tt.tone}>{tt.label}</Badge>
                </div>
              </button>
              {i < buoc.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
            </li>
          );
        })}
      </ol>

      {/* Chi tiết bước đang chọn */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{b.ten}</span>
          <Badge tone={TRANG_THAI_BUOC[b.trangThai].tone}>
            {TRANG_THAI_BUOC[b.trangThai].label}
          </Badge>
          {quaHan && <Badge tone="red">Quá hạn</Badge>}
          <a
            href={b.buoc === BUOC_THONG_TIN ? "#tong-quan" : "#qc"}
            className="ml-auto text-xs text-blue-600 hover:underline"
          >
            {b.buoc === BUOC_THONG_TIN ? "Đi tới phần thông tin dự án" : "Đi tới danh mục QC"} →
          </a>
        </div>

        {b.trangThai !== "BO_QUA" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Người phụ trách</span>
              <Select
                disabled={!canEdit || pending}
                value={b.phuTrachId ?? ""}
                onChange={(e) =>
                  run(() =>
                    giaoBuoc(projectId, b.buoc, {
                      phuTrachId: e.target.value || null,
                      hanXuLy: b.hanDatTay ? b.han : null,
                    }),
                  )
                }
              >
                <option value="">
                  — Chưa giao (bộ phận {ROLE_LABEL[b.boPhanMacDinh as Role] ?? b.boPhanMacDinh}) —
                </option>
                {nguoiDung.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">
                Hạn xử lý {b.hanDatTay ? "" : "(theo kế hoạch tiến độ)"}
              </span>
              <Input
                type="date"
                disabled={!canEdit || pending}
                value={b.han ? b.han.slice(0, 10) : ""}
                onChange={(e) =>
                  run(() =>
                    giaoBuoc(projectId, b.buoc, {
                      phuTrachId: b.phuTrachId,
                      hanXuLy: e.target.value || null,
                    }),
                  )
                }
              />
            </label>
          </div>
        )}

        {b.trangThai === "BO_QUA" ? (
          <p className="text-slate-500">Giai đoạn này không có mục QC nên tự bỏ qua.</p>
        ) : b.trangThai === "CHUA_MO" ? (
          <p className="text-slate-500">Chưa mở — chờ bước trước được duyệt.</p>
        ) : (
          b.chuaDu &&
          b.trangThai !== "DA_DUYET" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">{b.chuaDu}</p>
          )
        )}

        {b.guiLuc && <p className="text-xs text-slate-500">Gửi duyệt: {formatDate(b.guiLuc)}</p>}
        {b.duyetLuc && <p className="text-xs text-slate-500">Duyệt: {formatDate(b.duyetLuc)}</p>}

        {(duocGui || duocDuyet) && (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder={duocDuyet ? "Ý kiến duyệt / lý do trả lại (bắt buộc khi trả lại)" : "Ghi chú khi gửi duyệt"}
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {duocGui && (
                <Button
                  size="sm"
                  disabled={pending || !!b.chuaDu}
                  onClick={() => run(() => chuyenBuoc(projectId, b.buoc, "GUI", ghiChu))}
                >
                  <Send className="h-4 w-4" /> Gửi duyệt
                </Button>
              )}
              {duocDuyet && (
                <>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => chuyenBuoc(projectId, b.buoc, "DUYET", ghiChu))}
                  >
                    <Check className="h-4 w-4" /> Duyệt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => chuyenBuoc(projectId, b.buoc, "TRA_LAI", ghiChu))}
                  >
                    <Undo2 className="h-4 w-4" /> Trả lại
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {tinBuoc.length > 0 && (
          <div className="space-y-1 border-t border-slate-100 pt-3">
            <div className="text-xs font-medium text-slate-500">Lịch sử</div>
            {tinBuoc.map((t, i) => (
              <div key={i} className="text-xs">
                <span className="text-slate-400">{formatDate(t.createdAt)}</span>{" "}
                <span className="font-medium text-slate-700">{t.tacGiaTen}</span>{" "}
                <span className={MAU_TIN[t.loai] ?? ""}>
                  [{LOAI_TRAO_DOI_LABEL[t.loai] ?? t.loai}]
                </span>{" "}
                <span className="whitespace-pre-line text-slate-700">{t.noiDung}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
