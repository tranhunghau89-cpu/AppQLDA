"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Ranh giới lỗi cho toàn bộ khu vực đã đăng nhập. Trước đây một lỗi DB bất kỳ
 * (Supabase ngắt kết nối, hết pool) sẽ ra màn hình lỗi trắng của Next, không có
 * cách nào thử lại.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] lỗi không bắt được:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Có lỗi xảy ra</h1>
        <p className="mt-2 text-sm text-slate-600">
          Không tải được dữ liệu cho trang này. Thường là do mất kết nối tới cơ sở dữ
          liệu — thử lại sau vài giây thường sẽ được.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-400">Mã lỗi: {error.digest}</p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Về trang Tổng quan
          </Button>
        </div>
      </div>
    </div>
  );
}
