import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

/** Thanh Quay lại / Tiếp ở cuối mỗi bước. `tiep = null` -> nút Tiếp mờ, hiện lý do. */
export function DieuHuong({
  truoc,
  tiep,
  laCuoi,
  xong,
  lyDo,
}: {
  truoc: string;
  tiep: string | null;
  laCuoi: boolean;
  xong: boolean;
  lyDo?: string;
}) {
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
      <Link
        href={truoc}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>
      <div className="flex items-center gap-3">
        {!xong && lyDo && (
          <span className="text-sm text-amber-700">{lyDo}</span>
        )}
        {laCuoi && xong ? (
          <Link
            href="/quy-trinh-bao-gia"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
          >
            Hoàn tất
          </Link>
        ) : tiep ? (
          <Link
            href={tiep}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Tiếp <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white opacity-50">
            Tiếp <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
