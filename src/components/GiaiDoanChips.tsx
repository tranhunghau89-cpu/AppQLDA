import Link from "next/link";
import { cn } from "@/lib/utils";
import { GIAI_DOAN, type GiaiDoan } from "@/lib/giaiDoan";

/**
 * Chọn giai đoạn bằng link chứ không bằng nút.
 *
 * Trạng thái nằm trên thanh địa chỉ nên gửi link cho đồng nghiệp là họ thấy đúng cái
 * mình đang thấy, và nút Quay lại của trình duyệt chạy đúng. Không cần JavaScript nào
 * ở trình duyệt.
 */
export function GiaiDoanChips({
  duongDan,
  hienTai,
  dem,
}: {
  duongDan: string;
  hienTai: GiaiDoan;
  /** Số bản ở mỗi giai đoạn — để biết có gì bên kia trước khi bấm. */
  dem?: Partial<Record<GiaiDoan, number>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {GIAI_DOAN.map((g) => {
        const chon = g.value === hienTai;
        const so = dem?.[g.value];
        return (
          <Link
            key={g.value}
            href={g.value === "TAT_CA" ? duongDan : `${duongDan}?giai-doan=${g.value}`}
            aria-current={chon ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              chon
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {g.label}
            {so != null && (
              <span className={cn("ml-1.5", chon ? "text-blue-100" : "text-slate-400")}>
                {so}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
