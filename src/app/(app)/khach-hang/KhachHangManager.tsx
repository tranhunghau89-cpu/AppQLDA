"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { InteractionLog, type NoteView } from "@/components/crm/InteractionLog";
import { KHACH_NGUON_MAP } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { deleteKhachHang } from "./actions";
import { KhachHangModal } from "./KhachHangModal";
import { CoHoiPanel, type CoHoiRow } from "./CoHoiPanel";

export interface NhanVien {
  id: string;
  name: string;
  role: string;
}

export interface KhachHangRow {
  id: string;
  tenCty: string;
  nguoiLienHe: string | null;
  phone: string | null;
  email: string | null;
  diaChi: string | null;
  nguon: string | null;
  ownerId: string | null;
  ownerName: string | null;
  note: string | null;
  customerId: string | null;
  customerName: string | null;
  /** Ngày hẹn liên hệ lại gần nhất trong nhật ký — để biết ai đang chờ mình gọi. */
  henGanNhat: string | null;
  notes: NoteView[];
  coHoi: CoHoiRow[];
}

export function KhachHangManager({
  khach,
  nhanVien,
  canEdit,
  laAdmin,
}: {
  khach: KhachHangRow[];
  nhanVien: NhanVien[];
  canEdit: boolean;
  laAdmin: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [mo, setMo] = useState<{ editing: KhachHangRow | null } | null>(null);
  const [moRong, setMoRong] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setMoRong((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function onDelete(k: KhachHangRow) {
    if (
      !(await confirm(
        `Xóa khách "${k.tenCty}"? Toàn bộ nhật ký trao đổi của khách này cũng mất theo.`
      ))
    )
      return;
    start(async () => {
      const res = await deleteKhachHang(k.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  const soCot = canEdit ? 6 : 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{khach.length} khách</p>
        {canEdit && (
          <Button size="sm" onClick={() => setMo({ editing: null })}>
            <Plus className="h-4 w-4" /> Thêm khách
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Khách</Th>
              <Th>Người liên hệ</Th>
              <Th>Điện thoại</Th>
              <Th>Nguồn</Th>
              <Th>Phụ trách</Th>
              {canEdit && <Th className="text-right">Thao tác</Th>}
            </tr>
          </THead>
          <tbody>
            {khach.length === 0 && (
              <Tr>
                <Td colSpan={soCot} className="py-10 text-center text-slate-400">
                  Chưa có khách nào. Bấm “Thêm khách” để bắt đầu theo một đầu mối mới —
                  chưa cần dự án, chưa cần mã gì cả.
                </Td>
              </Tr>
            )}

            {khach.map((k) => {
              const dangMo = moRong.has(k.id);
              const nguon = k.nguon ? KHACH_NGUON_MAP[k.nguon] : null;
              return (
                <Manh key={k.id}>
                  <Tr>
                    <Td className="font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => toggle(k.id)}
                        className="inline-flex items-center gap-1 text-left hover:text-blue-600"
                      >
                        {dangMo ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        {k.tenCty}
                        {k.notes.length > 0 && (
                          <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-xs font-normal text-slate-500">
                            {k.notes.length}
                          </span>
                        )}
                      </button>
                      {k.customerName && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-green-700">
                          <Building2 className="h-3 w-3" />
                          Đã thành CĐT: {k.customerName}
                        </span>
                      )}
                      {k.henGanNhat && (
                        <span className="mt-0.5 block text-xs font-normal text-amber-700">
                          Hẹn liên hệ lại {formatDate(k.henGanNhat)}
                        </span>
                      )}
                    </Td>
                    <Td>{k.nguoiLienHe || "—"}</Td>
                    <Td>{k.phone || "—"}</Td>
                    <Td>
                      {nguon ? (
                        <Badge tone={nguon.tone ?? "slate"}>{nguon.label}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td className="text-slate-600">
                      {k.ownerName ?? <span className="text-amber-700">Chưa phân công</span>}
                    </Td>
                    {canEdit && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Sửa khách"
                            onClick={() => setMo({ editing: k })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50"
                            aria-label="Xóa khách"
                            onClick={() => onDelete(k)}
                            disabled={pending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>

                  {dangMo && (
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <td colSpan={soCot} className="px-4 py-3">
                        {k.note && (
                          <p className="mb-3 whitespace-pre-line text-sm text-slate-600">
                            {k.note}
                          </p>
                        )}
                        <div className="mb-4">
                          <CoHoiPanel
                            khachHangId={k.id}
                            coHoi={k.coHoi}
                            canEdit={canEdit}
                          />
                        </div>
                        <InteractionLog
                          chu={{ loai: "KHACH", id: k.id }}
                          notes={k.notes}
                          canEdit={canEdit}
                          trong
                        />
                      </td>
                    </tr>
                  )}
                </Manh>
              );
            })}
          </tbody>
        </Table>
      </div>

      {mo && (
        <KhachHangModal
          editing={mo.editing}
          nhanVien={nhanVien}
          laAdmin={laAdmin}
          onClose={() => setMo(null)}
          onDone={() => {
            setMo(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** `<tbody>` chỉ nhận `<tr>`, nên nhóm hai hàng bằng một fragment có khóa. */
function Manh({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
