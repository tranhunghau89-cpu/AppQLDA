// Danh sách bản dự toán được phép chép lại, dùng chung cho trang dự toán ở dự án và ở
// cơ hội chào giá.
//
// Một chỗ duy nhất vì phạm vi ở đây vừa là quyền vừa là tiện ích: chép được một bản
// nghĩa là đọc được toàn bộ đơn giá của nó. Hai danh sách lệch nhau là hai luật quyền
// lệch nhau.
import "server-only";
import { db } from "./db";
import { myProjectIds } from "./scope";
import { whereBaoGiaTrongPhamVi } from "./crmScope";
import type { SessionUser } from "./session";

export interface CloneSourceRow {
  id: string;
  label: string;
}

export async function nguonCloneBaoGia(session: SessionUser): Promise<CloneSourceRow[]> {
  const rows = await db.quote.findMany({
    where: whereBaoGiaTrongPhamVi(session, await myProjectIds(session)),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      project: { select: { code: true } },
      coHoi: { select: { tenCongTrinh: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    // Mã dự án gọn hơn nên ưu tiên; cơ hội chưa có mã nào nên lấy tên công trình.
    label: `${r.project?.code ?? r.coHoi?.tenCongTrinh ?? "—"} · ${r.title}`,
  }));
}
