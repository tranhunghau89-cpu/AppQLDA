"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { applyEstimate, parseEstimate } from "@/lib/import/estimate";
import { applyThcp, parseThcp } from "@/lib/import/thcp";
import { applyOrder, parseOrder } from "@/lib/import/order";
import { applyThuVien, parseThuVien } from "@/lib/import/thuVien";
import type { ImportKind, ImportPreview, ImportResult } from "@/lib/import/types";

export type PreviewResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string };

/**
 * 10MB. File thật lớn nhất trong kho là 5,9MB (một file THCP), nên đây là dư một
 * cách hợp lý. Phải đi cùng `serverActions.bodySizeLimit` trong next.config.ts —
 * nếu chỉ nới ở đây thì Next chặn trước, và lỗi báo ra sẽ khó hiểu.
 */
const MAX_BYTES = 10 * 1024 * 1024;

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
    return { ok: false, error: `File ${(file.size / 1024 / 1024).toFixed(1)}MB, vượt giới hạn 10MB.` };
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return { ok: false, error: "Chỉ nhận file Excel (.xlsx / .xls)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    switch (kind) {
      case "estimate":
        return { ok: true, preview: await parseEstimate(buffer, file.name) };
      case "thcp":
        return { ok: true, preview: await parseThcp(buffer, file.name) };
      case "order":
        return { ok: true, preview: await parseOrder(buffer, file.name, file.size) };
      case "thuVien":
        return { ok: true, preview: await parseThuVien(buffer, file.name) };
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
export async function applyImport(
  kind: ImportKind,
  payload: unknown,
  /**
   * File gốc, gửi lại khi bản xem trước đặt `canFileKhiXacNhan`. Bộ nhập nào cần dữ
   * liệu nhị phân trong file (ảnh biên dạng của đơn hàng) thì bóc lại từ file thay vì
   * tin payload đi vòng qua client.
   */
  form?: FormData
): Promise<ImportResult> {
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
      case "thcp":
        ketQua = await applyThcp(payload, session);
        break;
      case "order": {
        const f = form?.get("file");
        const lai =
          f instanceof File && f.size > 0 && f.size <= MAX_BYTES
            ? { buffer: Buffer.from(await f.arrayBuffer()), name: f.name, size: f.size }
            : null;
        ketQua = await applyOrder(payload, lai, session);
        break;
      }
      case "thuVien":
        ketQua = await applyThuVien(payload, session);
        break;
      default:
        return { ok: false, thongDiep: "Loại nhập này chưa được hỗ trợ trên web." };
    }

    if (ketQua.ok) {
      revalidatePath("/projects");
      revalidatePath("/estimates");
      revalidatePath("/costs");
      revalidatePath("/purchases");
      revalidatePath("/thu-vien");
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
