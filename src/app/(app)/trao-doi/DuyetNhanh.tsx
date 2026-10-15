"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { duyetNhanh } from "./actions";

/** Nút Đồng ý / Cần sửa dưới một tin "Xin duyệt" còn chờ trong hộp thư. */
export function DuyetNhanh({ traoDoiId }: { traoDoiId: string }) {
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);
  const [dang, start] = useTransition();

  function quyet(q: "DONG_Y" | "CAN_SUA") {
    setLoi(null);
    start(async () => {
      const r = await duyetNhanh(traoDoiId, q, ghiChu);
      if (r.ok) setXong(q === "DONG_Y" ? "Đã đồng ý." : "Đã trả lại để sửa.");
      else setLoi(r.error);
    });
  }

  if (xong) return <p className="px-4 pb-3 text-sm font-medium text-green-700">{xong}</p>;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      <input
        value={ghiChu}
        onChange={(e) => setGhiChu(e.target.value)}
        placeholder="Ghi chú (bắt buộc khi Cần sửa)"
        maxLength={2000}
        className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-sm"
      />
      <Button size="sm" disabled={dang} onClick={() => quyet("DONG_Y")}>
        Đồng ý
      </Button>
      <Button size="sm" variant="outline" disabled={dang} onClick={() => quyet("CAN_SUA")}>
        Cần sửa
      </Button>
      {loi && <p className="w-full text-sm text-red-600">{loi}</p>}
    </div>
  );
}
