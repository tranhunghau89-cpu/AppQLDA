"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { PO_CATEGORY, PO_CATEGORY_MAP, PO_STATUS_MAP, VAT_TU_TAG, VAT_TU_TAG_MAP } from "@/lib/constants";
import { formatDate, formatNumber, formatVND } from "@/lib/utils";
import { soNgay } from "@/lib/projectHealth";
import {
  copySpecsFromQuote,
  deleteMaterialSpec,
  moveMaterialSpec,
  saveMaterialInfo,
  saveMaterialSpec,
} from "./overviewActions";

export interface SpecRow {
  id: string;
  tag: string | null;
  name: string;
  spec: string | null;
  origin: string | null;
}
export interface OrderSummary {
  id: string;
  category: string;
  status: string;
  supplierName: string | null;
  value: number | null;
  totalWeight: number | null;
  expectedDate: string | null;
  receivedDate: string | null;
}
interface Info {
  mauSon: string | null;
  mauTonMai: string | null;
  mauTonVach: string | null;
  ghiChuVatTu: string | null;
}
type SpecDraft = { id?: string; tag: string; name: string; spec: string; origin: string };

const INFO_LABELS: [keyof Info, string][] = [
  ["mauSon", "Màu sơn kết cấu"],
  ["mauTonMai", "Màu tôn mái"],
  ["mauTonVach", "Màu tôn vách"],
  ["ghiChuVatTu", "Ghi chú vật tư"],
];

