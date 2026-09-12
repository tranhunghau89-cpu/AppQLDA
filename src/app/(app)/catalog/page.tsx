import { redirect } from "next/navigation";

// Bảng đơn giá cũ đã thành Thư viện đơn giá. Giữ lại đường dẫn này vì nó nằm trong
// bookmark, trong lịch sử tìm kiếm và trong tài liệu hướng dẫn đã in cho người dùng.
export default function CatalogPage() {
  redirect("/thu-vien");
}
