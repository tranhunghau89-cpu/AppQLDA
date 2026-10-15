import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { LOAI_TRAO_DOI_LABEL, duocXemViec, duongDanViec } from "@/lib/traoDoi";
import { khaNangDuyet } from "@/lib/duyetNhanh";
import { TEN_NHOM_THAY_DOI, laNhomThayDoi } from "@/lib/baoThayDoi";
import { DuyetNhanh } from "./DuyetNhanh";

const TONE: Record<string, "slate" | "blue" | "amber" | "green"> = {
  GHI_CHU: "slate",
  XIN_DUYET: "blue",
  CAN_SUA: "amber",
  DONG_Y: "green",
};

const TEN_VIEC: Record<string, string> = {
  CLIENT_QUOTE: "Báo giá gửi khách",
  QUOTE: "Dự toán chi tiết",
  BUOC: "Quy trình dự án",
  ...TEN_NHOM_THAY_DOI,
  NHAC_VIEC: "Nhắc việc",
  THAO_LUAN: "Trao đổi dự án",
};

// Hộp thư: các tin người khác nhắn tới mình, chưa đọc lên đầu. Đọc là bấm vào việc —
// khung trao đổi ở đó tự đánh dấu đã đọc.
export default async function TraoDoiPage() {
  const session = await requireSession();
  const tatCa = await db.traoDoiNhan.findMany({
    where: { userId: session.userId },
    include: { traoDoi: true },
    orderBy: [{ daDocLuc: { sort: "desc", nulls: "first" } }, { traoDoi: { createdAt: "desc" } }],
    take: 100,
  });
  // Bị rút khỏi dự án sau khi được nhắn thì không còn đọc được nội dung nữa.
  const xem = await Promise.all(tatCa.map((n) => duocXemViec(session, n.traoDoi)));
  const nhan = tatCa.filter((_, i) => xem[i]);
  const chuaDoc = nhan.filter((n) => !n.daDocLuc).length;
  // Tin xin duyệt còn chờ mà mình quyết được → hiện nút duyệt ngay trong hộp thư.
  const duyetDuoc = new Set(
    (
      await Promise.all(
        nhan
          .filter((n) => n.traoDoi.loai === "XIN_DUYET")
          .map(async (n) => ((await khaNangDuyet(session, n.traoDoi)).duoc ? n.traoDoi.id : null)),
      )
    ).filter((x): x is string => !!x),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Trao đổi công việc</h1>
        <p className="text-sm text-slate-500">
          Tin nhắn về báo giá, dự toán, quy trình gửi tới bạn · {chuaDoc} chưa đọc
        </p>
      </div>
      {nhan.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          Chưa có ai nhắn bạn. Mở một báo giá, kéo xuống “Trao đổi nội bộ” để nhắn người khác.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {nhan.map(({ traoDoi: t, daDocLuc }) => (
            <li key={t.id}>
              <Link
                href={duongDanViec(t)}
                className={`block p-4 hover:bg-slate-50 ${daDocLuc ? "" : "bg-blue-50/60"}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {!daDocLuc && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Chưa đọc" />}
                  <span className="font-medium text-slate-800">{t.tacGiaTen}</span>
                  {t.loai !== "GHI_CHU" && <Badge tone={TONE[t.loai]}>{t.loai === "CAN_SUA" && laNhomThayDoi(t.doiTuong) ? "Cần xử lý" : LOAI_TRAO_DOI_LABEL[t.loai]}</Badge>}
                  <span>
                    {TEN_VIEC[t.doiTuong] ?? t.doiTuong}
                    {t.nhanDe ? `: ${t.nhanDe}` : ""}
                  </span>
                  <span className="ml-auto">{t.createdAt.toLocaleString("vi-VN")}</span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-700">{t.noiDung}</p>
              </Link>
              {duyetDuoc.has(t.id) && <DuyetNhanh traoDoiId={t.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
