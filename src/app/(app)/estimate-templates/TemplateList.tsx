"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Copy, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { createTemplate, duplicateTemplate, deleteTemplate, toggleTemplateActive } from "./actions";

export interface TemplateRow {
  id: string;
  code: string | null;
  name: string;
  active: boolean;
  lineCount: number;
}

export function TemplateList({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onCreate() {
    start(async () => {
      const res = await createTemplate();
      if (res.ok) router.push(`/estimate-templates/${res.id}`);
      else alert(res.error);
    });
  }
  function onDuplicate(id: string) {
    start(async () => {
      const res = await duplicateTemplate(id);
      if (res.ok) router.push(`/estimate-templates/${res.id}`);
      else alert(res.error);
    });
  }
  function onDelete(id: string, name: string) {
    if (!window.confirm(`Xóa mẫu "${name}"? (Các hạng mục đã tạo ở dự án không bị ảnh hưởng)`)) return;
    start(async () => {
      const res = await deleteTemplate(id);
      if (!res.ok) alert(res.error);
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
              <Th>Mã</Th>
              <Th>Tên mẫu</Th>
              <Th className="text-right">Số dòng</Th>
              <Th>Trạng thái</Th>
              <Th></Th>
            </tr>
          </THead>
          <tbody>
            {templates.length === 0 && (
              <Tr>
                <Td className="text-slate-400" colSpan={5}>
                  Chưa có mẫu nào.
                </Td>
              </Tr>
            )}
            {templates.map((t) => (
              <Tr key={t.id}>
                <Td className="font-mono text-slate-500">{t.code ?? "—"}</Td>
                <Td className="font-medium text-slate-900">
                  <Link href={`/estimate-templates/${t.id}`} className="hover:text-blue-600 hover:underline">
                    {t.name}
                  </Link>
                </Td>
                <Td className="text-right text-slate-600">{t.lineCount}</Td>
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
                    <Link href={`/estimate-templates/${t.id}`}>
                      <Button variant="ghost" size="icon" title="Sửa">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" title="Nhân bản" onClick={() => onDuplicate(t.id)} disabled={pending}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                      title="Xóa"
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
