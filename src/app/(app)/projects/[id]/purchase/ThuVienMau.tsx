"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, LibraryBig, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { PO_CATEGORY_MAP } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { luuMauDonHang, taoDonTuMau, xoaMauDonHang } from "./actions";

/** Một đơn hàng mẫu trong thư viện. */
export interface MauView {
  id: string;
  name: string;
  category: string;
  soDong: number;
  /** Tên các nhóm vật tư trong mẫu — để nhận ra mẫu mà không cần mở. */
  nhom: string[];
  createdAt: string;
}

/** Nút "Tạo từ mẫu": chọn một mẫu trong thư viện → thêm đơn nháp cho dự án này. */
export function NutTaoTuMau({
  projectId,
  mau,
}: {
  projectId: string;
  mau: MauView[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [mo, setMo] = useState(false);
  const [chon, setChon] = useState<string | null>(null);
  const [giuSL, setGiuSL] = useState(false);
  const [dangLuu, start] = useTransition();

  function tao() {
    if (!chon) return;
    start(async () => {
      const res = await taoDonTuMau(projectId, chon, giuSL);
      if (!res.ok) toast.error(res.error);
      else {
        setMo(false);
        router.refresh();
      }
    });
  }
  async function xoa(m: MauView) {
    if (
      !(await confirm(
        `Xoá mẫu "${m.name}" khỏi thư viện? Các đơn đã tạo từ mẫu không bị ảnh hưởng.`,
      ))
    )
      return;
    start(async () => {
      const res = await xoaMauDonHang(projectId, m.id);
      if (!res.ok) toast.error(res.error);
      else {
        if (chon === m.id) setChon(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setMo(true)}>
        <LibraryBig className="h-4 w-4" /> Tạo từ mẫu
      </Button>
      <Modal
        open={mo}
        onClose={() => setMo(false)}
        title="Thư viện đơn hàng mẫu"
      >
        {mau.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            Chưa có mẫu nào. Mở một đơn hàng có sẵn, bấm{" "}
            <BookmarkPlus className="inline h-4 w-4" /> <b>Lưu làm mẫu</b> để
            thêm vào thư viện.
          </p>
        ) : (
          <div className="space-y-3">
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {mau.map((m) => {
                const cat = PO_CATEGORY_MAP[m.category];
                return (
                  <li key={m.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition",
                        chon === m.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="mau"
                        className="mt-1"
                        checked={chon === m.id}
                        onChange={() => setChon(m.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <Badge tone={cat?.tone ?? "slate"}>
                            {cat?.label ?? m.category}
                          </Badge>
                          <span className="font-medium text-slate-900">
                            {m.name}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {m.soDong} dòng · {m.nhom.join(", ") || "—"} · lưu{" "}
                          {formatDate(m.createdAt)}
                        </span>
                      </span>
                      <button
                        type="button"
                        title="Xoá mẫu"
                        aria-label="Xoá mẫu"
                        onClick={(e) => {
                          e.preventDefault();
                          xoa(m);
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </label>
                  </li>
                );
              })}
            </ul>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={giuSL}
                onChange={(e) => setGiuSL(e.target.checked)}
              />
              Giữ số lượng và trọng lượng của mẫu
              <span className="text-xs text-slate-400">
                (bỏ chọn = chỉ lấy khung nhóm, quy cách, mã)
              </span>
            </label>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => setMo(false)}>
            Đóng
          </Button>
          {mau.length > 0 && (
            <Button type="button" disabled={!chon || dangLuu} onClick={tao}>
              {dangLuu ? "Đang tạo…" : "Tạo đơn nháp"}
            </Button>
          )}
        </div>
      </Modal>
    </>
  );
}

/** Nút "Lưu làm mẫu" trên đầu mỗi đơn hàng. */
export function NutLuuMau({
  projectId,
  orderId,
  tenGoiY,
}: {
  projectId: string;
  orderId: string;
  tenGoiY: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mo, setMo] = useState(false);
  const [ten, setTen] = useState(tenGoiY);
  const [dangLuu, start] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Lưu làm mẫu"
        aria-label="Lưu làm mẫu"
        onClick={() => {
          setTen(tenGoiY);
          setMo(true);
        }}
      >
        <BookmarkPlus className="h-4 w-4" />
      </Button>
      <Modal
        open={mo}
        onClose={() => setMo(false)}
        title="Lưu đơn hàng làm mẫu"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await luuMauDonHang(projectId, orderId, ten);
              if (!res.ok) toast.error(res.error);
              else {
                setMo(false);
                toast.success("Đã lưu vào thư viện đơn hàng mẫu.");
                router.refresh();
              }
            });
          }}
          className="space-y-3"
        >
          <Field label="Tên mẫu *">
            <Input
              value={ten}
              onChange={(e) => setTen(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <p className="text-xs text-slate-500">
            Chép mọi nhóm, quy cách, mã, SL, chiều dài, kg, đơn giá. Không chép
            ảnh biên dạng và phần gắn dự toán.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMo(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={dangLuu}>
              {dangLuu ? "Đang lưu…" : "Lưu mẫu"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
