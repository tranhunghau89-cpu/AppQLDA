"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Copy, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import {
  createTemplate,
  duplicateTemplate,
  deleteTemplate,
  toggleTemplateActive,
} from "./actions";

export interface QuoteTemplateRow {
  id: string;
  name: string;
  buildingType: string | null;
  active: boolean;
  lineCount: number;
  specCount: number;
}

export function TemplateList({ templates }: { templates: QuoteTemplateRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  function onCreate() {
    start(async () => {
      const res = await createTemplate();
      if (res.ok) router.push(`/quote-templates/${res.id}`);
      else toast.error(res.error);
    });
  }
  function onDuplicate(id: string) {
    start(async () => {
      const res = await duplicateTemplate(id);
      if (res.ok) router.push(`/quote-templates/${res.id}`);
      else toast.error(res.error);
    });
  }
  async function onDelete(id: string, name: string) {
    if (
      !(await confirm(
        `Xóa mẫu "${name}"? (Các báo giá đã lập từ mẫu này không bị ảnh hưởng)`
      ))
    )
      return;
    start(async () => {
      const res = await deleteTemplate(id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }
  function onToggle(id: string, active: boolean) {
    start(async () => {
      await toggleTemplateActive(id, active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={onCreate} disabled={pending}>
          <Plus className="h-4 w-4" /> Tạo mẫu
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Tên mẫu</Th>
              <Th>Loại công trình</Th>
              <Th className="text-right">Hạng mục</Th>
              <Th className="text-right">Vật liệu</Th>
              <Th>Trạng thái</Th>
              <Th></Th>
            </tr>
          </THead>
          <tbody>
            {templates.length === 0 && (
              <Tr>
                <Td className="text-slate-400" colSpan={6}>
                  Chưa có mẫu nào. Bấm “Tạo mẫu” — mẫu mới đã có sẵn bảng vật liệu và
                  điều khoản mặc định.
                </Td>
              </Tr>
            )}
            {templates.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium text-slate-900">
                  <Link
                    href={`/quote-templates/${t.id}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {t.name}
                  </Link>
                </Td>
                <Td className="text-slate-600">
                  {t.buildingType ?? <span className="text-slate-400">Dùng chung</span>}
                </Td>
                <Td className="text-right text-slate-600">{t.lineCount}</Td>
                <Td className="text-right text-slate-600">{t.specCount}</Td>
                <Td>
                  <button
                    onClick={() => onToggle(t.id, !t.active)}
                    disabled={pending}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.active ? "Đang dùng" : "Ẩn"}
                  </button>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/quote-templates/${t.id}`}>
                      <Button variant="ghost" size="icon" title="Sửa" aria-label="Sửa">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Nhân bản"
                      aria-label="Nhân bản"
                      onClick={() => onDuplicate(t.id)}
                      disabled={pending}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                      title="Xóa"
                      aria-label="Xóa"
                      onClick={() => onDelete(t.id, t.name)}
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
