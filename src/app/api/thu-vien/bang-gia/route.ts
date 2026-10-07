import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { bangGiaChung } from "@/lib/thuVien/bangGiaDb";
import { taoFileBangGia } from "@/lib/thuVien/bangGiaExcel";
import { ngayTraGia } from "@/lib/thuVien/gia";

/**
 * Tải bảng giá chung hiện hành ra Excel để sửa rồi nộp lại. Tên cột là khuôn mà
 * `docFileBangGia` đọc lại (cùng nằm trong bangGiaExcel.ts).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "thuVien", "view")) return new Response("Forbidden", { status: 403 });

  const ngay = ngayTraGia();
  const bang = await bangGiaChung(ngay);

  const wb = taoFileBangGia(bang);
  const buf = await wb.xlsx.writeBuffer();
  const ten = `bang-gia-${ngay.toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ten}"`,
    },
  });
}
