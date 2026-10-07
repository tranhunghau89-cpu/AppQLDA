"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Input, Select, Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { KHACH_NGUON } from "@/lib/constants";
import { saveKhachHang } from "../../khach-hang/actions";
import { saveCoHoi } from "../../khach-hang/coHoiActions";

interface KhachChon {
  id: string;
  tenCty: string;
  coHoi: { id: string; tenCongTrinh: string }[];
}

/**
 * Bước 1: khách + công trình. Dùng lại đúng hai server action của trang Khách hàng,
 * chỉ khác là cần id trả về để chuyển sang bước 2 — nên không dùng `useActionForm`.
 */
export function BuocKhachHang({ ma, khach }: { ma: string; khach: KhachChon[] }) {
  const router = useRouter();
  const [khachId, setKhachId] = useState(khach[0]?.id ?? "");
  const [moi, setMoi] = useState(khach.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dangChon = khach.find((k) => k.id === khachId);
  const sangBuoc2 = (coHoiId: string) => router.push(`/quy-trinh-bao-gia/${ma}/${coHoiId}`);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      let id = khachId;
      if (moi) {
        const r = await saveKhachHang(null, form);
        if (!r.ok) return setError(r.error);
        id = r.id;
      }
      if (!id) return setError("Chọn một khách hàng.");
      const r = await saveCoHoi(id, null, form);
      if (!r.ok) return setError(r.error);
      sangBuoc2(r.id);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4 text-sm">
          <h2 className="font-semibold text-slate-900">Khách hàng</h2>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={!moi}
              disabled={khach.length === 0}
              onChange={() => setMoi(false)}
            />
            Khách có sẵn
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={moi} onChange={() => setMoi(true)} />
            Khách mới
          </label>
        </div>

        {moi ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tên khách / công ty *">
              <Input name="tenCty" required />
            </Field>
            <Field label="Người liên hệ">
              <Input name="nguoiLienHe" />
            </Field>
            <Field label="Điện thoại">
              <Input name="phone" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
            <Field label="Địa chỉ">
              <Input name="diaChi" />
            </Field>
            <Field label="Nguồn khách">
              <Select name="nguon" defaultValue="">
                <option value="">— Chưa rõ —</option>
                {KHACH_NGUON.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <>
            <Field label="Chọn khách">
              <Select value={khachId} onChange={(e) => setKhachId(e.target.value)}>
                {khach.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.tenCty}
                  </option>
                ))}
              </Select>
            </Field>
            {dangChon && dangChon.coHoi.length > 0 && (
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <p className="mb-2 text-slate-500">
                  Khách này đang có công trình chào giá — làm tiếp công trình cũ:
                </p>
                <div className="flex flex-wrap gap-2">
                  {dangChon.coHoi.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => sangBuoc2(c.id)}
                    >
                      {c.tenCongTrinh} <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Công trình mới</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Tên công trình *">
              <Input name="tenCongTrinh" required placeholder="Nhà xưởng Hồng Ngự" />
            </Field>
          </div>
          <Field label="Loại công trình">
            <Input name="buildingType" placeholder="Nhà xưởng" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="col-span-2">
            <Field label="Địa điểm">
              <Input name="diaDiem" />
            </Field>
          </div>
          <Field label="Diện tích (m²)">
            <Input name="area" type="number" step="any" />
          </Field>
          <Field label="Bước khung K">
            <Input name="kK" type="number" step="any" />
          </Field>
          <Field label="Chiều dài L">
            <Input name="kL" type="number" step="any" />
          </Field>
        </div>
        <input type="hidden" name="trangThai" value="DANG_CHAO" />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu…" : "Tiếp"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
