// Đọc phía server cho hộp thư trao đổi. Không phải server action: nhận userId từ
// phiên ở server component, không để trình duyệt truyền vào.
import { db } from "@/lib/db";

export const LOAI_TRAO_DOI_LABEL: Record<string, string> = {
  GHI_CHU: "Ghi chú",
  XIN_DUYET: "Xin duyệt",
  CAN_SUA: "Cần chỉnh sửa",
  DONG_Y: "Đồng ý",
};

export function demChuaDoc(userId: string): Promise<number> {
  return db.traoDoiNhan.count({ where: { userId, daDocLuc: null } });
}

/** Trang mở đúng việc mà tin trao đổi nói tới. */
export function duongDanViec(t: {
  doiTuong: string;
  doiTuongId: string;
  projectId: string | null;
  coHoiId: string | null;
}): string {
  const goc = t.projectId ? `/projects/${t.projectId}` : `/co-hoi/${t.coHoiId}`;
  return t.doiTuong === "CLIENT_QUOTE"
    ? `${goc}/client-quote?mo=${t.doiTuongId}#trao-doi`
    : `${goc}/quote#trao-doi-${t.doiTuongId}`;
}
