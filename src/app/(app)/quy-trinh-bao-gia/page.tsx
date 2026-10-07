import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireView } from "@/lib/auth";
import { db } from "@/lib/db";
import { whereCoHoiTrongPhamVi } from "@/lib/crmScope";
import { CO_HOI_DANG_MO, CO_HOI_TRANG_THAI_MAP } from "@/lib/constants";
import { QUY_TRINH_BAO_GIA } from "@/lib/quyTrinhBaoGia";
import { Badge } from "@/components/ui/badge";

/**
 * Cửa vào quy trình báo giá: chọn một quy trình để bắt đầu công trình mới, hoặc tiếp
 * tục một công trình đang chào dở.
 */
export default async function QuyTrinhBaoGiaPage() {
  const session = await requireView("customer");

  const dangDo = await db.coHoi.findMany({
    where: {
      ...whereCoHoiTrongPhamVi(session),
      trangThai: { in: CO_HOI_DANG_MO },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      tenCongTrinh: true,
      trangThai: true,
      khachHang: { select: { tenCty: true } },
      _count: { select: { quotes: true, clientQuotes: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Quy trình kinh doanh
        </h1>
        <p className="text-sm text-slate-500">
          Chọn quy trình rồi làm lần lượt từng bước — xong bước nào bấm “Tiếp”
          để sang bước sau.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {QUY_TRINH_BAO_GIA.map((qt) => (
          <Link
            key={qt.ma}
            href={`/quy-trinh-bao-gia/${qt.ma}`}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-400"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{qt.ten}</h2>
              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600" />
            </div>
            <p className="mt-1 text-sm text-slate-500">{qt.moTa}</p>
            <ol className="mt-3 space-y-1 text-sm text-slate-700">
              {qt.buoc.map((b, i) => (
                <li key={b.loai}>
                  <span className="mr-2 text-slate-400">{i + 1}.</span>
                  {b.ten}
                </li>
              ))}
            </ol>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">
            Công trình đang chào giá
          </h2>
          <p className="text-xs text-slate-500">Tiếp tục từ bước còn dở.</p>
        </div>
        {dangDo.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">
            Chưa có công trình nào đang chào.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dangDo.map((c) => {
              const tt = CO_HOI_TRANG_THAI_MAP[c.trangThai];
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {c.tenCongTrinh}
                      </span>
                      <Badge tone={tt?.tone ?? "slate"}>
                        {tt?.label ?? c.trangThai}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {c.khachHang.tenCty} · {c._count.quotes} dự toán ·{" "}
                      {c._count.clientQuotes} báo giá
                    </p>
                  </div>
                  {QUY_TRINH_BAO_GIA.filter(
                    (qt) => qt.doiTuong === "CO_HOI",
                  ).map((qt) => (
                    <Link
                      key={qt.ma}
                      href={`/quy-trinh-bao-gia/${qt.ma}/${c.id}`}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      {qt.ten}
                    </Link>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
