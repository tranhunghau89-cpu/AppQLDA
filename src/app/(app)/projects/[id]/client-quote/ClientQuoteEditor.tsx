"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatVND } from "@/lib/utils";
import { computeClientQuoteTotals } from "@/lib/clientQuote";
import { CLIENT_QUOTE_STATUS_MAP } from "@/lib/constants";
import { ClientQuoteCard } from "./ClientQuoteCard";
import { HeaderModal, type GoiY } from "./HeaderModal";
import { LineModal, type LineModalState } from "./LineModal";
import { ApBoModal } from "./ApBoModal";
import { ChuThichO } from "@/components/ui/kieuO";
import { SpecModal, type SpecModalState } from "./SpecModal";
import { TermsModal, type TermsModalState } from "./TermsModal";
import { XemTruoc } from "./XemTruoc";
import type { TemplateOption } from "@/lib/quoteTemplatePick";
import type {
  ClientQuoteView,
  CustomerOption,
  LineView,
  SpecView,
} from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

/**
 * Điều phối: giữ đúng một việc — hộp thoại nào đang mở và mở với bản ghi nào.
 * Mỗi hộp thoại chỉ được dựng khi mở nên state form tự khởi tạo lại theo bản ghi mới.
 */
export function ClientQuoteEditor({
  chu,
  quotes,
  customers,
  canEdit,
  canViewCrm,
  canEditCrm,
  goiY,
  templates,
  templateGoiY,
}: {
  chu: ChuBaoGia;
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
  const [headerModal, setHeaderModal] = useState<{
    editing: ClientQuoteView | null;
  } | null>(null);
  const [lineModal, setLineModal] = useState<LineModalState | null>(null);
  const [specModal, setSpecModal] = useState<SpecModalState | null>(null);
  const [termsModal, setTermsModal] = useState<TermsModalState | null>(null);
  // Xem trước không phải form nên không đi qua closeAll — đóng lại thì chẳng có gì
  // để nạp lại.
  const [xemTruoc, setXemTruoc] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [apBo, setApBo] = useState<string | null>(null);
  // Nhiều báo giá bày hết ra thì dễ sửa nhầm bản: chỉ mở một bản, mặc định bản đầu.
  // null = đóng hết. Báo giá vừa lập (chưa từng thấy) tự mở.
  const [moId, setMoId] = useState<string | null>(quotes[0]?.id ?? null);
  const [daThay, setDaThay] = useState(() => new Set(quotes.map((q) => q.id)));
  const moi = quotes.find((q) => !daThay.has(q.id));
  if (moi) {
    setDaThay(new Set(quotes.map((q) => q.id)));
    setMoId(moi.id);
  }
  const nhieuBan = quotes.length > 1;

  function closeAll() {
    setApBo(null);
    setHeaderModal(null);
    setLineModal(null);
    setSpecModal(null);
    setTermsModal(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChuThichO />
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
            Bảng vật liệu, tiến độ thi công và tiến độ thanh toán sẽ được điền
            sẵn theo mẫu.
          </span>
        </div>
      )}

      {quotes.map((q) =>
        nhieuBan && moId !== q.id ? (
          <DongThuGon key={q.id} q={q} onMo={() => setMoId(q.id)} />
        ) : (
        <ClientQuoteCard
          key={q.id}
          q={q}
          chu={chu}
          canEdit={canEdit}
          canViewCrm={canViewCrm}
          canEditCrm={canEditCrm}
          onEdit={() => setHeaderModal({ editing: q })}
          onAddLine={() => setLineModal({ quoteId: q.id, editing: null })}
          onApBo={() => setApBo(q.id)}
          onEditLine={(l: LineView) =>
            setLineModal({ quoteId: q.id, editing: l })
          }
          onAddSpec={(groupCode) =>
            setSpecModal({
              quoteId: q.id,
              editing: null,
              defaultGroup: groupCode,
            })
          }
          onEditSpec={(s: SpecView) =>
            setSpecModal({
              quoteId: q.id,
              editing: s,
              defaultGroup: s.groupCode,
            })
          }
          onEditTerms={(tongSauThue) =>
            setTermsModal({
              quoteId: q.id,
              stages: q.stages,
              payments: q.payments,
              tongSauThue,
            })
          }
          onPreview={() => setXemTruoc({ id: q.id, title: q.title })}
          onThuGon={nhieuBan ? () => setMoId(null) : undefined}
        />
        ),
      )}

      {headerModal && (
        <HeaderModal
          chu={chu}
          editing={headerModal.editing}
          customers={customers}
          goiY={goiY}
          templates={templates}
          templateGoiY={templateGoiY}
          onClose={() => setHeaderModal(null)}
          onDone={closeAll}
        />
      )}

      {apBo && (
        <ApBoModal
          chu={chu}
          quoteId={apBo}
          templates={templates}
          goiY={templateGoiY}
          onClose={() => setApBo(null)}
          onDone={closeAll}
        />
      )}

      {lineModal && (
        <LineModal
          chu={chu}
          state={lineModal}
          onClose={() => setLineModal(null)}
          onDone={closeAll}
        />
      )}

      {specModal && (
        <SpecModal
          chu={chu}
          state={specModal}
          onClose={() => setSpecModal(null)}
          onDone={closeAll}
        />
      )}

      {xemTruoc && (
        <XemTruoc
          quoteId={xemTruoc.id}
          tieuDe={xemTruoc.title}
          onClose={() => setXemTruoc(null)}
        />
      )}

      {termsModal && (
        <TermsModal
          chu={chu}
          state={termsModal}
          onClose={() => setTermsModal(null)}
          onDone={closeAll}
        />
      )}
    </div>
  );
}

/** Một báo giá đang thu gọn: chỉ một hàng tiêu đề, bấm vào để mở (các bản khác tự gọn). */
function DongThuGon({ q, onMo }: { q: ClientQuoteView; onMo: () => void }) {
  const trangThai = CLIENT_QUOTE_STATUS_MAP[q.status];
  const tong = computeClientQuoteTotals(q.lines, q.vatPercent);
  return (
    <button
      type="button"
      onClick={onMo}
      className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50/40"
    >
      <ChevronRight className="h-4 w-4 text-slate-400" />
      {q.quoteNo && <span className="font-mono text-sm text-slate-500">{q.quoteNo}</span>}
      <span className="font-semibold text-slate-900">{q.title}</span>
      <Badge tone={trangThai?.tone ?? "slate"}>{trangThai?.label ?? q.status}</Badge>
      <span className="ml-auto text-sm text-slate-500">
        {q.lines.length} hạng mục · <span className="font-medium text-slate-700">{formatVND(tong.withVat)}</span>
      </span>
    </button>
  );
}
