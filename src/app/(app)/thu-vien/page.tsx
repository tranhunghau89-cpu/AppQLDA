import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { chonDonGia, type DongGiaUngVien } from "@/lib/thuVien/gia";
import { CongTacGrid, type CongTacView } from "./CongTacGrid";

export default async function ThuVienPage() {
  const session = await requireView("thuVien");
  const canEdit = can(session.role as Role, "thuVien", "edit");
  const ngay = new Date();

  // Một truy vấn cho công tác, một cho toàn bộ bản giá còn hiệu lực tới hôm nay.
  // KHÔNG hỏi giá từng công tác một: 135 công tác là 135 lượt đi về cơ sở dữ liệu
  // cho một màn hình chỉ để hiện một cột.
  const [congTacs, banGias] = await Promise.all([
    db.congTac.findMany({
      orderBy: [{ nhomMa: "asc" }, { sortOrder: "asc" }, { ma: "asc" }],
    }),
    db.donGiaCongTac.findMany({
      where: { hieuLucTu: { lte: ngay } },
      select: {
        id: true,
        congTacId: true,
        congTacVatTuId: true,
        khuVucId: true,
        donGia: true,
        hieuLucTu: true,
        createdAt: true,
      },
    }),
  ]);

  const theoCongTac = new Map<string, DongGiaUngVien[]>();
  for (const g of banGias) {
    const ds = theoCongTac.get(g.congTacId);
    if (ds) ds.push(g);
    else theoCongTac.set(g.congTacId, [g]);
  }

  const items: CongTacView[] = congTacs.map((c) => {
    const kq = chonDonGia(theoCongTac.get(c.id) ?? [], {
      congTacId: c.id,
      ngay,
    });
    return {
      id: c.id,
      ma: c.ma,
      ten: c.ten,
      tenNgan: c.tenNgan,
      quyCach: c.quyCach,
      donVi: c.donVi,
      nhomMa: c.nhomMa,
      nhomChiPhi: c.nhomChiPhi,
      heSo: c.heSo,
      ghiChu: c.ghiChu,
      donGiaHienHanh: kq.donGia,
      hieuLucTu: kq.hieuLucTu ? kq.hieuLucTu.toISOString() : null,
      soBanGia: (theoCongTac.get(c.id) ?? []).length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Thư viện đơn giá</h1>
        <p className="text-sm text-slate-500">
          Danh mục công tác dùng chung cho dự toán chào giá, báo giá gửi khách và dự
          toán thi công — {items.length} công tác. Đơn giá có lịch sử theo ngày hiệu
          lực; mở một công tác để xem và thêm bản giá mới.
        </p>
      </div>
      <CongTacGrid items={items} canEdit={canEdit} />
    </div>
  );
}
