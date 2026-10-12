import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { demChuaDoc } from "@/lib/traoDoi";
import { myProjects } from "@/lib/scope";
import { AppShell } from "@/components/layout/AppShell";
import { QuickAdd, type QuickType } from "@/app/(app)/quick/QuickAdd";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const [projects, suppliers, chuaDoc] = await Promise.all([
    myProjects(session),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    demChuaDoc(session.userId),
  ]);

  const allowed: QuickType[] = [];
  // Nhật ký công trường là việc của Kỹ thuật (progress.edit) — KD sửa được dự án nhưng không ghi tiến độ.
  if (can(session.role, "progress", "edit") && can(session.role, "project", "edit")) allowed.push("note");
  if (can(session.role, "purchase", "edit")) allowed.push("purchase");
  if (can(session.role, "cost", "edit")) allowed.push("payment");
  if (can(session.role, "estimate", "edit")) allowed.push("estimate");

  return (
    <AppShell role={session.role} name={session.name} chuaDoc={chuaDoc}>
      {children}
      <QuickAdd projects={projects} allowed={allowed} role={session.role} suppliers={suppliers} />
    </AppShell>
  );
}
