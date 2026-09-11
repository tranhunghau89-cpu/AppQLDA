"use client";

import { useRef, useState } from "react";

/**
 * Bảng dòng sửa tại chỗ: thêm / xóa / đổi ô / đẩy lên xuống.
 *
 * Trình soạn mẫu có BỐN bảng con cùng kiểu thao tác; viết riêng bốn lần là bốn chỗ
 * để lệch nhau. `uid` chỉ sống trong trình duyệt — thứ tự thật khi lưu là vị trí
 * trong mảng, nên đẩy lên xuống không cần đụng tới số hiệu nào.
 */
export function useRows<T extends { uid: string }>(initial: T[], moi: (uid: string) => T) {
  const [rows, setRows] = useState<T[]>(initial);
  const dem = useRef(0);

  function upd<K extends keyof T>(uid: string, key: K, v: T[K]) {
    setRows((p) => p.map((r) => (r.uid === uid ? { ...r, [key]: v } : r)));
  }
  function add() {
    setRows((p) => [...p, moi(`new-${dem.current++}`)]);
  }
  function remove(uid: string) {
    setRows((p) => p.filter((r) => r.uid !== uid));
  }
  function move(uid: string, dir: -1 | 1) {
    setRows((p) => {
      const i = p.findIndex((r) => r.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const copy = [...p];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  return { rows, upd, add, remove, move };
}

export type RowsApi<T extends { uid: string }> = ReturnType<typeof useRows<T>>;
