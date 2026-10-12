"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckCircle2, MessageSquare, PencilLine, Send, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { LOAI_TRAO_DOI_LABEL } from "@/lib/traoDoi";
import {
  guiTraoDoi,
  napTraoDoi,
  type DoiTuongTraoDoi,
  type LoaiTraoDoi,
  type NguoiDungChon,
  type TinTraoDoi,
} from "./actions";

const TONE: Record<LoaiTraoDoi, "slate" | "blue" | "amber" | "green"> = {
  GHI_CHU: "slate",
  XIN_DUYET: "blue",
  CAN_SUA: "amber",
  DONG_Y: "green",
};

const TRANG_THAI: Partial<Record<LoaiTraoDoi, string>> = {
  XIN_DUYET: "Đang chờ duyệt",
  CAN_SUA: "Cần chỉnh sửa",
  DONG_Y: "Đã được đồng ý — có thể gửi đi",
};

/**
 * Trao đổi nội bộ quanh MỘT việc (báo giá, dự toán): ghi chú, xin duyệt, yêu cầu
 * sửa, đồng ý. Tự nạp dữ liệu khi mở để không phải kéo luồng tin qua mọi trang cha.
 */
export function TraoDoi({
  doiTuong,
  doiTuongId,
  moSan = false,
}: {
  doiTuong: DoiTuongTraoDoi;
  doiTuongId: string;
  moSan?: boolean;
}) {
  const toast = useToast();
  const [mo, setMo] = useState(moSan);
  const [tin, setTin] = useState<TinTraoDoi[] | null>(null);
  const [nguoiDung, setNguoiDung] = useState<NguoiDungChon[]>([]);
  const [toiLa, setToiLa] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [noiDung, setNoiDung] = useState("");
  const [nhan, setNhan] = useState<string[]>([]);
  const [dangGui, startGui] = useTransition();

  const nap = useCallback(
    () =>
      napTraoDoi(doiTuong, doiTuongId).then((r) => {
        if (!r.ok) return setLoi(r.error);
        setTin(r.tin);
        setNguoiDung(r.nguoiDung);
        setToiLa(r.toiLa);
      }),
    [doiTuong, doiTuongId]
  );

  // Chỉ nạp khi mở: thẻ báo giá đóng thì không tốn truy vấn nào.
  useEffect(() => {
    if (mo) void nap();
  }, [mo, nap]);

  function gui(loai: LoaiTraoDoi) {
    startGui(async () => {
      const r = await guiTraoDoi(doiTuong, doiTuongId, { loai, noiDung, nguoiNhanIds: nhan });
      if (!r.ok) return toast.error(r.error);
      setNoiDung("");
      setNhan([]);
      await nap();
    });
  }

  const trangThai = [...(tin ?? [])].reverse().find((t) => TRANG_THAI[t.loai]);
  const khac = nguoiDung.filter((u) => u.id !== toiLa);

  return (
    <div className="border-t border-slate-100 p-4" id={`trao-doi-${doiTuongId}`}>
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-700"
      >
        <MessageSquare className="h-4 w-4 text-slate-400" />
        Trao đổi nội bộ
        {tin && tin.length > 0 && <span className="text-slate-400">({tin.length})</span>}
        {trangThai && (
          <Badge tone={TONE[trangThai.loai]} className="ml-1">
            {TRANG_THAI[trangThai.loai]}
          </Badge>
        )}
        <span className="ml-auto text-xs text-slate-400">{mo ? "Thu gọn" : "Mở"}</span>
      </button>

      {mo && (
        <div className="mt-3 space-y-3">
          {loi && <p className="text-sm text-red-600">{loi}</p>}
          {!tin && !loi && <p className="text-sm text-slate-400">Đang tải…</p>}
          {tin && tin.length === 0 && (
            <p className="text-sm text-slate-400">
              Chưa có trao đổi. Lập xong, chọn người quản lý rồi bấm “Gửi xin duyệt”.
            </p>
          )}
          {tin && tin.length > 0 && (
            <ul className="space-y-2">
              {tin.map((t) => (
                <li
                  key={t.id}
                  className={`rounded-md border p-3 text-sm ${
                    t.tacGiaId === toiLa ? "border-blue-100 bg-blue-50/50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-800">{t.tacGiaTen}</span>
                    {t.loai !== "GHI_CHU" && <Badge tone={TONE[t.loai]}>{LOAI_TRAO_DOI_LABEL[t.loai]}</Badge>}
                    {t.nguoiNhan.length > 0 && (
                      <span>
                        → {t.nguoiNhan.map((n) => `${n.ten}${n.daDoc ? " ✓" : ""}`).join(", ")}
                      </span>
                    )}
                    <span className="ml-auto">{new Date(t.createdAt).toLocaleString("vi-VN")}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">{t.noiDung}</p>
                </li>
              ))}
            </ul>
          )}

          {tin && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <textarea
                value={noiDung}
                onChange={(e) => setNoiDung(e.target.value)}
                rows={2}
                placeholder="Nội dung trao đổi (để trống khi bấm Xin duyệt / Đồng ý sẽ dùng câu mặc định)"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500">Gửi tới:</span>
                {khac.map((u) => {
                  const chon = nhan.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setNhan((s) => (chon ? s.filter((x) => x !== u.id) : [...s, u.id]))}
                      className={`rounded-full border px-2 py-0.5 ${
                        chon ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {u.name}
                    </button>
                  );
                })}
                <span className="text-slate-400">(không chọn = báo những người đã tham gia)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={dangGui} onClick={() => gui("GHI_CHU")}>
                  <Send className="mr-1 h-4 w-4" /> Gửi
                </Button>
                <Button size="sm" variant="outline" disabled={dangGui} onClick={() => gui("XIN_DUYET")}>
                  <UserCheck className="mr-1 h-4 w-4" /> Gửi xin duyệt
                </Button>
                <Button size="sm" variant="outline" disabled={dangGui} onClick={() => gui("CAN_SUA")}>
                  <PencilLine className="mr-1 h-4 w-4 text-amber-600" /> Yêu cầu chỉnh sửa
                </Button>
                <Button size="sm" variant="outline" disabled={dangGui} onClick={() => gui("DONG_Y")}>
                  <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" /> Đồng ý gửi
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
