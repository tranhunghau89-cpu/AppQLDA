"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileSignature,
  Loader2,
  Receipt,
  Search,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import {
  SEARCH_KIND_LABEL,
  gomTheoLoai,
  timKiem,
  type SearchDoc,
  type SearchKind,
} from "@/lib/search";
import { layDanhMucTimKiem } from "@/app/(app)/search-actions";

const ICON: Record<SearchKind, typeof Building2> = {
  project: Building2,
  customer: Users,
  supplier: Truck,
  contract: FileSignature,
  quote: Receipt,
  workPrice: Tags,
};

/**
 * Hộp tìm kiếm toàn cục, mở bằng Ctrl+K (hoặc ⌘K trên Mac).
 *
 * Danh mục được tải MỘT LẦN khi mở hộp lần đầu, rồi lọc ngay trên máy — gõ tới đâu
 * hiện tới đó, không chờ mạng. Xem chú thích đầu `lib/search.ts` để biết vì sao.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [moKhi, setMoKhi] = useState(false);
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const [chon, setChon] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const dong = useCallback(() => {
    setMoKhi(false);
    setQ("");
    setChon(0);
  }, []);

  /**
   * Tải danh mục, đúng MỘT lần cho cả phiên.
   *
   * Việc này gắn với hành động MỞ hộp tìm kiếm chứ không nằm trong một effect theo
   * dõi trạng thái mở: gọi setState thẳng trong effect là thứ React 19 cấm (cùng lỗi
   * đã gặp ở AppShell của Phase 23). Chốt bằng ref chứ không bằng state để hàm này
   * giữ nguyên danh tính, nhờ đó effect gắn phím tắt bên dưới không phải gắn lại.
   */
  const daTai = useRef(false);
  const taiDanhMuc = useCallback(() => {
    if (daTai.current) return;
    daTai.current = true;
    setDangTai(true);
    layDanhMucTimKiem()
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setDangTai(false));
  }, []);

  const mo = useCallback(() => {
    setMoKhi(true);
    taiDanhMuc();
  }, [taiDanhMuc]);

  // Phím tắt mở/đóng. Bắt ở cấp document nên gõ ở đâu cũng mở được.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMoKhi((dangMo) => {
          if (!dangMo) taiDanhMuc();
          return !dangMo;
        });
      } else if (e.key === "Escape") {
        setMoKhi(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [taiDanhMuc]);

  useEffect(() => {
    if (moKhi) inputRef.current?.focus();
  }, [moKhi]);

  const ketQua = useMemo(() => (docs ? timKiem(docs, q, 20) : []), [docs, q]);

  // Gom theo loại để hiển thị, nhưng vẫn giữ số thứ tự PHẲNG của từng dòng — phím
  // mũi tên chạy trên danh sách phẳng, còn mắt thì nhìn theo nhóm. Tính sẵn ở đây
  // thay vì đếm dần lúc dựng: đổi biến đếm giữa lúc render là thứ React cấm.
  const nhom = useMemo(() => {
    const viTriCua = new Map(ketQua.map((h, i) => [`${h.kind}-${h.id}`, i]));
    return gomTheoLoai(ketQua).map((g) => ({
      kind: g.kind,
      hits: g.hits.map((h) => ({ ...h, vt: viTriCua.get(`${h.kind}-${h.id}`) ?? 0 })),
    }));
  }, [ketQua]);

  // Chỉ số đang chọn không được trỏ ra ngoài danh sách sau mỗi lần gõ.
  const viTri = ketQua.length ? Math.min(chon, ketQua.length - 1) : 0;

  function di(href: string) {
    dong();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setChon((c) => (ketQua.length ? (c + 1) % ketQua.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setChon((c) => (ketQua.length ? (c - 1 + ketQua.length) % ketQua.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chonRa = ketQua[viTri];
      if (chonRa) di(chonRa.href);
    }
  }

  return (
    <>
      {/* Ô bấm trên thanh trên. Trên điện thoại chỉ hiện biểu tượng. */}
      <button
        type="button"
        onClick={mo}
        aria-label="Tìm kiếm"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-400 hover:bg-slate-50 sm:w-56 sm:px-3"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 text-left sm:inline">Tìm kiếm...</span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
          Ctrl K
        </kbd>
      </button>

      {moKhi && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]"
          onClick={dong}
          role="presentation"
        >
          <div
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Tìm kiếm toàn cục"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setChon(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Tìm dự án, chủ đầu tư, hợp đồng, mã đơn giá..."
                className="min-w-0 flex-1 py-3.5 text-sm outline-none placeholder:text-slate-400"
                aria-label="Từ khóa tìm kiếm"
              />
              {dangTai && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-300" aria-hidden="true" />
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {!q && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  Gõ để tìm. Không cần dấu — &quot;ha nam&quot; vẫn ra &quot;Hà Nam&quot;.
                </p>
              )}
              {q && !dangTai && ketQua.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  Không có kết quả cho &quot;{q}&quot;.
                </p>
              )}

              {nhom.map((g) => (
                <div key={g.kind} className="mb-1">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {SEARCH_KIND_LABEL[g.kind]}
                  </div>
                  {g.hits.map((h) => {
                    const Icon = ICON[h.kind];
                    const dangChon = h.vt === viTri;
                    return (
                      <button
                        key={`${h.kind}-${h.id}`}
                        type="button"
                        onClick={() => di(h.href)}
                        onMouseEnter={() => setChon(h.vt)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                          dangChon ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-900">{h.title}</span>
                          {h.subtitle && (
                            <span className="block truncate text-xs text-slate-500">
                              {h.subtitle}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="hidden items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 sm:flex">
              <span>↑↓ di chuyển</span>
              <span>↵ mở</span>
              <span>Esc đóng</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
