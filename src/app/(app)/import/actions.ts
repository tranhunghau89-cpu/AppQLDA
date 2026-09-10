"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { applyEstimate, parseEstimate } from "@/lib/import/estimate";
import type { ImportKind, ImportPreview, ImportResult } from "@/lib/import/types";

export type PreviewResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string };

/** 20MB — file dự toán thật lớn nhất trong repo là ~2,8MB nên đây là dư. */
const MAX_BYTES = 20 * 1024 * 1024;

export async function previewImport(kind: ImportKind, form: FormData): Promise<PreviewResult> {
  try {
    await requirePermission("import", "edit");
  } catch {
    return { ok: false, error: "Chỉ Ban giám đốc/Quản lý được nhập dữ liệu từ Excel." };
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Chưa chọn file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `File ${(file.size / 1024 / 1024).toFixed(1)}MB, vượt giới hạn 20MB.` };
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return { ok: false, error: "Chỉ nhận file Excel (.xlsx / .xls)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    switch (kind) {
      case "estimate":
        return { ok: true, preview: await parseEstimate(buffer, file.name) };
      default:
        return { ok: false, error: "Loại nhập này chưa được hỗ trợ trên web." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[import] bóc tách thất bại:", kind, file.name, e);
    return { ok: false, error: `Không đọc được file: ${msg}` };
  }
}

/**
 * Ghi dữ liệu đã xem trước vào DB.
 *
 * `payload` đi vòng qua client nên KHÔNG được tin — mỗi module tự validate lại bằng
 * zod trước khi ghi.
 */
export async function applyImport(kind: ImportKind, payload: unknown): Promise<ImportResult> {
  let session;
  try {
    session = await requirePermission("import", "edit");
  } catch {
    return { ok: false, thongDiep: "Chỉ Ban giám đốc/Quản lý được nhập dữ liệu từ Excel." };
  }

  try {
    let ketQua: ImportResult;
    switch (kind) {
      case "estimate":
        ketQua = await applyEstimate(payload, session);
        break;
      default:
        return { ok: false, thongDiep: "Loại nhập này chưa được hỗ trợ trên web." };
    }

    if (ketQua.ok) {
      revalidatePath("/projects");
      revalidatePath("/estimates");
      if (ketQua.projectId) revalidatePath(`/projects/${ketQua.projectId}`);
    }
    return ketQua;
  } catch (e) {
    console.error("[import] ghi dữ liệu thất bại:", kind, e);
    return {
      ok: false,
      thongDiep: `Lỗi khi ghi dữ liệu: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
