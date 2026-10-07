"use client";

import { useEffect, useState, useTransition } from "react";
import { BookmarkPlus, X } from "lucide-react";
import { Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { danhSachMoTaMau, luuMoTaMau, xoaMoTaMau, type MoTaMauView } from "./moTaMauActions";

/**
 * Ô "mô tả riêng" kèm thư viện mẫu: bấm một mẫu để điền vào ô, "Lưu làm mẫu" để giữ
 * đoạn đang gõ cho lần sau. Mẫu dùng chung cả công ty.
 *
 * Danh sách nạp khi ô được dựng (hộp thoại mở) — không bắt mọi trang báo giá truyền
 * thêm một prop chỉ để phục vụ một hộp thoại.
 */
export function MoTaRieng({ defaultValue }: { defaultValue: string }) {
  const toast = useToast();
  const [noiDung, setNoiDung] = useState(defaultValue);
  const [mau, setMau] = useState<MoTaMauView[] | null>(null);
  const [pending, start] = useTransition();

  const nap = () => danhSachMoTaMau().then(setMau);
  useEffect(() => {
    nap();
  }, []);

  function luu() {
    start(async () => {
      const r = await luuMoTaMau(noiDung);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Đã lưu làm mẫu.");
        await nap();
      }
    });
  }

  function xoa(id: string) {
    start(async () => {
      const r = await xoaMoTaMau(id);
      if (!r.ok) toast.error(r.error);
      else await nap();
    });
  }

  const daCo = mau?.some((m) => m.noiDung === noiDung.split("\n").map((d) => d.trim()).filter(Boolean).join("\n"));

  return (
    <div className="space-y-2">
      {mau && mau.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Chọn nhanh từ mẫu đã lưu:</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {mau.map((m) => (
              <li
                key={m.id}
                className="group flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs hover:border-blue-400 hover:bg-blue-50"
              >
                <button
                  type="button"
                  className="flex-1 whitespace-pre-line text-left text-slate-700"
                  onClick={() => setNoiDung(m.noiDung)}
                  title={m.createdByName ? `Lưu bởi ${m.createdByName}` : undefined}
                >
                  {m.noiDung}
                </button>
                {m.xoaDuoc && (
                  <button
                    type="button"
                    aria-label="Xóa mẫu"
                    title="Xóa mẫu"
                    className="text-slate-400 hover:text-red-600"
                    disabled={pending}
                    onClick={() => xoa(m.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Textarea
        name="detail"
        rows={3}
        value={noiDung}
        onChange={(e) => setNoiDung(e.target.value)}
        placeholder={
          "- Gia công sản xuất theo bản vẽ thiết kế.\n" +
          "- Tôn mái là tôn Đông Á dày 0,45 mm mạ màu, 5 sóng công nghiệp."
        }
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !noiDung.trim() || daCo}
          onClick={luu}
        >
          <BookmarkPlus className="h-3.5 w-3.5" /> {daCo ? "Đã có trong mẫu" : "Lưu làm mẫu"}
        </Button>
      </div>
    </div>
  );
}
