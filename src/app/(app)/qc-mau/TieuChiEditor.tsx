"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

/** Sửa danh sách tiêu chí con: đánh số, lên/xuống, xoá, thêm. Giá trị = mỗi dòng một ý. */
export function TieuChiEditor({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  // Giữ cả dòng trống khi đang gõ; máy chủ bỏ dòng trống lúc lưu.
  const ds = value ? value.split("\n") : [];
  const doi = (next: string[]) => onChange(next.join("\n"));
  const doiCho = (i: number, j: number) => {
    if (j < 0 || j >= ds.length) return;
    const next = [...ds];
    [next[i], next[j]] = [next[j], next[i]];
    doi(next);
  };

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <div className="text-xs font-medium text-slate-600">Tiêu chí chi tiết</div>
      {ds.map((t, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-6 shrink-0 text-right text-xs text-slate-500">
            {i + 1}.
          </span>
          <Input
            value={t}
            placeholder="Nội dung tiêu chí (cách kiểm, dung sai, bằng chứng)"
            onChange={(e) =>
              doi(ds.map((x, k) => (k === i ? e.target.value.replace(/\n/g, " ") : x)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Lên"
            disabled={i === 0}
            onClick={() => doiCho(i, i - 1)}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Xuống"
            disabled={i === ds.length - 1}
            onClick={() => doiCho(i, i + 1)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Xoá tiêu chí"
            onClick={() => doi(ds.filter((_, k) => k !== i))}
          >
            <X className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => doi([...ds, ""])}>
        <Plus className="h-4 w-4" /> Thêm tiêu chí
      </Button>
    </div>
  );
}
