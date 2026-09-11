"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { CLIENT_QUOTE_STATUS } from "@/lib/constants";
import { formatDate, formatVND } from "@/lib/utils";
import { setClientQuoteStatus, pushSalePriceFromClientQuote } from "./actions";
import type { ClientQuoteView } from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

/**
 * Vòng đời một bản báo giá: trạng thái, ngày gửi, hạn hiệu lực, và nút đẩy giá bán.
 *
 * Nút "Đẩy giá bán" cố ý tách khỏi việc chuyển sang "Đã chốt" — ghi đè giá bán dự án
 * là con số mọi báo cáo lãi lỗ dựa vào, phải là một cái bấm có chủ ý.
 */
export function StatusBar({
  q,
  chu,
  canEdit,
  tongSauThue,
}: {
  q: ClientQuoteView;
  chu: ChuBaoGia;
  canEdit: boolean;
  tongSauThue: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  function doiTrangThai(status: string) {
    start(async () => {
      const res = await setClientQuoteStatus(chu, q.id, status);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  async function dayGiaBan() {
    if (
      !(await confirm(
        `Đặt giá bán dự án = ${formatVND(tongSauThue)} (tổng sau thuế của báo giá này)? Giá bán hiện tại sẽ bị ghi đè.`
      ))
    )
      return;
    start(async () => {
      const res = await pushSalePriceFromClientQuote(chu, q.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Đã cập nhật giá bán dự án.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm">
      {canEdit ? (
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Trạng thái</span>
          <Select
            value={q.status}
            disabled={pending}
            onChange={(e) => doiTrangThai(e.target.value)}
            className="w-44"
          >
            {CLIENT_QUOTE_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      <span className="text-slate-500">
        {q.sentDate ? (
          <>Đã gửi {formatDate(q.sentDate)}</>
        ) : (
          <>Chưa gửi</>
        )}
        {q.expiryDate && <> · hiệu lực đến {formatDate(q.expiryDate)}</>}
      </span>

      {q.status === "NHAP" && (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Send className="h-3.5 w-3.5" />
          Chuyển sang “Đã gửi” sẽ chốt cứng hạn hiệu lực.
        </span>
      )}

      {/* Chỉ dự án mới có ô giá bán để nhận; ở cơ hội thì chưa có gì để ghi vào. */}
      {canEdit && q.status === "CHOT" && chu.loai === "DU_AN" && (
        <Button variant="outline" size="sm" className="ml-auto" onClick={dayGiaBan} disabled={pending}>
          <Wallet className="h-3.5 w-3.5" /> Đẩy giá bán vào dự án
        </Button>
      )}

      {canEdit && q.status === "CHOT" && chu.loai === "CO_HOI" && (
        <span className="ml-auto text-xs text-slate-400">
          Khách đã chốt — tạo dự án ở khu Khách hàng để chuyển sang quản lý hợp đồng.
        </span>
      )}
    </div>
  );
}
