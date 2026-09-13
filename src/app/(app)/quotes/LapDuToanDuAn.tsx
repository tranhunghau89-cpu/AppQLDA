"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

export interface DuAnOption {
  id: string;
  code: string;
  name: string;
  soDuToan: number;
}

/**
 * Mở dự toán chào giá của một dự án từ danh sách Chào giá.
 *
 * Trang dự án không còn thẻ dự toán chào giá — đó là việc bán hàng, trang dự án chỉ giữ
 * phần thi công. Không có lối này thì dự án CHƯA có bản dự toán nào sẽ không có chỗ nào
 * trên giao diện để lập bản đầu tiên: danh sách chỉ liệt kê bản đã có.
 *
 * Chỉ dẫn sang trang dự toán của dự án, không tự tạo bản: tiêu đề, hệ số TL, khu vực
 * đều hỏi ở đó bằng đúng hộp thoại "Thêm báo giá" sẵn có.
 */
export function LapDuToanDuAn({ duAn }: { duAn: DuAnOption[] }) {
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [chon, setChon] = useState("");

  if (duAn.length === 0) return null;
  // Dự án chưa có bản nào lên đầu — đó là lý do chính người ta bấm nút này.
  const chuaCo = duAn.filter((d) => d.soDuToan === 0);
  const daCo = duAn.filter((d) => d.soDuToan > 0);

  return (
    <>
      <Button size="sm" onClick={() => setMo(true)}>
        <Plus className="h-4 w-4" /> Lập dự toán cho dự án
      </Button>
      {mo && (
        <Modal open onClose={() => setMo(false)} title="Lập dự toán chào giá cho dự án">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (chon) router.push(`/projects/${chon}/quote`);
            }}
          >
            <Field label="Dự án *">
              <Select value={chon} onChange={(e) => setChon(e.target.value)} required>
                <option value="">— Chọn dự án —</option>
                {chuaCo.length > 0 && (
                  <optgroup label="Chưa có dự toán chào giá">
                    {chuaCo.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {daCo.length > 0 && (
                  <optgroup label="Đã có dự toán chào giá">
                    {daCo.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name} ({d.soDuToan} bản)
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </Field>
            <p className="text-xs text-slate-500">
              Mở trang dự toán chào giá của dự án; bấm &quot;Thêm báo giá&quot; ở đó để lập bản mới.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMo(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={!chon}>
                Mở dự toán
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
