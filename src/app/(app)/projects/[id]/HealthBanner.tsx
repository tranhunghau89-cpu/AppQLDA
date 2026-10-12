import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatVND } from "@/lib/utils";
import type { LyDo, MucCo } from "@/lib/projectHealth";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Dải cờ + chỉ số đầu khối Tổng quan. Không state — dùng được ở server component. */
export function HealthBanner(p: {
  muc: MucCo;
  lyDo: LyDo[];
  tienDo: number;
  daThu: number | null;
  giaTriHD: number | null;
  conPhaiThu: number | null;
  hienTien: boolean;
}) {
  const style =
    p.muc === "DO"
      ? "border-red-200 bg-red-50"
      : p.muc === "VANG"
        ? "border-amber-200 bg-amber-50"
        : "border-green-200 bg-green-50";
  const Icon =
    p.muc === "DO" ? AlertTriangle : p.muc === "VANG" ? Clock : CheckCircle2;
  const iconCls =
    p.muc === "DO"
      ? "text-red-600"
      : p.muc === "VANG"
        ? "text-amber-600"
        : "text-green-600";

  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconCls}`} />
          {p.lyDo.length === 0 ? (
            <p className="text-sm font-medium text-green-800">
              Không có việc quá hạn hay sắp đến hạn.
            </p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {p.lyDo.map((l, i) => (
                <li
                  key={i}
                  className={l.muc === "DO" ? "text-red-800" : "text-amber-800"}
                >
                  {l.text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Tiến độ</dt>
            <dd className="font-semibold text-slate-900">{pct(p.tienDo)}</dd>
          </div>
          {p.hienTien && (
            <>
              <div>
                <dt className="text-slate-500">Đã thu</dt>
                <dd className="font-semibold text-slate-900">{pct(p.daThu)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Giá trị HĐ</dt>
                <dd className="font-semibold text-slate-900">
                  {p.giaTriHD != null ? formatVND(p.giaTriHD) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Còn phải thu</dt>
                <dd className="font-semibold text-slate-900">
                  {formatVND(p.conPhaiThu)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
