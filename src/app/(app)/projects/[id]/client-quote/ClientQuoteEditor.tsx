"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientQuoteCard } from "./ClientQuoteCard";
import { HeaderModal, type GoiY } from "./HeaderModal";
import { LineModal, type LineModalState } from "./LineModal";
import { SpecModal, type SpecModalState } from "./SpecModal";
import { TermsModal, type TermsModalState } from "./TermsModal";
import type { TemplateOption } from "@/lib/quoteTemplatePick";
import type { ClientQuoteView, CustomerOption, LineView, SpecView } from "./types";

/**
 * Điều phối: giữ đúng một việc — hộp thoại nào đang mở và mở với bản ghi nào.
 * Mỗi hộp thoại chỉ được dựng khi mở nên state form tự khởi tạo lại theo bản ghi mới.
 */
export function ClientQuoteEditor({
  projectId,
  quotes,
  customers,
  canEdit,
  canViewCrm,
  canEditCrm,
  goiY,
  templates,
  templateGoiY,
}: {
  projectId: string;
  quotes: ClientQuoteView[];
  customers: CustomerOption[];
  canEdit: boolean;
  canViewCrm: boolean;
  canEditCrm: boolean;
  goiY: GoiY;
  templates: TemplateOption[];
  templateGoiY: string | null;
}) {
  const router = useRouter();
  const [headerModal, setHeaderModal] = useState<{ editing: ClientQuoteView | null } | null>(null);
  const [lineModal, setLineModal] = useState<LineModalState | null>(null);
  const [specModal, setSpecModal] = useState<SpecModalState | null>(null);
  const [termsModal, setTermsModal] = useState<TermsModalState | null>(null);

  function closeAll() {
    setHeaderModal(null);
    setLineModal(null);
    setSpecModal(null);
    setTermsModal(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setHeaderModal({ editing: null })}>
            <Plus className="h-4 w-4" /> Lập báo giá
          </Button>
        </div>
      )}

      {quotes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Chưa có báo giá gửi khách nào — bấm “Lập báo giá”.
          <br />
          <span className="text-xs">
            Bảng vật liệu, tiến độ thi công và tiến độ thanh toán sẽ được điền sẵn theo mẫu.
          </span>
        </div>
      )}

      {quotes.map((q) => (
        <ClientQuoteCard
          key={q.id}
          q={q}
          projectId={projectId}
          canEdit={canEdit}
          canViewCrm={canViewCrm}
          canEditCrm={canEditCrm}
          onEdit={() => setHeaderModal({ editing: q })}
          onAddLine={() => setLineModal({ quoteId: q.id, editing: null })}
          onEditLine={(l: LineView) => setLineModal({ quoteId: q.id, editing: l })}
          onAddSpec={(groupCode) =>
            setSpecModal({ quoteId: q.id, editing: null, defaultGroup: groupCode })
          }
          onEditSpec={(s: SpecView) =>
            setSpecModal({ quoteId: q.id, editing: s, defaultGroup: s.groupCode })
          }
          onEditTerms={() =>
            setTermsModal({ quoteId: q.id, stages: q.stages, payments: q.payments })
          }
        />
      ))}

      {headerModal && (
        <HeaderModal
          projectId={projectId}
          editing={headerModal.editing}
          customers={customers}
          goiY={goiY}
          templates={templates}
          templateGoiY={templateGoiY}
          onClose={() => setHeaderModal(null)}
          onDone={closeAll}
        />
      )}

      {lineModal && (
        <LineModal
          projectId={projectId}
          state={lineModal}
          onClose={() => setLineModal(null)}
          onDone={closeAll}
        />
      )}

      {specModal && (
        <SpecModal
          projectId={projectId}
          state={specModal}
          onClose={() => setSpecModal(null)}
          onDone={closeAll}
        />
      )}

      {termsModal && (
        <TermsModal
          projectId={projectId}
          state={termsModal}
          onClose={() => setTermsModal(null)}
          onDone={closeAll}
        />
      )}
    </div>
  );
}
