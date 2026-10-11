"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { useToast } from "@/components/ui/toast";
import { formatQty } from "@/lib/utils";
import { ModalActions } from "./ModalActions";
import { generateFromQuote } from "../client-quote/actions";
import { TemplatePicker } from "../client-quote/TemplatePicker";
import type { TemplateOption } from "@/lib/quoteTemplatePick";
import { duongDanChu, type ChuBaoGia } from "@/lib/quoteOwner";
import type { QuoteView } from "./types";

export function GenerateClientQuoteModal({
  chu,
  quote,
  projectArea,
  templates,
  templateGoiY,
  onClose,
  sauKhiTao,
}: {
  chu: ChuBaoGia;
  quote: QuoteView;
  projectArea: number | null;
  templates: TemplateOption[];
  templateGoiY: string | null;
  onClose: () => void;
  /** Trang mở sau khi sinh xong — quy trình báo giá chuyển sang bước báo giá gửi khách. */
  sauKhiTao?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { error, pending, run } = useActionForm(() => {
    onClose();
    router.push(sauKhiTao ?? duongDanChu(chu).replace("/quote", "/client-quote"));
    router.refresh();
  });

  const phans = quote.sections.filter((s) => !s.parentId);
  // Phần không khai diện tích sẽ rơi về diện tích dự án; không có cả hai thì dòng đó
  // để trống đơn giá — báo trước ở đây thay vì để người dùng ngạc nhiên sau khi sinh.
  const [templateId, setTemplateId] = useState(templateGoiY ?? "");
  // Mẫu có khai hạng mục thì chọn hạng mục ở ô mẫu; không thì chọn thẳng các phần của
  // dự toán — mặc định tick phần nào đã có dòng công tác.
  const mauCoPhan = (templates.find((t) => t.id === templateId)?.phan?.length ?? 0) > 0;
  const [phanNguon, setPhanNguon] = useState<Set<string>>(
    () =>
      new Set(
        phans
          .filter((p) =>
            quote.items.some(
              (it) =>
                it.sectionId === p.id ||
                quote.sections.some((c) => c.parentId === p.id && c.id === it.sectionId),
            ),
          )
          .map((p) => p.code),
      ),
  );
  const thieuDienTich = phans.filter((s) => s.area == null && projectArea == null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(async () => {
      const res = await generateFromQuote(chu, quote.id, form);
      if (res.ok && res.warnings?.length) {
        for (const w of res.warnings) toast.info(w);
      }
      return res;
    });
  }

  return (
    <Modal open onClose={onClose} title="Tạo báo giá gửi khách">
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-500">
          Mỗi phần của báo giá chi tiết thành một hạng mục, đơn giá m² = tổng tiền phần đó
          chia cho diện tích. Bảng vật liệu và điều khoản được điền sẵn theo mẫu. Mẫu có
          khai sẵn hạng mục thì lấy hạng mục của mẫu, khớp với phần nguồn tương ứng.
        </p>

        <Field label="Tiêu đề">
          <Input name="title" defaultValue={`Báo giá gửi khách — ${quote.title}`} />
        </Field>

        <TemplatePicker
          templates={templates}
          goiY={templateGoiY}
          maTrongDuToan={[...phanNguon]}
          onDoiMau={setTemplateId}
        />

        {!mauCoPhan && (
          <>
            <input type="hidden" name="coChonNguon" value="1" />
            <input type="hidden" name="phanNguonCsv" value={[...phanNguon].join(",")} />
          </>
        )}

        <div className="rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {!mauCoPhan && <th className="w-8 px-3 py-2"></th>}
                <th className="px-3 py-2 text-left">
                  {mauCoPhan ? "Phần" : "Hạng mục đưa vào báo giá"}
                </th>
                <th className="px-3 py-2 text-right">Diện tích (m²)</th>
              </tr>
            </thead>
            <tbody>
              {phans.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  {!mauCoPhan && (
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${s.name}`}
                        checked={phanNguon.has(s.code)}
                        onChange={(e) =>
                          setPhanNguon((cu) => {
                            const moi = new Set(cu);
                            if (e.target.checked) moi.add(s.code);
                            else moi.delete(s.code);
                            return moi;
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-slate-700">
                    {s.code} — {s.name}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {s.area != null ? (
                      formatQty(s.area)
                    ) : projectArea != null ? (
                      <span className="text-slate-400">
                        {formatQty(projectArea)} (theo dự án)
                      </span>
                    ) : (
                      <span className="text-amber-600">chưa có</span>
                    )}
                  </td>
                </tr>
              ))}
              {phans.length === 0 && (
                <tr>
                  <td colSpan={3}className="px-3 py-4 text-center text-slate-400">
                    Dự toán chào giá chưa có phần nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {thieuDienTich.length > 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {thieuDienTich.length} phần chưa có diện tích và dự án cũng chưa khai — các hạng mục
            đó sẽ được tạo nhưng để trống đơn giá, điền tay sau.
          </p>
        )}

        <ModalActions
          error={error}
          pending={pending}
          onCancel={onClose}
          submitLabel="Tạo báo giá"
          pendingLabel="Đang tạo…"
        />
      </form>
    </Modal>
  );
}
