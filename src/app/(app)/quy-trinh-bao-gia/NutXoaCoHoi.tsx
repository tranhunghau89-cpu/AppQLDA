"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteCoHoi } from "../khach-hang/coHoiActions";

/** Xóa một công trình đang chào dở — kéo theo toàn bộ dự toán và báo giá của nó. */
export function NutXoaCoHoi({
  id,
  ten,
  soDuToan,
  soBaoGia,
}: {
  id: string;
  ten: string;
  soDuToan: number;
  soBaoGia: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, start] = useTransition();

  async function onXoa() {
    const keoTheo =
      soDuToan + soBaoGia > 0
        ? ` Sẽ xóa luôn ${soDuToan} dự toán và ${soBaoGia} báo giá của công trình này.`
        : "";
    if (!(await confirm(`Xóa công trình "${ten}"?${keoTheo} Không hoàn tác được.`))) return;
    start(async () => {
      const res = await deleteCoHoi(id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-red-600 hover:bg-red-50"
      aria-label="Xóa công trình"
      title="Xóa công trình"
      disabled={pending}
      onClick={onXoa}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
