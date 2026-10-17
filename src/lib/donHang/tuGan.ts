import "server-only";

import { db } from "@/lib/db";
import { tinhLaiThucTe } from "@/lib/khoiLuong/tinhLaiMucCon";

/**
 * Tự gắn món đơn hàng vào đầu việc dự toán thi công qua NGUỒN CHUNG là công tác thư viện:
 * món chưa gắn mà dự án có ĐÚNG MỘT đầu việc cùng công tác thì gắn vào đầu việc đó.
 *
 * Có từ hai đầu việc cùng công tác trở lên (vd. "Bulong liên kết" ở cả hạng mục khung và
 * hạng mục mái) thì KHÔNG đoán — để người dùng chọn ở ô "Gắn dự toán". Món đã gắn tay thì
 * không đụng, kể cả khi khác công tác.
 *
 * Gọi sau mọi thao tác làm thay đổi công tác của món hay của đầu việc. Trả số món vừa gắn.
 */
export async function tuGanDonHang(projectId: string): Promise<number> {
  const [mon, dauViec] = await Promise.all([
    db.purchaseOrderItem.findMany({
      where: { order: { projectId }, estimateItemId: null, congTacId: { not: null } },
      select: { id: true, congTacId: true },
    }),
    db.estimateItem.findMany({
      where: { projectId, congTacId: { not: null } },
      select: { id: true, congTacId: true },
    }),
  ]);
  if (mon.length === 0 || dauViec.length === 0) return 0;

  const theoCongTac = new Map<string, string[]>();
  for (const d of dauViec) {
    theoCongTac.set(d.congTacId!, [...(theoCongTac.get(d.congTacId!) ?? []), d.id]);
  }

  const gan = new Map<string, string[]>(); // estimateItemId → món
  for (const m of mon) {
    const ds = theoCongTac.get(m.congTacId!);
    if (ds?.length !== 1) continue;
    gan.set(ds[0], [...(gan.get(ds[0]) ?? []), m.id]);
  }
  for (const [estimateItemId, ids] of gan) {
    await db.purchaseOrderItem.updateMany({ where: { id: { in: ids } }, data: { estimateItemId } });
  }
  if (gan.size) await tinhLaiThucTe([...gan.keys()]);
  return [...gan.values()].reduce((t, ds) => t + ds.length, 0);
}
