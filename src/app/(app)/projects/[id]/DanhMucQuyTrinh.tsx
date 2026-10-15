"use client";

import { useState } from "react";
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
  const xong = buoc.filter((b) => b.trangThai === "DA_DUYET" || b.trangThai === "BO_QUA").length;
  const dangMoBuoc = buoc.find((b) => b.buoc === mo);

  return (
    <nav id="danh-muc-quy-trinh" className="rounded-lg border border-slate-200 bg-white p-3 text-sm" aria-label="Danh mục quy trình">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-semibold text-slate-900">Quy trình</p>
        <span className="text-xs text-slate-500">
          {xong}/{buoc.length} bước
        </span>
      </div>
      <ol className="space-y-1">
        {buoc.map((b, i) => {
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
      {dangMoBuoc && (
        <Modal open onClose={() => setMo(null)} title="Quy trình dự án" size="xl">
          <QuyTrinhPanel {...props} chonDau={dangMoBuoc.buoc} />
        </Modal>
      )}
    </nav>
  );
}
