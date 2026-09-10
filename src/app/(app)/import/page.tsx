import { requireView } from "@/lib/auth";
import { IMPORT_KIND } from "@/lib/import/types";
import type { ImportKind } from "@/lib/import/types";
import { ImportWizard } from "./ImportWizard";

/** Loại nào đã chuyển sang web, loại nào còn phải chạy CLI. */
const HO_TRO: Record<ImportKind, { moTa: string; sanSang: boolean }> = {
  estimate: { moTa: "File dự toán, sheet TongHop — mỗi file 1 dự án", sanSang: true },
  thcp: { moTa: "File tổng hợp chi phí / quyết toán", sanSang: false },
  order: { moTa: "File đơn đặt hàng vật tư", sanSang: false },
};

export default async function ImportPage() {
  await requireView("import");

  const kinds = (Object.keys(IMPORT_KIND) as ImportKind[]).map((k) => ({
    value: k,
    label: IMPORT_KIND[k],
    ...HO_TRO[k],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nhập dữ liệu từ Excel</h1>
        <p className="text-sm text-slate-500">
          Tải file lên, xem hệ thống hiểu file thế nào, rồi mới xác nhận ghi. Trước đây
          việc này chỉ chạy được bằng dòng lệnh trên máy của người phát triển.
        </p>
      </div>

      <ImportWizard kinds={kinds} />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="font-medium text-slate-800">Các loại chưa chuyển lên web</div>
        <p className="mt-1 text-xs">
          Hợp đồng, bảng đơn giá, báo giá mẫu, đơn hàng và tổng hợp chi phí vẫn nhập bằng
          lệnh trên máy phát triển (<code className="font-mono">npm run import:*</code>).
          Đây đều là những việc làm một lần hoặc hiếm khi lặp lại.
        </p>
      </div>
    </div>
  );
}
