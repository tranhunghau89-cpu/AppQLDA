import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { myProjects } from "@/lib/scope";
import { AppShell } from "@/components/layout/AppShell";
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
    <AppShell role={session.role} name={session.name}>
      {children}
      <QuickAdd projects={projects} allowed={allowed} suppliers={suppliers} />
    </AppShell>
  );
}
