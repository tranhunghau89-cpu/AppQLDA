// Supabase Storage (server-only) — lưu file HĐ/đơn hàng trên cloud.
// Dùng service_role key → CHỈ import ở server (API route / script), KHÔNG ở client.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "project-files";

let client: SupabaseClient | null = null;

/** Trả về client Supabase nếu đã cấu hình env, ngược lại null (chạy local không có Storage). */
export function getStorage(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function isStorageConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Upload buffer lên bucket, trả về key đã lưu. */
export async function uploadFile(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const s = getStorage();
  if (!s) throw new Error("Supabase Storage chưa được cấu hình (thiếu SUPABASE_URL / SERVICE_ROLE_KEY).");
  const { error } = await s.storage
    .from(STORAGE_BUCKET)
    .upload(key, data, { contentType, upsert: true });
  if (error) throw error;
  return key;
}

/** Tạo signed URL (mặc định 1 giờ) để mở/tải file private. */
export async function signedUrl(key: string, expiresIn = 3600): Promise<string | null> {
  const s = getStorage();
  if (!s) return null;
  const { data, error } = await s.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(key, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
