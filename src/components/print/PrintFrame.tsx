import type { ReactNode } from "react";
import { congTy } from "@/lib/company";

/** Đầu trang: thông tin công ty bên trái, quốc hiệu bên phải. */
export function PrintHeader() {
  const c = congTy();
  const lienHe = [
    c.diaChi && `Địa chỉ: ${c.diaChi}`,
    c.dienThoai && `ĐT: ${c.dienThoai}`,
    c.email && `Email: ${c.email}`,
    c.maSoThue && `MST: ${c.maSoThue}`,
    c.website,
  ].filter(Boolean) as string[];

  return (
    <header className="giu-nguyen-khoi mb-6 border-b-2 border-blue-600 pb-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-bold uppercase text-blue-600">{c.ten}</div>
          {lienHe.map((l) => (
            <div key={l} className="text-[10.5px] leading-snug text-slate-600">
              {l}
            </div>
          ))}
        </div>
        <div className="shrink-0 text-center text-[10.5px] leading-snug">
          <div className="font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</div>
          <div className="font-semibold">Độc lập - Tự do - Hạnh phúc</div>
          <div className="mx-auto mt-0.5 w-32 border-t border-black" />
        </div>
      </div>
    </header>
  );
}

/**
 * Khối chữ ký hai bên.
 *
 * `giu-nguyen-khoi` để trình duyệt không cắt đôi khối này giữa hai trang giấy — chữ
 * ký bên A nằm cuối trang 3 còn bên B sang trang 4 thì tờ in coi như hỏng.
 */
export function PrintSignatures({
  traiTieuDe = "ĐẠI DIỆN BÊN A",
  phaiTieuDe = "ĐẠI DIỆN BÊN B",
  traiPhu,
  phaiPhu,
  diaDiem,
  ngay,
}: {
  traiTieuDe?: string;
  phaiTieuDe?: string;
  traiPhu?: string | null;
  phaiPhu?: string | null;
  diaDiem?: string | null;
  ngay?: Date | null;
}) {
  const d = ngay ?? null;
  const dongNgay = d
    ? `${diaDiem ? `${diaDiem}, ` : ""}ngày ${String(d.getDate()).padStart(2, "0")} tháng ${String(
        d.getMonth() + 1
      ).padStart(2, "0")} năm ${d.getFullYear()}`
    : `${diaDiem ? `${diaDiem}, ` : ""}ngày ..... tháng ..... năm .........`;

  return (
    <div className="giu-nguyen-khoi mt-10">
      <div className="text-right text-[11px] italic">{dongNgay}</div>
      <div className="mt-3 grid grid-cols-2 gap-8 text-center">
        <div>
          <div className="text-[11px] font-bold uppercase">{traiTieuDe}</div>
          {traiPhu && <div className="text-[10.5px] text-slate-600">{traiPhu}</div>}
          <div className="text-[10px] italic text-slate-500">(Ký, ghi rõ họ tên)</div>
          <div className="h-20" />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase">{phaiTieuDe}</div>
          {phaiPhu && <div className="text-[10.5px] text-slate-600">{phaiPhu}</div>}
          <div className="text-[10px] italic text-slate-500">(Ký, ghi rõ họ tên)</div>
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}

/** Khung giấy A4: trên màn hình trông như tờ giấy, khi in thì tràn đúng khổ. */
export function PrintPage({ children }: { children: ReactNode }) {
  return (
    <div className="trang-in mx-auto my-6 min-h-[297mm] w-full max-w-[210mm] px-6 py-8 shadow-sm print:my-0 print:min-h-0 print:px-0 print:py-0 print:shadow-none">
      {children}
    </div>
  );
}
