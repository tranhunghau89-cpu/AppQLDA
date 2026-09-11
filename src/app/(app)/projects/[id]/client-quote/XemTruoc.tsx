"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Xem trước bản in ngay trong app, không phải mở tab khác rồi bấm quay lại.
 *
 * Nhúng thẳng trang in thật bằng iframe chứ KHÔNG dựng lại giao diện tờ giấy ở đây.
 * Dựng lại là có hai bản bố cục cho cùng một văn bản: sửa một bên thì bên kia nói dối,
 * mà bên nói dối lại chính là bên người lập nhìn trước khi gửi cho khách.
 *
 * Khung rộng đúng 210mm — khổ A4 — nên chỗ xuống dòng trên màn hình đúng bằng chỗ
 * xuống dòng trên giấy.
 */
export function XemTruoc({
  quoteId,
  tieuDe,
  onClose,
}: {
  quoteId: string;
  tieuDe: string;
  onClose: () => void;
}) {
  const khung = useRef<HTMLIFrameElement>(null);
  const [dangTai, setDangTai] = useState(true);
  // `xem=1` bỏ thanh công cụ của trang in — trong khung xem trước thì nút "quay lại"
  // và nút in của nó là thừa, hộp thoại này đã có sẵn hai nút ở chân.
  const duongDan = `/bao-gia/${quoteId}/print?xem=1`;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Xem trước bản in — ${tieuDe}`}
      footer={
        <>
          <Link
            href={duongDan.replace("?xem=1", "")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Mở tab mới
          </Link>
          <Button
            onClick={() => {
              // In nội dung của iframe, không phải trang nền phía sau.
              khung.current?.contentWindow?.focus();
              khung.current?.contentWindow?.print();
            }}
          >
            <Printer className="h-4 w-4" aria-hidden="true" /> In / Lưu PDF
          </Button>
        </>
      }
    >
      <div className="relative -mx-1 overflow-x-auto rounded-lg bg-slate-100">
        {dangTai && (
          <p className="absolute inset-x-0 top-16 text-center text-sm text-slate-400">
            Đang dựng bản in…
          </p>
        )}
        <iframe
          ref={khung}
          src={duongDan}
          title="Xem trước bản in"
          onLoad={() => setDangTai(false)}
          className="mx-auto block h-[68vh] w-[230mm] border-0 bg-transparent"
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Đây đúng là trang sẽ in ra. Trong hộp thoại in, chọn <strong>Lưu thành PDF</strong>{" "}
        và tắt phần đầu/chân trang của trình duyệt.
      </p>
    </Modal>
  );
}
