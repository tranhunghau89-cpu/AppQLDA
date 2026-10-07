"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { CLIENT_QUOTE_STATUS_MAP } from "@/lib/constants";
import { setClientQuoteStatus } from "../../../projects/[id]/client-quote/actions";

interface BaoGiaGui {
  id: string;
  quoteNo: string | null;
  title: string;
  status: string;
  sentDate: string | null;
}

/** Bước cuối: in từng báo giá ra PDF rồi đánh dấu đã gửi. */
export function GuiKhach({
  coHoiId,
  canEdit,
  baoGia,
}: {
  coHoiId: string;
  canEdit: boolean;
  baoGia: BaoGiaGui[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  function danhDauDaGui(id: string) {
    start(async () => {
      const res = await setClientQuoteStatus({ loai: "CO_HOI", id: coHoiId }, id, "DA_GUI");
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  if (baoGia.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có báo giá nào có hạng mục.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {baoGia.map((q) => {
        const st = CLIENT_QUOTE_STATUS_MAP[q.status];
        return (
          <li key={q.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">
                  {q.quoteNo ? `${q.quoteNo} — ` : ""}
                  {q.title}
                </span>
                <Badge tone={st?.tone ?? "slate"}>{st?.label ?? q.status}</Badge>
              </div>
              {q.sentDate && (
                <p className="text-xs text-slate-500">
                  Gửi ngày {new Date(q.sentDate).toLocaleDateString("vi-VN")}
                </p>
              )}
            </div>
            <a
              href={`/bao-gia/${q.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Xem bản in / PDF
            </a>
            {canEdit && q.status === "NHAP" && (
              <Button size="sm" disabled={pending} onClick={() => danhDauDaGui(q.id)}>
                <Send className="h-4 w-4" /> Đánh dấu đã gửi
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
