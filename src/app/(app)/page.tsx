import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/rbac";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tổng quan</h1>
        <p className="text-sm text-slate-500">
          Xin chào {session.name} — {ROLE_LABEL[session.role]}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-2">
          <CardTitle>Hệ thống đã sẵn sàng</CardTitle>
          <p className="text-sm text-slate-600">
            Đây là khung dashboard. Các module Dự án, Tiến độ, Dự toán, Chi
            phí/lợi nhuận sẽ được bổ sung ở các phase tiếp theo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
