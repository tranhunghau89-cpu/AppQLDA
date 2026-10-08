"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { luuDoanChu, type DoanChu } from "./actions";
import { O_CO_SAN } from "@/components/ui/kieuO";
import type { ChuBaoGia } from "@/lib/quoteOwner";

/**
 * Một đoạn chữ in ra (lời mở đầu, ghi chú, lời kết) đặt đúng chỗ nó nằm trên bản in và
 * sửa thẳng tại chỗ — rời ô là lưu. Không có quyền sửa thì chỉ hiện chữ.
 */
export function DoanChuSua({
  chu,
  quoteId,
  truong,
  nhan,
  giaTri,
  canEdit,
  className,
}: {
  chu: ChuBaoGia;
  quoteId: string;
  truong: DoanChu;
  nhan: string;
  giaTri: string | null;
  canEdit: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [noiDung, setNoiDung] = useState(giaTri ?? "");
  const [goc, setGoc] = useState(giaTri ?? "");
  const [pending, start] = useTransition();

  // Dữ liệu từ máy chủ đổi (sửa qua hộp thoại) thì ô đi theo.
  if ((giaTri ?? "") !== goc) {
    setGoc(giaTri ?? "");
    setNoiDung(giaTri ?? "");
  }

  if (!canEdit) {
    return giaTri ? (
      <div className={className}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {nhan}
        </p>
        <p className="whitespace-pre-line text-sm text-slate-700">{giaTri}</p>
      </div>
    ) : null;
  }

  function luu() {
    if (noiDung.trim() === (giaTri ?? "").trim()) return;
    start(async () => {
      const r = await luuDoanChu(chu, quoteId, truong, noiDung);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  const soDong = Math.max(
    1,
    noiDung.split("\n").length + Math.floor(noiDung.length / 110),
  );

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {nhan}
        {pending && (
          <span className="ml-2 normal-case text-slate-400">đang lưu…</span>
        )}
      </p>
      <textarea
        value={noiDung}
        rows={soDong}
        onChange={(e) => setNoiDung(e.target.value)}
        onBlur={luu}
        placeholder="Để trống = không in"
        className={
          "w-full resize-y rounded-md border px-2 py-1 text-sm focus:border-blue-400 focus:outline-none " +
          O_CO_SAN
        }
      />
    </div>
  );
}
