"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { banDuToanLamMauDuoc, laySuatTuDuToan, type BanDuToanLamMau } from "./actions";

/**
 * Dựng thư viện khối lượng từ một công trình ĐÃ LÀM.
 *
 * Rẻ hơn nhiều so với gõ tay 90 dòng, và con số có căn cứ: suất = khối lượng thật ÷
 * diện tích thật của từng phần. Chọn một nhà đã làm gần giống về khẩu độ và nhịp thì
 * suất rút ra dùng được ngay cho nhà mới.
 */
export function LaySuatModal({
  boHangMucId,
  tenBo,
  onClose,
}: {
  boHangMucId: string;
  tenBo: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [dsMau, setDsMau] = useState<BanDuToanLamMau[] | null>(null);
  const [chon, setChon] = useState("");
  const [loi, setLoi] = useState<string | null>(null);

  useEffect(() => {
    let con = true;
    banDuToanLamMauDuoc(boHangMucId)
      .then((ds) => {
        if (!con) return;
        setDsMau(ds);
        setChon(ds[0]?.id ?? "");
      })
      .catch(() => con && setLoi("Không đọc được danh sách bản dự toán."));
    return () => {
      con = false;
    };
  }, [boHangMucId]);

  function chay() {
    if (!chon) return;
    setLoi(null);
    start(async () => {
      const res = await laySuatTuDuToan(boHangMucId, chon);
      if (!res.ok) {
        setLoi(res.error);
        return;
      }
      for (const c of res.data.canhBao) toast.info(c);
      toast.success(
        `Đã gán suất cho ${res.data.daGan} dòng` +
          (res.data.boQua > 0 ? `, ${res.data.boQua} dòng không khớp được.` : ".")
      );
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Lấy suất khối lượng — ${tenBo}`} size="lg">
      <div className="space-y-3">
        {dsMau === null && <p className="text-sm text-slate-500">Đang tìm bản dự toán dùng được…</p>}

        {dsMau !== null && dsMau.length === 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Chưa có bản dự toán nào dùng làm mẫu được. Bản mẫu phải có ít nhất một{" "}
            <strong>phần khai diện tích</strong> và mã phần trùng với bộ này — suất là
            phép chia cho diện tích, không có diện tích thì không rút được gì.
          </p>
        )}

        {dsMau !== null && dsMau.length > 0 && (
          <>
            <Field label="Lấy từ bản dự toán">
              <Select value={chon} onChange={(e) => setChon(e.target.value)}>
                {dsMau.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nhan} — {m.soPhanCoDienTich} phần có diện tích, {m.soDong} dòng
                  </option>
                ))}
              </Select>
            </Field>

            <ul className="space-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <li>
                Suất = <strong>khối lượng ÷ diện tích của chính phần đó</strong>, khớp
                theo cặp (mã phần, mã công tác).
              </li>
              <li>
                Suất cũ trong bộ sẽ bị <strong>ghi đè</strong> ở những dòng khớp được.
                Chạy lại với công trình khác là ra bộ số khác.
              </li>
            </ul>

            <p className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Chọn công trình gần giống về nhịp và khẩu độ. Suất thép của nhà 25m khác
                hẳn nhà 10m, và phép chia không biết điều đó.
              </span>
            </p>
          </>
        )}

        {loi && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{loi}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" onClick={chay} disabled={!chon}>
            Lấy suất
          </Button>
        </div>
      </div>
    </Modal>
  );
}
