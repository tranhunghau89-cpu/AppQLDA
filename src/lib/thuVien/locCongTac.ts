import { norm } from "@/lib/text";

/** Phần tối thiểu của một công tác mà ô tìm cần đọc. */
export interface CongTacTimDuoc {
  code: string;
  name: string;
  tenNgan: string | null;
}

/**
 * Lọc công tác thư viện theo chuỗi người đang gõ trong ô "Nội dung công việc".
 *
 * Mỗi TỪ gõ vào phải có mặt ở đâu đó trong mã, tên hoặc tên ngắn — không bắt đúng thứ
 * tự: người lập gõ "thep hop" hay "Q345 tổ hợp" đều phải ra "Thép tổ hợp cột, kèo, dầm,
 * Q345". So sánh bỏ dấu và bỏ ký tự phân cách, nên "aa110" khớp "AA.110".
 *
 * Chuỗi rỗng trả cả danh sách: bấm vào ô là thấy ngay có gì mà chọn.
 * Giữ nguyên thứ tự thư viện (nhóm → thứ tự → mã) thay vì xếp theo độ khớp, để một
 * công tác luôn đứng cạnh các công tác cùng nhóm với nó.
 */
export function locCongTac<T extends CongTacTimDuoc>(
  danhSach: T[],
  chuoi: string,
  gioiHan = 50
): T[] {
  const tu = chuoi.split(/\s+/).map(norm).filter(Boolean);
  if (tu.length === 0) return danhSach.slice(0, gioiHan);
  const ra: T[] = [];
  for (const c of danhSach) {
    const khoa = norm(c.code) + " " + norm(c.name) + " " + norm(c.tenNgan);
    if (tu.every((t) => khoa.includes(t))) {
      ra.push(c);
      if (ra.length >= gioiHan) break;
    }
  }
  return ra;
}
