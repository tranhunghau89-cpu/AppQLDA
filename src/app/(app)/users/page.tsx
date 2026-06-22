import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { UserManager } from "./UserManager";

export default async function UsersPage() {
  const session = await requireView("user");

  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, email: true, name: true, role: true, active: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Người dùng</h1>
        <p className="text-sm text-slate-500">Quản lý tài khoản và phân quyền theo bộ phận</p>
      </div>
      <UserManager users={users} currentUserId={session.userId} />
    </div>
  );
}
