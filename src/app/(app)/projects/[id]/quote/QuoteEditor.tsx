"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuoteCard } from "./QuoteCard";
import { QuoteHeaderModal } from "./QuoteHeaderModal";
import { SectionModal, type SectionModalState } from "./SectionModal";
import { ItemModal, type ItemModalState } from "./ItemModal";
import { CloneModal } from "./CloneModal";
import { GenerateClientQuoteModal } from "./GenerateClientQuoteModal";
import type { TemplateOption } from "@/lib/quoteTemplatePick";
import type { ChuBaoGia } from "@/lib/quoteOwner";
import type { CatalogOption, CloneSource, ItemView, QuoteView, SectionView } from "./types";

/**
 * Điều phối: giữ đúng một việc — hộp thoại nào đang mở và mở với bản ghi nào.
 * Mỗi hộp thoại chỉ được dựng khi mở, nên state form của nó tự khởi tạo lại
 * theo bản ghi mới mà không cần đồng bộ gì thêm.
 */
export function QuoteEditor({
  chu,
  quotes,
  catalog,
  cloneSources,
  canEdit,
  projectArea,
  templates,
  templateGoiY,
  khuVucs,
  khuVucMacDinh,
  boHangMucs,
}: {
  /** Dự toán này thuộc dự án hay cơ hội chào giá — quyết định action ghi vào đâu. */
  chu: ChuBaoGia;
  quotes: QuoteView[];
  catalog: CatalogOption[];
  cloneSources: CloneSource[];
  canEdit: boolean;
  /** Diện tích dự án — dùng làm mẫu số dự phòng khi phần không khai diện tích. */
  projectArea: number | null;
  /** Mẫu báo giá gửi khách — chỉ dùng cho hộp thoại "Tạo báo giá gửi khách". */
  templates: TemplateOption[];
  templateGoiY: string | null;
  /** Khu vực khai trong thư viện — để chọn khu vực tra giá cho từng bản dự toán. */
  khuVucs: { id: string; ma: string; ten: string }[];
  /** Khu vực của dự án; chọn sẵn khi tạo bản dự toán mới. */
  khuVucMacDinh: string | null;
  /** Bộ hạng mục áp được vào một bản dự toán còn rỗng. */
  boHangMucs: { id: string; ma: string; ten: string; loaiCongTrinh: string | null; soPhan: number; soDong: number }[];
}) {
  const router = useRouter();
  const [quoteModal, setQuoteModal] = useState<{ editing: QuoteView | null } | null>(null);
  const [sectionModal, setSectionModal] = useState<SectionModalState | null>(null);
  const [itemModal, setItemModal] = useState<ItemModalState | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [genFor, setGenFor] = useState<QuoteView | null>(null);

  function closeAll() {
    setQuoteModal(null);
    setSectionModal(null);
    setItemModal(null);
    setCloneOpen(false);
    setGenFor(null);
    router.refresh();
  }

  const phanOf = (q: QuoteView) => q.sections.filter((s) => !s.parentId);

  function openSection(
    q: QuoteView,
    editing: SectionView | null,
    defaultKind: "PHAN" | "SUB",
    defaultParent: string
  ) {
    setSectionModal({ quoteId: q.id, phanOptions: phanOf(q), editing, defaultKind, defaultParent });
  }

  function openItem(q: QuoteView, defaultSectionId: string, editing: ItemView | null) {
    setItemModal({
      quoteId: q.id,
      markup: q.markup ?? 1,
      sections: q.sections,
      editing,
      defaultSectionId,
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
            <Copy className="h-4 w-4" /> Tạo từ dự án khác
          </Button>
          <Button size="sm" onClick={() => setQuoteModal({ editing: null })}>
            <Plus className="h-4 w-4" /> Thêm báo giá
          </Button>
        </div>
      )}

      {quotes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Chưa có báo giá nào — bấm “Thêm báo giá” hoặc “Tạo từ dự án khác”.
        </div>
      )}

      {quotes.map((q) => (
        <QuoteCard
          key={q.id}
          q={q}
          chu={chu}
          canEdit={canEdit}
          onEditQuote={() => setQuoteModal({ editing: q })}
          onGenerateClient={() => setGenFor(q)}
          onAddPhan={() => openSection(q, null, "PHAN", "")}
          onAddSub={(phanId) => openSection(q, null, "SUB", phanId)}
          onEditSection={(s) =>
            openSection(q, s, s.kind as "PHAN" | "SUB", s.parentId ?? "")
          }
          boHangMucs={boHangMucs}
          onAddItem={(sectionId) => openItem(q, sectionId, null)}
          onEditItem={(it) => openItem(q, it.sectionId, it)}
        />
      ))}

      {quoteModal && (
        <QuoteHeaderModal
          chu={chu}
          editing={quoteModal.editing}
          khuVucs={khuVucs}
          khuVucMacDinh={khuVucMacDinh}
          onClose={() => setQuoteModal(null)}
          onDone={closeAll}
        />
      )}

      {sectionModal && (
        <SectionModal
          chu={chu}
          state={sectionModal}
          onClose={() => setSectionModal(null)}
          onDone={closeAll}
        />
      )}

      {itemModal && (
        <ItemModal
          chu={chu}
          catalog={catalog}
          state={itemModal}
          onClose={() => setItemModal(null)}
          onDone={closeAll}
        />
      )}

      {genFor && (
        <GenerateClientQuoteModal
          chu={chu}
          quote={genFor}
          projectArea={projectArea}
          templates={templates}
          templateGoiY={templateGoiY}
          onClose={() => setGenFor(null)}
        />
      )}

      {cloneOpen && (
        <CloneModal
          chu={chu}
          cloneSources={cloneSources}
          onClose={() => setCloneOpen(false)}
          onDone={closeAll}
        />
      )}
    </div>
  );
}
