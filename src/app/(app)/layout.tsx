import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { myProjects } from "@/lib/scope";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { QuickAdd, type QuickType } from "@/app/(app)/quick/QuickAdd";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const [projects, suppliers] = await Promise.all([
    myProjects(session),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const allowed: QuickType[] = [];
  if (can(session.role, "project", "edit")) allowed.push("note");
  if (can(session.role, "purchase", "edit")) allowed.push("purchase");
  if (can(session.role, "cost", "edit")) allowed.push("payment");
  if (can(session.role, "estimate", "edit")) allowed.push("estimate");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <Sidebar role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={session.name} role={session.role} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <QuickAdd projects={projects} allowed={allowed} suppliers={suppliers} />
    </div>
  );
}
