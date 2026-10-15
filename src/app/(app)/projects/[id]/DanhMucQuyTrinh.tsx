"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TRANG_THAI_BUOC } from "@/lib/quyTrinh";
import type { BuocView } from "@/lib/quyTrinhDb";
import { QuyTrinhPanel, type TinBuoc } from "./QuyTrinhPanel";

/**
 * Cột trái trang dự án (màn hình rộng): các bước quy trình, trạng thái, ai đang giữ.
 * Bấm một bước là mở chi tiết bước đó (gửi duyệt, giao việc, trao đổi) ngay tại chỗ.
 */
export function DanhMucQuyTrinh(props: {
  projectId: string;
  buoc: BuocView[];
  tin: TinBuoc[];
  nguoiDung: { id: string; name: string; role: string }[];
  toiLa: string;
  vaiTro: string;
  canEdit: boolean;
  nowMs: number;
}) {
  const { buoc, nowMs } = props;
  const [mo, setMo] = useState<string | null>(null);
  // Mặc định thu gọn: chỉ hiện bước đang làm + thanh tiến độ, bấm tiêu đề để xem đủ.
  const [rong, setRong] = useState(false);
  const xong = buoc.filter((b) => b.trangThai === "DA_DUYET" || b.trangThai === "BO_QUA").length;
  const dangMoBuoc = buoc.find((b) => b.buoc === mo);

  return (
    <nav id="danh-muc-quy-trinh" className="rounded-lg border border-slate-200 bg-white p-3 text-sm" aria-label="Danh mục quy trình">
      <button
        type="button"
        onClick={() => setRong(!rong)}
        aria-expanded={rong}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <span className="font-semibold text-slate-900">Quy trình</span>
        <span className="ml-auto text-xs text-slate-500">
          {xong}/{buoc.length} bước
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${rong ? "rotate-180" : ""}`} />
      </button>
      {!rong && (
        <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-green-500" style={{ width: `${buoc.length ? (xong / buoc.length) * 100 : 0}%` }} />
        </div>
      )}
      <ol className="space-y-1">
        {buoc.map((b, i) => {
          const dangLamBuoc = b.trangThai !== "DA_DUYET" && b.trangThai !== "BO_QUA" && b.trangThai !== "CHUA_MO";
          // Thu gọn: chỉ giữ các bước đang làm / chờ duyệt / trả lại.
          if (!rong && !dangLamBuoc) return null;
          const tt = TRANG_THAI_BUOC[b.trangThai];
          const dangLam = b.trangThai !== "DA_DUYET" && b.trangThai !== "BO_QUA" && b.trangThai !== "CHUA_MO";
          const tre = dangLam && b.han && new Date(b.han).getTime() < nowMs;
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setMo(b.buoc)}
                className={`block w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-50 ${dangLam ? "bg-blue-50/50" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      b.trangThai === "DA_DUYET" ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {b.trangThai === "DA_DUYET" ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`leading-tight ${b.trangThai === "CHUA_MO" || b.trangThai === "BO_QUA" ? "text-slate-400" : "text-slate-800"}`}>
                      {b.ten}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone={tt.tone}>{tt.label}</Badge>
                      {tre && <Badge tone="red">Trễ hạn</Badge>}
                    </div>
                    {dangLam && (b.phuTrachTen || b.han) && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {[b.phuTrachTen, b.han ? `hạn ${new Date(b.han).toLocaleDateString("vi-VN")}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      {!rong && buoc.every((b) => b.trangThai === "DA_DUYET" || b.trangThai === "BO_QUA" || b.trangThai === "CHUA_MO") && (
        <p className="px-2 text-xs text-slate-500">
          {xong === buoc.length ? "Đã hoàn thành mọi bước." : "Chưa có bước nào đang làm."}
        </p>
      )}
      {/* Gắn vào body: cột trái là khối sticky có cuộn riêng, để hộp trong đó thì cột phải vẽ đè lên. */}
      {dangMoBuoc &&
        createPortal(
          <Modal open onClose={() => setMo(null)} title="Quy trình dự án" size="xl">
            <QuyTrinhPanel {...props} chonDau={dangMoBuoc.buoc} />
          </Modal>,
          document.body,
        )}
    </nav>
  );
}
