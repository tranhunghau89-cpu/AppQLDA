import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { norm } from "@/lib/text";
import { locCongTac } from "@/lib/thuVien/locCongTac";
import { BangGhepTen, type TenChuaNoi, type CongTacGhep } from "./BangGhepTen";

/**
 * Ghép tên dự toán thi công gõ tay với Thư viện đơn giá — chọn MỘT lần cho mỗi tên, áp
 * cho mọi dự án. Gợi ý sẵn: trùng tên ngắn ("Loại") của công tác trước, rồi trùng tên.
 */
export default async function GhepTenPage() {
  const session = await requireView("thuVien");
  const canEdit =
    can(session.role as Role, "thuVien", "edit") &&
    can(session.role as Role, "estimate", "edit");

  const [dong, congTacs] = await Promise.all([
    db.estimateItem.findMany({
      where: { congTacId: null, layTuThamSo: null },
      select: { name: true, projectId: true },
    }),
    db.congTac.findMany({
      where: { active: true },
      orderBy: [{ nhomMa: "asc" }, { sortOrder: "asc" }, { ma: "asc" }],
      select: {
        id: true,
        ma: true,
        ten: true,
        tenNgan: true,
        donVi: true,
        nhomMa: true,
      },
    }),
  ]);

  const gom = new Map<string, { soDong: number; duAn: Set<string> }>();
  for (const d of dong) {
    const g = gom.get(d.name) ?? { soDong: 0, duAn: new Set<string>() };
    g.soDong++;
    g.duAn.add(d.projectId);
    gom.set(d.name, g);
  }
  const timDuoc = congTacs.map((c) => ({ ...c, code: c.ma, name: c.ten }));
  const goiY = (ten: string) => {
    const n = norm(ten);
    const trungNgan = congTacs.filter((c) => norm(c.tenNgan) === n);
    if (trungNgan.length === 1) return trungNgan[0].id;
    const trungTen = congTacs.find((c) => norm(c.ten) === n);
    if (trungTen) return trungTen.id;
    const loc = locCongTac(timDuoc, ten, 2);
    return loc.length === 1 ? loc[0].id : null;
  };
  const ten: TenChuaNoi[] = [...gom]
    .map(([t, g]) => ({
      ten: t,
      soDong: g.soDong,
      soDuAn: g.duAn.size,
      goiY: goiY(t),
    }))
    .sort((a, b) => b.soDong - a.soDong);
  const thuVien: CongTacGhep[] = congTacs.map((c) => ({
    id: c.id,
    ma: c.ma,
    ten: c.ten,
    donVi: c.donVi,
    nhomMa: c.nhomMa,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/thu-vien"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Thư viện đơn giá
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Ghép tên dự toán với thư viện
        </h1>
        <p className="text-sm text-slate-500">
          Dự toán thi công và đơn hàng phải lấy đầu việc từ Thư viện đơn giá.
          Còn <b>{dong.length}</b> dòng dự toán gõ tay, gồm <b>{ten.length}</b>{" "}
          tên khác nhau. Chọn công tác cho từng tên một lần — áp cho mọi dự án.
          Chỉ nối nguồn: tên, đơn giá, khối lượng của dự toán cũ giữ nguyên; món
          đơn hàng cùng công tác tự gắn vào đầu việc.
        </p>
      </div>
      <BangGhepTen ten={ten} thuVien={thuVien} canEdit={canEdit} />
    </div>
  );
}
