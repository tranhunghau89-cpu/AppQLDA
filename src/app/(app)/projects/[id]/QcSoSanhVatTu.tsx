import { VAT_TU_TAG_MAP } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

export interface SoSanhData {
  info: {
    mauSon: string | null;
    mauTonMai: string | null;
    mauTonVach: string | null;
    ghiChuVatTu: string | null;
  };
  specs: {
    tag: string | null;
    name: string;
    spec: string | null;
    origin: string | null;
  }[];
  /** Dòng đơn mua nhóm theo đơn. Cố ý không có đơn giá/thành tiền. */
  orders: {
    id: string;
    tieuDe: string;
    rows: {
      name: string;
      groupName: string | null;
      unit: string | null;
      qty: number | null;
      weight: number | null;
      note: string | null;
    }[];
  }[];
}

const MAU: [keyof SoSanhData["info"], string][] = [
  ["mauSon", "Màu sơn kết cấu"],
  ["mauTonMai", "Màu tôn mái"],
  ["mauTonVach", "Màu tôn vách"],
  ["ghiChuVatTu", "Ghi chú vật tư"],
];

/** Hai cột để người kiểm đối chiếu bằng mắt: theo HĐ ↔ trong đơn mua. App không tự kết luận. */
export function QcSoSanhVatTu({ data }: { data: SoSanhData }) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-3 text-sm lg:grid-cols-2">
      <div className="space-y-3">
        <h5 className="font-semibold text-slate-700">Theo hợp đồng</h5>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          {MAU.map(([k, label]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="whitespace-pre-line text-slate-900">
                {data.info[k] ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
        {data.specs.length === 0 ? (
          <p className="text-slate-400">
            Chưa có chủng loại theo HĐ (khối Vật tư ở đầu trang).
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.specs.map((s, i) => (
              <li key={i} className="py-1">
                <span className="text-xs text-slate-500">
                  {s.tag
                    ? (VAT_TU_TAG_MAP[s.tag]?.label ?? s.tag)
                    : "Dùng chung"}{" "}
                  ·{" "}
                </span>
                <span className="font-medium text-slate-900">{s.name}</span>
                {s.spec && <span className="text-slate-700"> — {s.spec}</span>}
                {s.origin && (
                  <span className="text-slate-500"> ({s.origin})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-3">
        <h5 className="font-semibold text-slate-700">Trong đơn mua</h5>
        {data.orders.length === 0 ? (
          <p className="text-slate-400">Chưa có dòng đơn hàng.</p>
        ) : (
          data.orders.map((o) => (
            <div key={o.id}>
              <div className="text-xs font-medium uppercase text-slate-500">
                {o.tieuDe}
              </div>
              <ul className="divide-y divide-slate-100">
                {o.rows.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2 py-1">
                    <span>
                      <span className="font-medium text-slate-900">
                        {r.name}
                      </span>
                      {r.groupName && (
                        <span className="text-slate-500"> · {r.groupName}</span>
                      )}
                      {r.note && (
                        <span className="text-slate-500"> — {r.note}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-slate-600">
                      {r.qty != null &&
                        `${formatNumber(r.qty)} ${r.unit ?? ""}`}
                      {r.weight != null && ` · ${formatNumber(r.weight)} kg`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
