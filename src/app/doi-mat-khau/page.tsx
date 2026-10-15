import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DoiMatKhauForm } from "./DoiMatKhauForm";

export default async function DoiMatKhauPage() {
  const session = await requireSession();
  const me = await db.user.findUnique({
    where: { id: session.userId },
    select: { mustChangePassword: true },
  });
  const batBuoc = !!me?.mustChangePassword;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h1>
        <p className="mt-1 text-sm text-slate-500">{session.name} · {session.email}</p>
        {batBuoc && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Mật khẩu của bạn do quản trị viên đặt. Hãy đặt mật khẩu riêng trước khi tiếp tục.
          </p>
        )}
        <div className="mt-6">
          <DoiMatKhauForm />
        </div>
        <div className="mt-4 flex justify-between text-sm">
          {batBuoc ? <span /> : <Link href="/" className="text-slate-500 hover:underline">← Quay lại</Link>}
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-slate-500 hover:underline">Đăng xuất</button>
          </form>
        </div>
      </div>
    </div>
  );
}
