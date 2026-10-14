import Link from "next/link";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { scopedProjectWhere } from "@/lib/scope";
import { serverNow } from "@/lib/now";
import { soNgay } from "@/lib/ngayVN";
import { formatDate } from "@/lib/utils";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { TRANG_THAI_BUOC } from "@/lib/quyTrinh";
import { napQuyTrinhNhieu, type BuocView } from "@/lib/quyTrinhDb";
import { TabTrang, TAB_VIEC_THI_CONG } from "@/components/layout/TabTrang";

type Viec = BuocView & { projectId: string; projectLabel: string; tre: number | null };

// Việc quy trình: bước tôi phụ trách, bước chờ tôi duyệt, bước quá hạn — trên các dự án đang chạy.
export default async function ViecQuyTrinhPage() {
  const session = await requireView("project");
  const scope = await scopedProjectWhere(session);
  const laAdmin = session.role === "ADMIN";
  const nowMs = serverNow();

  const projects = await db.project.findMany({
    where: { AND: [scope, { status: { not: "HOAN_THANH" } }] },
    select: { id: true, code: true, name: true },
  });
  const quyTrinh = await napQuyTrinhNhieu(projects.map((p) => p.id));

  const tatCa: Viec[] = projects.flatMap((p) =>
    (quyTrinh.get(p.id) ?? [])
      .filter((b) => ["DANG_LAM", "TRA_LAI", "CHO_DUYET"].includes(b.trangThai))
      .map((b) => ({
        ...b,
        projectId: p.id,
        projectLabel: `${p.code} — ${p.name}`,
        tre: b.han ? soNgay(new Date(b.han).getTime(), nowMs) : null,
      })),
  );
  // Trả lại lên đầu, rồi trễ nhiều nhất, rồi không có hạn.
  const xep = (a: Viec, b: Viec) =>
    Number(b.trangThai === "TRA_LAI") - Number(a.trangThai === "TRA_LAI") ||
    (b.tre ?? -Infinity) - (a.tre ?? -Infinity);

  const cuaToi = tatCa
    .filter(
      (b) =>
        b.trangThai !== "CHO_DUYET" &&
        (b.phuTrachId === session.userId || (!b.phuTrachId && b.boPhanMacDinh === session.role)),
    )
    .sort(xep);
  const choDuyet = laAdmin ? tatCa.filter((b) => b.trangThai === "CHO_DUYET").sort(xep) : [];
  // Chỉ tính quá hạn cho bước đã giao người phụ trách.
  const quaHan = tatCa.filter((b) => b.phuTrachId && b.tre != null && b.tre > 0).sort(xep);

  return (
    <div className="space-y-6">
      <TabTrang tabs={TAB_VIEC_THI_CONG} hienTai="/quy-trinh" role={session.role} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Việc quy trình</h1>
        <p className="text-sm text-slate-500">
          Các bước Thông tin dự án / QC giai đoạn đang mở trên những dự án đang chạy.
        </p>
      </div>
      <Bang
        tieuDe="Tôi phụ trách"
        moTa="Bước giao cho tôi, hoặc chưa giao ai mà thuộc bộ phận của tôi."
        ds={cuaToi}
      />
      {laAdmin && <Bang tieuDe="Chờ tôi duyệt" ds={choDuyet} />}
      <Bang tieuDe="Quá hạn" ds={quaHan} />
    </div>
  );
}

function Bang({ tieuDe, moTa, ds }: { tieuDe: string; moTa?: string; ds: Viec[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2">
        <span className="font-semibold text-slate-800">{tieuDe}</span>{" "}
        <span className="text-sm text-slate-500">({ds.length})</span>
        {moTa && <p className="text-xs text-slate-500">{moTa}</p>}
      </div>
      {ds.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">Không có việc nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Dự án</th>
                <th className="px-3 py-2">Bước</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Phụ trách</th>
                <th className="px-3 py-2">Hạn</th>
                <th className="px-3 py-2">Còn thiếu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ds.map((b) => {
                const tt = TRANG_THAI_BUOC[b.trangThai];
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/projects/${b.projectId}#quy-trinh`} className="text-blue-700 hover:underline">
                        {b.projectLabel}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{b.ten}</td>
                    <td className="px-3 py-2">
                      <Badge tone={tt.tone}>{tt.label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {b.phuTrachTen ?? (
                        <span className="text-slate-400">
                          {ROLE_LABEL[b.boPhanMacDinh as Role] ?? b.boPhanMacDinh}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {b.han ? formatDate(b.han) : "—"}
                      {b.phuTrachId && b.tre != null && b.tre > 0 && (
                        <span className="ml-1 text-red-600">(trễ {b.tre} ngày)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{b.chuaDu ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
