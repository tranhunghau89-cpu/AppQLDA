import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCoHoiView } from "@/lib/coHoiAccess";
import { QuoteDocument } from "@/components/print/QuoteDocument";

export default async function CoHoiQuotePrintPage({
  params,
}: {
  params: Promise<{ coHoiId: string; quoteId: string }>;
}) {
  const { coHoiId, quoteId } = await params;
  await requireCoHoiView("quote", coHoiId);

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      coHoi: { select: { tenCongTrinh: true, diaDiem: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  // Quyền kiểm theo `coHoiId` trên URL, nên phải chắc bản dự toán đúng là của cơ hội
  // đó — nếu không, đổi quoteId trên thanh địa chỉ là đọc được dự toán của khách khác.
  if (!quote || quote.coHoiId !== coHoiId || !quote.coHoi) notFound();

  return (
    <QuoteDocument
      quote={quote}
      congTrinh={quote.coHoi.tenCongTrinh}
      diaDiemMacDinh={quote.coHoi.diaDiem}
      quayVe={`/co-hoi/${coHoiId}/quote`}
    />
  );
}
