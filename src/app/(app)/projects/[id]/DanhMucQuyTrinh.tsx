import { Badge } from "@/components/ui/badge";
import { TRANG_THAI_BUOC } from "@/lib/quyTrinh";
import type { BuocView } from "@/lib/quyTrinhDb";

/** Cột trái trang dự án: các bước quy trình, trạng thái, ai đang giữ — bấm để mở chi tiết. */
export function DanhMucQuyTrinh({ buoc, nowMs }: { buoc: BuocView[]; nowMs: number }) {
  const xong = buoc.filter((b) => b.trangThai === "DA_DUYET" || b.trangThai === "BO_QUA").length;
  return (
    <nav className="rounded-lg border border-slate-200 bg-white p-3 text-sm" aria-label="Danh mục quy trình">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-semibold text-slate-900">Quy trình</p>
        <span className="text-xs text-slate-500">
          {xong}/{buoc.length} bước
        </span>
      </div>
      <ol className="space-y-1">
        {buoc.map((b, i) => {
          const tt = TRANG_THAI_BUOC[b.trangThai];
          const dangMo = b.trangThai !== "DA_DUYET" && b.trangThai !== "BO_QUA" && b.trangThai !== "CHUA_MO";
          const tre = dangMo && b.han && new Date(b.han).getTime() < nowMs;
          return (
            <li key={b.id}>
              <a
                href="#quy-trinh"
                className={`block rounded-md px-2 py-1.5 hover:bg-slate-50 ${dangMo ? "bg-blue-50/50" : ""}`}
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
                    {dangMo && b.phuTrachTen && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{b.phuTrachTen}</p>
                    )}
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
