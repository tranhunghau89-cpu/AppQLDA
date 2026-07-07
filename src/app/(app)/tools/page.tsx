import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { takeoffDb } from "@/lib/takeoff";
import { SteelLookup } from "./SteelLookup";
import { TakeoffBoard } from "./TakeoffBoard";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; project?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const tab = sp.tab === "takeoff" ? "takeoff" : "lookup";
  const projectId = sp.project ?? null;

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    select: { id: true, code: true, name: true },
  });
  const items = projectId
    ? await takeoffDb.findMany({
        where: { projectId },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      })
    : [];
  const canEdit = ["ADMIN", "ENGINEERING", "PROCUREMENT"].includes(session.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tra cứu & Bóc khối lượng</h1>
        <p className="text-sm text-slate-500">
          Bảng tra thép hình (409 mã) và bóc tách khối lượng móng, cột, dầm, sàn, cấu kiện thép tổ hợp theo dự án
        </p>
      </div>

      <div className="flex gap-2">
        <Link
          href="/tools"
          className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "lookup" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          Tra cứu thép
        </Link>
        <Link
          href={`/tools?tab=takeoff${projectId ? `&project=${projectId}` : ""}`}
          className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "takeoff" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          Bóc khối lượng
        </Link>
      </div>

      {tab === "lookup" ? (
        <SteelLookup />
      ) : (
        <TakeoffBoard projects={projects} projectId={projectId} items={items} canEdit={canEdit} />
      )}
    </div>
  );
}
