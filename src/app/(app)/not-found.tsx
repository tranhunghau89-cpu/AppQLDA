import Link from "next/link";
import { SearchX } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <SearchX className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Không tìm thấy</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nội dung này không tồn tại, hoặc không thuộc phạm vi dự án bạn được phân công.
          Nếu cần truy cập, liên hệ Ban giám đốc/Quản lý để được thêm vào dự án.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          Về trang Tổng quan
        </Link>
      </div>
    </div>
  );
}
