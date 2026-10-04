// Chia sổ tay (một chuỗi HTML dài trong noiDung.ts) thành từng phần để mỗi người chỉ mở
// phần của phòng mình: tab "Chung" + một tab cho mỗi phòng ban. Nội dung vẫn viết một chỗ;
// ở đây chỉ cắt theo `<section class="part" id=…>` và dựng mục lục theo phần đang mở.
import type { Role } from "@/lib/rbac";
import { NOI_DUNG_SO_TAY } from "./noiDung";

export type KhoaPhan = "chung" | "bgd" | "kd" | "kt" | "vt" | "ke";

type Phan = {
  khoa: KhoaPhan;
  ten: string;
  /** Vai trò mở thẳng tab này khi vào sổ tay. */
  vaiTro?: Role;
  /** `id` các `<section>` thuộc phần này, theo thứ tự hiển thị. */
  muc: { id: string; ten: string; con?: { id: string; ten: string }[] }[];
};

export const CAC_PHAN: Phan[] = [
  {
    khoa: "chung",
    ten: "Chung",
    muc: [
      { id: "bat-dau", ten: "Đăng nhập & giao diện" },
      { id: "thao-tac-chung", ten: "Thao tác dùng chung" },
      { id: "luong", ten: "Vòng đời một công trình" },
      { id: "quyen", ten: "Ai được làm gì" },
    ],
  },
  {
    khoa: "bgd",
    ten: "Ban giám đốc",
    vaiTro: "ADMIN",
    muc: [
      {
        id: "bgd",
        ten: "Ban giám đốc / Quản lý",
        con: [
          { id: "bgd-nguoi-dung", ten: "Tài khoản người dùng" },
          { id: "bgd-phan-cong", ten: "Phân công dự án & khách" },
          { id: "bgd-thu-vien", ten: "Thư viện đơn giá" },
          { id: "bgd-bo-hang-muc", ten: "Bộ hạng mục chuẩn" },
          { id: "bgd-duyet", ten: "Duyệt đề xuất" },
          { id: "bgd-theo-doi", ten: "Theo dõi & báo cáo" },
        ],
      },
    ],
  },
  {
    khoa: "kd",
    ten: "Kinh doanh",
    vaiTro: "SALES",
    muc: [
      {
        id: "kd",
        ten: "Phòng Kinh doanh",
        con: [
          { id: "kd-khach", ten: "Khách hàng & trao đổi" },
          { id: "kd-du-toan", ten: "Dự toán chào giá" },
          { id: "kd-bao-gia", ten: "Báo giá gửi khách" },
          { id: "kd-tao-du-an", ten: "Ký hợp đồng → tạo dự án" },
          { id: "kd-hop-dong", ten: "Hợp đồng & hồ sơ" },
        ],
      },
    ],
  },
  {
    khoa: "kt",
    ten: "Kỹ thuật",
    vaiTro: "ENGINEERING",
    muc: [
      {
        id: "kt",
        ten: "Phòng Kỹ thuật",
        con: [
          { id: "kt-du-an", ten: "Thông tin dự án" },
          { id: "kt-tien-do", ten: "Mốc tiến độ & Gantt" },
          { id: "kt-nhat-ky", ten: "Nhật ký & shopdrawing" },
          { id: "kt-tra-cuu", ten: "Tra cứu & bóc khối lượng" },
        ],
      },
    ],
  },
  {
    khoa: "vt",
    ten: "Vật tư",
    vaiTro: "PROCUREMENT",
    muc: [
      {
        id: "vt",
        ten: "Phòng Vật tư",
        con: [
          { id: "vt-du-toan", ten: "Dự toán thi công" },
          { id: "vt-bang-boc", ten: "Bảng bóc từ Excel" },
          { id: "vt-don-hang", ten: "Đơn hàng" },
          { id: "vt-ncc", ten: "Nhà cung cấp" },
        ],
      },
    ],
  },
  {
    khoa: "ke",
    ten: "Kế toán",
    vaiTro: "ACCOUNTING",
    muc: [
      {
        id: "ke-toan",
        ten: "Phòng Kế toán",
        con: [
          { id: "kt2-dot", ten: "Thu – chi theo đợt" },
          { id: "kt2-cong-no", ten: "Công nợ" },
          { id: "kt2-chi-phi", ten: "Chi phí & báo cáo kỳ" },
        ],
      },
    ],
  },
];

export function docKhoaPhan(v: string | string[] | undefined): KhoaPhan | null {
  const s = Array.isArray(v) ? v[0] : v;
  return CAC_PHAN.find((p) => p.khoa === s)?.khoa ?? null;
}

/** Tab mở sẵn: phần của vai trò người đang xem, không có thì "Chung". */
export function phanMacDinh(vaiTro: Role | null): KhoaPhan {
  return CAC_PHAN.find((p) => p.vaiTro && p.vaiTro === vaiTro)?.khoa ?? "chung";
}

const PHAN_CAT = /<section class="part" id="([^"]+)">[\s\S]*?<\/section>/g;
const sections = new Map<string, string>();
for (const m of NOI_DUNG_SO_TAY.matchAll(PHAN_CAT)) sections.set(m[1], m[0]);
const dauTrang = NOI_DUNG_SO_TAY.match(/<header class="intro">[\s\S]*?<\/header>/)?.[0] ?? "";
const chanTrang = NOI_DUNG_SO_TAY.match(/<footer>[\s\S]*?<\/footer>/)?.[0] ?? "";

// Mỗi `id` (phần lẫn việc con) thuộc tab nào — để liên kết chéo giữa các tab đổi thành
// `?phong=…#id` thay vì neo trống trên trang hiện tại.
const TAB_CUA_ID = new Map<string, KhoaPhan>();
for (const p of CAC_PHAN) {
  for (const mu of p.muc) {
    const html = sections.get(mu.id) ?? "";
    TAB_CUA_ID.set(mu.id, p.khoa);
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) TAB_CUA_ID.set(m[1], p.khoa);
  }
}

function noiLienKet(html: string, hienTai: KhoaPhan): string {
  return html.replace(/href="#([^"]+)"/g, (g, id: string) => {
    const tab = TAB_CUA_ID.get(id);
    return tab && tab !== hienTai ? `href="?phong=${tab}#${id}"` : g;
  });
}

function mucLuc(p: Phan): string {
  const li = p.muc
    .map((mu) => {
      const goc = `<li class="dept"><a href="#${mu.id}">${mu.ten}</a></li>`;
      const con = (mu.con ?? []).map((c) => `<li class="sub"><a href="#${c.id}">${c.ten}</a></li>`);
      return goc + con.join("");
    })
    .join("");
  const nhan = p.khoa === "chung" ? "Chung cho mọi người" : `Phần ${p.ten}`;
  return `<aside class="toc"><nav aria-label="Mục lục"><div><h4>${nhan}</h4><ul>${li}</ul></div></nav></aside>`;
}

/** HTML của một phần: mục lục + nội dung. Phần "Chung" có thêm lời giới thiệu đầu trang. */
export function htmlPhan(khoa: KhoaPhan): string {
  const p = CAC_PHAN.find((x) => x.khoa === khoa) ?? CAC_PHAN[0];
  const than = p.muc.map((mu) => sections.get(mu.id) ?? "").join("");
  const html = `${mucLuc(p)}<main>${p.khoa === "chung" ? dauTrang : ""}${than}${chanTrang}</main>`;
  return noiLienKet(html, p.khoa);
}
