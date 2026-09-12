"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { applyImport, previewImport } from "./actions";
import type { ImportKind, ImportPreview } from "@/lib/import/types";

export function ImportWizard({
  kinds,
}: {
  /** Các loại nhập đang hỗ trợ trên web, kèm nhãn và mô tả nguồn file. */
  kinds: { value: ImportKind; label: string; moTa: string; sanSang: boolean }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  const [kind, setKind] = useState<ImportKind>(kinds.find((k) => k.sanSang)?.value ?? "estimate");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [xong, setXong] = useState<string | null>(null);
  // File vừa xem trước. Bộ nhập đơn hàng cần gửi lại chính file này khi xác nhận
  // (ảnh biên dạng quá lớn để đi vòng qua client), nên phải giữ lại tham chiếu.
  const [fileDaXem, setFileDaXem] = useState<File | null>(null);

  function onPreview(form: FormData) {
    setPreview(null);
    setXong(null);
    const f = form.get("file");
    setFileDaXem(f instanceof File ? f : null);
    start(async () => {
      const res = await previewImport(kind, form);
      if (!res.ok) toast.error(res.error);
      else setPreview(res.preview);
    });
  }

  function onConfirm() {
    if (!preview) return;
    let form: FormData | undefined;
    if (preview.canFileKhiXacNhan) {
      if (!fileDaXem) {
        toast.error("Không còn giữ được file — hãy chọn lại file và xem trước lần nữa.");
        return;
      }
      form = new FormData();
      form.set("file", fileDaXem);
    }
    start(async () => {
      const res = await applyImport(preview.kind, preview.payload, form);
      if (!res.ok) {
        toast.error(res.thongDiep);
        return;
      }
      toast.success(res.thongDiep);
      setXong(res.thongDiep);
      setPreview(null);
      setFileDaXem(null);
      formRef.current?.reset();
      router.refresh();
    });
  }

  const loaiHienTai = kinds.find((k) => k.value === kind);

  return (
    <div className="space-y-6">
      {/* Bước 1 — chọn loại & file */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900">1. Chọn loại dữ liệu và file</h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              disabled={!k.sanSang}
              onClick={() => {
                setKind(k.value);
                setPreview(null);
                setXong(null);
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                kind === k.value
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : k.sanSang
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
              }`}
            >
              <div className="font-medium">{k.label}</div>
              <div className="text-xs opacity-70">{k.sanSang ? k.moTa : "Chưa hỗ trợ trên web"}</div>
            </button>
          ))}
        </div>

        <form ref={formRef} action={onPreview} className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            required
            aria-label="Chọn file Excel"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
          />
          <Button type="submit" disabled={pending || !loaiHienTai?.sanSang}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {pending ? "Đang đọc..." : "Xem trước"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Bước này chỉ ĐỌC file, chưa ghi gì vào cơ sở dữ liệu.
        </p>
      </section>

      {xong && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{xong}</span>
        </div>
      )}

      {/* Bước 2 — xem trước */}
      {preview && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">2. Kiểm tra trước khi ghi</h2>
            <span className="font-mono text-xs text-slate-500">{preview.fileName}</span>
          </div>

          {preview.duAn && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                preview.duAn.taoMoi
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <span className="font-medium">Dự án đích: </span>
              {preview.duAn.code && <span className="font-mono">{preview.duAn.code} </span>}
              {preview.duAn.name}
              <div className="text-xs opacity-80">{preview.duAn.cachKhop}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {preview.thongKe.map((s) => (
              <div key={s.nhan} className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">{s.nhan}</div>
                <div className="mt-0.5 font-semibold text-slate-900">{s.giaTri}</div>
              </div>
            ))}
          </div>

          {preview.canhBao.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Cần đọc trước khi xác nhận ({preview.canhBao.length})
              </div>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-900">
                {preview.canhBao.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-xs text-slate-500">
              {preview.tongSoDong} dòng — hiển thị {preview.dongMau.length} dòng đầu
            </div>
            <Table>
              <THead>
                <tr>
                  {preview.tieuDeCot.map((h, i) => (
                    <Th key={h} hideBelow={i >= 3 ? "sm" : undefined}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </THead>
              <tbody>
                {preview.dongMau.map((r, i) => (
                  <Tr key={i}>
                    {r.cot.map((c, j) => (
                      <Td key={j} hideBelow={j >= 3 ? "sm" : undefined}>
                        {c}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Bước 3 — xác nhận */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setPreview(null)} disabled={pending}>
              Hủy
            </Button>
            <Button
              onClick={onConfirm}
              disabled={pending || preview.tongSoDong === 0 || preview.payload == null}
            >
              {pending
                ? "Đang ghi..."
                : preview.payload == null
                  ? "Không ghi được — xem cảnh báo ở trên"
                  : `3. Xác nhận ghi ${preview.tongSoDong} dòng`}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
