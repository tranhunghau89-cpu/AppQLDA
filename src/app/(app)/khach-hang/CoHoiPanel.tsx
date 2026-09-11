"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Building,
  Calculator,
  FileText,
  Handshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { CO_HOI_TRANG_THAI_MAP } from "@/lib/constants";
import { formatQty } from "@/lib/utils";
import { deleteCoHoi } from "./coHoiActions";
import { CoHoiModal } from "./CoHoiModal";
import { ChuyenDuAnModal } from "./ChuyenDuAnModal";
import type { ChuDauTuCoSan } from "@/lib/coHoiChuyenDuAn";

export interface CoHoiRow {
  id: string;
  tenCongTrinh: string;
  diaDiem: string | null;
  buildingType: string | null;
  area: number | null;
  kK: number | null;
  kL: number | null;
  kH: number | null;
  trangThai: string;
  lyDoMat: string | null;
  note: string | null;
  projectId: string | null;
  projectCode: string | null;
  soDuToan: number;
  soBaoGia: number;
  /** Bao nhiêu bản báo giá đã chốt — dưới 1 thì chưa tạo dự án được. */
  soBaoGiaChot: number;
}

/** Danh sách công trình đang chào giá của một khách. */
export function CoHoiPanel({
  khachHangId,
  tenKhach,
  coHoi,
  canEdit,
  chuDauTu,
  canTaoDuAn,
}: {
  khachHangId: string;
  tenKhach: string;
  coHoi: CoHoiRow[];
  canEdit: boolean;
  /** Chủ đầu tư đã có, để áp vào khi ký; rỗng nếu người này không tạo được dự án. */
  chuDauTu: ChuDauTuCoSan[];
  canTaoDuAn: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [mo, setMo] = useState<{ editing: CoHoiRow | null } | null>(null);
  const [chuyen, setChuyen] = useState<CoHoiRow | null>(null);

  async function onDelete(c: CoHoiRow) {
    if (!(await confirm(`Xóa công trình chào giá "${c.tenCongTrinh}"?`))) return;
    start(async () => {
      const res = await deleteCoHoi(c.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">
          Công trình chào giá ({coHoi.length})
        </span>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setMo({ editing: null })}>
            <Plus className="h-4 w-4" /> Thêm công trình
          </Button>
        )}
      </div>

      {coHoi.length === 0 ? (
        <p className="text-sm text-slate-400">
          Chưa có công trình nào. Thêm một cái để bắt đầu chào giá — vẫn chưa cần mã dự án.
        </p>
      ) : (
        <ul className="space-y-2">
          {coHoi.map((c) => {
            const tt = CO_HOI_TRANG_THAI_MAP[c.trangThai];
            const thongSo = [
              c.area != null ? `${formatQty(c.area)} m²` : null,
              c.kK != null || c.kL != null || c.kH != null
                ? `K${c.kK ?? "?"} · L${c.kL ?? "?"} · H${c.kH ?? "?"}`
                : null,
              c.buildingType,
              c.diaDiem,
            ].filter(Boolean);

            return (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-900">{c.tenCongTrinh}</span>
                    <Badge tone={tt?.tone ?? "slate"}>{tt?.label ?? c.trangThai}</Badge>
                  </div>
                  {thongSo.length > 0 && (
                    <p className="mt-0.5 text-sm text-slate-500">{thongSo.join(" · ")}</p>
                  )}
                  {c.trangThai === "MAT" && c.lyDoMat && (
                    <p className="mt-0.5 text-sm text-red-700">Lý do: {c.lyDoMat}</p>
                  )}
                  {c.projectId && (
                    <Link
                      href={`/projects/${c.projectId}`}
                      className="mt-0.5 block text-sm text-blue-600 hover:underline"
                    >
                      Đã thành dự án {c.projectCode}
                    </Link>
                  )}
                  {c.note && (
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{c.note}</p>
                  )}
                  {/* Cả hai bản sống ngay ở cơ hội — chưa cần mã dự án nào. Ký hợp
                      đồng rồi thì chúng đã theo sang dự án, không còn ở đây. */}
                  {!c.projectId && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Link
                      href={`/co-hoi/${c.id}/quote`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                    >
                      <Calculator className="h-3.5 w-3.5" />
                      {c.soDuToan > 0
                        ? `Dự toán chi tiết (${c.soDuToan})`
                        : "Lập dự toán chi tiết"}
                    </Link>
                    <Link
                      href={`/co-hoi/${c.id}/client-quote`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {c.soBaoGia > 0
                        ? `Báo giá gửi khách (${c.soBaoGia})`
                        : "Lập báo giá gửi khách"}
                    </Link>
                  </div>
                  )}

                  {/* Mã dự án chỉ sinh ở đây, và chỉ khi đã có bản báo giá được chốt. */}
                  {canTaoDuAn && !c.projectId && c.trangThai !== "MAT" && (
                    <div className="mt-2">
                      {c.soBaoGiaChot > 0 ? (
                        <Button size="sm" onClick={() => setChuyen(c)}>
                          <Handshake className="h-4 w-4" /> Đã ký hợp đồng — tạo dự án
                        </Button>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Chốt một bản báo giá gửi khách rồi mới tạo được dự án.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sửa công trình"
                      onClick={() => setMo({ editing: c })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                      aria-label="Xóa công trình"
                      onClick={() => onDelete(c)}
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mo && (
        <CoHoiModal
          khachHangId={khachHangId}
          editing={mo.editing}
          onClose={() => setMo(null)}
          onDone={() => {
            setMo(null);
            router.refresh();
          }}
        />
      )}

      {chuyen && (
        <ChuyenDuAnModal
          coHoi={chuyen}
          tenKhach={tenKhach}
          chuDauTu={chuDauTu}
          onClose={() => setChuyen(null)}
        />
      )}
    </div>
  );
}