export function MaterialInfo({
  projectId,
  info,
  specs,
  orders,
  canEdit,
  coBaoGia,
  nowMs,
}: {
  projectId: string;
  info: Info;
  specs: SpecRow[];
  orders: OrderSummary[];
  canEdit: boolean;
  coBaoGia: boolean;
  nowMs: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [infoDraft, setInfoDraft] = useState<Record<keyof Info, string> | null>(null);
  const [specDraft, setSpecDraft] = useState<SpecDraft | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      after?.();
      router.refresh();
    });
  }

  function copyFromQuote() {
    if (
      specs.length > 0 &&
      !confirm("Thay toàn bộ chủng loại hiện tại bằng bảng vật liệu của báo giá?")
    )
      return;
    run(() => copySpecsFromQuote(projectId));
  }

  const setSpec = (k: keyof SpecDraft) => (e: { target: { value: string } }) =>
    setSpecDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  const specForm = specDraft && (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
      <Select value={specDraft.tag} onChange={setSpec("tag")}>
        <option value="">Dùng chung</option>
        {VAT_TU_TAG.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Input placeholder="Tên vật tư *" value={specDraft.name} onChange={setSpec("name")} />
      <Input placeholder="Thông số" value={specDraft.spec} onChange={setSpec("spec")} />
      <Input placeholder="Xuất xứ / ghi chú" value={specDraft.origin} onChange={setSpec("origin")} />
      <div className="flex gap-2 sm:col-span-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => saveMaterialSpec(projectId, specDraft), () => setSpecDraft(null))}
        >
          Lưu
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSpecDraft(null)}>
          Huỷ
        </Button>
      </div>
    </div>
  );

  const orderGroups = PO_CATEGORY.map((c) => ({
    cat: c.value,
    rows: orders.filter((o) => o.category === c.value),
  }))
    .concat([{ cat: "_KHAC", rows: orders.filter((o) => !(o.category in PO_CATEGORY_MAP)) }])
    .filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-5">
      {/* Màu & ghi chú */}
      <div>
        {infoDraft ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {INFO_LABELS.map(([k, label]) =>
              k === "ghiChuVatTu" ? (
                <Textarea
                  key={k}
                  className="sm:col-span-2"
                  placeholder={label}
                  value={infoDraft[k]}
                  onChange={(e) => setInfoDraft({ ...infoDraft, [k]: e.target.value })}
                />
              ) : (
                <Input
                  key={k}
                  placeholder={label}
                  value={infoDraft[k]}
                  onChange={(e) => setInfoDraft({ ...infoDraft, [k]: e.target.value })}
                />
              )
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => saveMaterialInfo(projectId, infoDraft), () => setInfoDraft(null))}
              >
                Lưu
              </Button>
              <Button size="sm" variant="outline" onClick={() => setInfoDraft(null)}>
                Huỷ
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <dl className="grid flex-1 grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              {INFO_LABELS.map(([k, label]) => (
                <div key={k} className={k === "ghiChuVatTu" ? "sm:col-span-2" : ""}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="whitespace-pre-line font-medium text-slate-900">{info[k] ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setInfoDraft({
                    mauSon: info.mauSon ?? "",
                    mauTonMai: info.mauTonMai ?? "",
                    mauTonVach: info.mauTonVach ?? "",
                    ghiChuVatTu: info.ghiChuVatTu ?? "",
                  })
                }
              >
                <Pencil className="h-4 w-4" /> Sửa
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Chủng loại theo HĐ */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-700">Chủng loại theo hợp đồng</h4>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              disabled={!coBaoGia || pending}
              title={coBaoGia ? undefined : "Dự án chưa có báo giá gửi khách"}
              onClick={copyFromQuote}
            >
              <Download className="h-4 w-4" /> Lấy từ báo giá
            </Button>
          )}
        </div>
        {specs.length === 0 && !specDraft && (
          <p className="text-sm text-slate-400">Chưa có chủng loại vật tư</p>
        )}
        {specs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1 pr-2">Nhóm</th>
                  <th className="py-1 pr-2">Tên</th>
                  <th className="py-1 pr-2">Thông số</th>
                  <th className="py-1 pr-2">Xuất xứ</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {specs.map((s, i) => (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-2 text-slate-500">
                      {s.tag ? (VAT_TU_TAG_MAP[s.tag]?.label ?? s.tag) : "Dùng chung"}
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-900">{s.name}</td>
                    <td className="py-1.5 pr-2">{s.spec ?? ""}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{s.origin ?? ""}</td>
                    {canEdit && (
                      <td className="whitespace-nowrap py-1 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Lên"
                          disabled={pending || i === 0}
                          onClick={() => run(() => moveMaterialSpec(projectId, s.id, -1))}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Xuống"
                          disabled={pending || i === specs.length - 1}
                          onClick={() => run(() => moveMaterialSpec(projectId, s.id, 1))}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Sửa"
                          onClick={() =>
                            setSpecDraft({
                              id: s.id,
                              tag: s.tag ?? "",
                              name: s.name,
                              spec: s.spec ?? "",
                              origin: s.origin ?? "",
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Xoá"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Xoá "${s.name}"?`))
                              run(() => deleteMaterialSpec(projectId, s.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {specForm}
        {canEdit && !specDraft && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSpecDraft({ tag: "", name: "", spec: "", origin: "" })}
          >
            <Plus className="h-4 w-4" /> Thêm dòng
          </Button>
        )}
      </div>

      {/* Đơn mua */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">Đơn mua vật tư</h4>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có đơn đặt hàng</p>
        ) : (
          orderGroups.flatMap((g) =>
            g.rows.map((o) => {
              const cat = PO_CATEGORY_MAP[o.category];
              const st = PO_STATUS_MAP[o.status];
              const tre =
                o.status !== "RECEIVED" &&
                o.expectedDate != null &&
                soNgay(nowMs, Date.parse(o.expectedDate)) < 0;
              return (
                <div
                  key={o.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                    tre ? "border border-red-200 bg-red-50" : "bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={cat?.tone ?? "slate"}>{cat?.label ?? o.category}</Badge>
                    <Badge tone={st?.tone ?? "slate"}>{st?.label ?? o.status}</Badge>
                    <span className="text-slate-600">{o.supplierName ?? "Chưa gán NCC"}</span>
                  </div>
                  <div className="text-slate-600">
                    {formatNumber(o.totalWeight)} kg
                    {o.value != null && (
                      <>
                        <span className="mx-1.5 text-slate-300">·</span>
                        {formatVND(o.value)}
                      </>
                    )}
                    <span className="mx-1.5 text-slate-300">·</span>
                    {o.receivedDate
                      ? `Đã giao ${formatDate(o.receivedDate)}`
                      : `Dự kiến ${formatDate(o.expectedDate)}`}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
