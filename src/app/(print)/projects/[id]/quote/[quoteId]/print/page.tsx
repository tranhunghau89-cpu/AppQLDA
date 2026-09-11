import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { QuoteDocument } from "@/components/print/QuoteDocument";

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string; quoteId: string }>;
}) {
  const { id, quoteId } = await params;
  await requireProjectView("quote", id);

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      project: { select: { code: true, name: true, location: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  // Kiểm quyền ở trên theo `id` trên URL, nên phải chắc báo giá này đúng là của dự án
  // đó — nếu không, đổi quoteId trên thanh địa chỉ là đọc được báo giá dự án khác.
  if (!quote || quote.projectId !== id || !quote.project) notFound();

  return (
    <QuoteDocument
      quote={quote}
      congTrinh={`${quote.project.code} — ${quote.project.name}`}
      diaDiemMacDinh={quote.project.location}
      quayVe={`/projects/${id}/quote`}
    />
  );
}
