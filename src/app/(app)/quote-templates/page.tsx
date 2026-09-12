import { redirect } from "next/navigation";

// Hai thư viện mẫu cũ đã gộp thành Bộ hạng mục chuẩn. Giữ đường dẫn vì nó nằm trong
// bookmark, trong menu cũ và trong tài liệu hướng dẫn đã in cho người dùng.
export default function Page() {
  redirect("/thu-vien/bo-hang-muc");
}
