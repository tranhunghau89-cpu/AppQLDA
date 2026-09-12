"use server";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { scopedProjectWhere, scopedByProjectWhere, myProjectIds } from "@/lib/scope";
import { whereBaoGiaTrongPhamVi } from "@/lib/crmScope";
import type { SearchDoc } from "@/lib/search";

/**
 * Dựng danh mục tìm kiếm cho ĐÚNG người đang đăng nhập.
 *
 * Gọi một lần khi mở hộp tìm kiếm; việc lọc theo chữ gõ vào làm hẳn ở phía trình
 * duyệt (xem chú thích đầu `lib/search.ts`).
 *
 * Hai lớp lọc, cả hai đều bắt buộc:
 *  - **RBAC**: vai trò không xem được loại nào thì loại đó không có trong danh mục.
 *  - **Phạm vi dự án**: chỉ dự án được phân công, và hợp đồng/báo giá thuộc các dự án
 *    đó. Nếu bỏ lớp này thì ô tìm kiếm trở thành đường vòng để đọc tên mọi dự án
 *    trong công ty — đúng thứ Phase 21 dựng lên để chặn.
 */
export async function layDanhMucTimKiem(): Promise<SearchDoc[]> {
  const session = await requireSession();
  const role = session.role;

  const [duAn, khach, ncc, hopDong, baoGia, maCV] = await Promise.all([
    can(role, "project", "view")
      ? db.project.findMany({
          where: await scopedProjectWhere(session),
          select: {
            id: true,
            code: true,
            name: true,
            location: true,
            customer: { select: { name: true } },
          },
          orderBy: { code: "asc" },
        })
      : [],
    can(role, "customer", "view")
      ? db.customer.findMany({
          select: { id: true, name: true, phone: true, contactPerson: true, address: true },
          orderBy: { name: "asc" },
        })
      : [],
    can(role, "supplier", "view")
      ? db.supplier.findMany({
          select: { id: true, name: true, phone: true, contactPerson: true, category: true },
          orderBy: { name: "asc" },
        })
      : [],
    can(role, "contract", "view")
      ? db.contract.findMany({
          where: await scopedByProjectWhere(session),
          select: {
            id: true,
            contractNo: true,
            subject: true,
            partyAName: true,
            project: { select: { id: true, code: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    can(role, "quote", "view")
      ? db.quote.findMany({
          where: whereBaoGiaTrongPhamVi(session, await myProjectIds(session)),
          select: {
            id: true,
            title: true,
            recipient: true,
            project: { select: { id: true, code: true, name: true } },
            coHoi: { select: { id: true, tenCongTrinh: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    // Thư viện công tác dùng chung, không thuộc dự án nào nên không cần lọc phạm vi.
    can(role, "thuVien", "view")
      ? db.congTac.findMany({
          where: { active: true },
          select: { id: true, ma: true, ten: true, donVi: true, nhomMa: true },
          orderBy: [{ nhomMa: "asc" }, { sortOrder: "asc" }],
        })
      : [],
  ]);

  const docs: SearchDoc[] = [];

  for (const p of duAn) {
    docs.push({
      kind: "project",
      id: p.id,
      title: p.name,
      subtitle: [p.code, p.location, p.customer?.name].filter(Boolean).join(" · "),
      href: `/projects/${p.id}`,
      // Tên trước, rồi mã, rồi các trường phụ — thứ tự này quyết định điểm số.
      terms: [p.name, p.code, p.location ?? "", p.customer?.name ?? ""].filter(Boolean),
    });
  }

  for (const c of khach) {
    docs.push({
      kind: "customer",
      id: c.id,
      title: c.name,
      subtitle: [c.contactPerson, c.phone].filter(Boolean).join(" · ") || null,
      href: `/customers`,
      terms: [c.name, c.contactPerson ?? "", c.phone ?? "", c.address ?? ""].filter(Boolean),
    });
  }

  for (const s of ncc) {
    docs.push({
      kind: "supplier",
      id: s.id,
      title: s.name,
      subtitle: [s.category, s.contactPerson, s.phone].filter(Boolean).join(" · ") || null,
      href: `/suppliers`,
      terms: [s.name, s.category, s.contactPerson ?? "", s.phone ?? ""].filter(Boolean),
    });
  }

  for (const h of hopDong) {
    docs.push({
      kind: "contract",
      id: h.id,
      title: h.contractNo ?? h.subject ?? "(hợp đồng chưa có số)",
      subtitle: `${h.project.code} · ${h.project.name}`,
      href: `/projects/${h.project.id}/contract`,
      terms: [
        h.contractNo ?? "",
        h.subject ?? "",
        h.partyAName ?? "",
        h.project.code,
        h.project.name,
      ].filter(Boolean),
    });
  }

  for (const b of baoGia) {
    // Dự toán ở cơ hội chưa có mã dự án nào để hiện — lấy tên công trình đang chào giá.
    const noi = b.project
      ? { nhan: `${b.project.code} · ${b.project.name}`, href: `/projects/${b.project.id}/quote`, tu: [b.project.code, b.project.name] }
      : b.coHoi
        ? { nhan: `${b.coHoi.tenCongTrinh} · đang chào giá`, href: `/co-hoi/${b.coHoi.id}/quote`, tu: [b.coHoi.tenCongTrinh] }
        : null;
    if (!noi) continue;
    docs.push({
      kind: "quote",
      id: b.id,
      title: b.title,
      subtitle: noi.nhan,
      href: noi.href,
      terms: [b.title, b.recipient ?? "", ...noi.tu].filter(Boolean),
    });
  }

  for (const m of maCV) {
    docs.push({
      kind: "workPrice",
      id: m.id,
      title: m.ten,
      subtitle: [m.ma, m.donVi, m.nhomMa].filter(Boolean).join(" · "),
      href: `/thu-vien/cong-tac/${m.id}`,
      // Mã CV đứng trước tên: người dùng thường nhớ mã ("AA.110") hơn nội dung.
      terms: [m.ma, m.ten, m.nhomMa].filter(Boolean),
    });
  }

  return docs;
}
