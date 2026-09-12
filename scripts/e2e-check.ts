// Chạy 5 kịch bản kiểm thử end-to-end mà `plan/24` để lại.
//
// Vì sao là script chứ không phải một bộ khung test (Playwright/Cypress): năm kịch bản
// này kiểm **phân quyền ở tầng HTTP**, không kiểm giao diện. Chúng chỉ cần gọi request
// và đọc mã trạng thái — thêm một bộ khung trình duyệt vào đây là đắt mà không mua thêm
// được gì.
//
//   npm run dev        # cửa sổ 1
//   npm run e2e        # cửa sổ 2
//
// ---------------------------------------------------------------------------
// HAI CÁCH LẤY PHIÊN ĐĂNG NHẬP
//
// A. Tài khoản thật — đặt E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD và
//    E2E_USER_EMAIL / E2E_USER_PASSWORD. Script đăng nhập qua đúng form thật.
//
// B. Tài khoản thử tạm (mặc định) — script tự tạo HAI tài khoản dùng một lần rồi
//    tự ký phiên bằng `signSession`, đúng hàm mà máy chủ vẫn dùng sau khi kiểm mật
//    khẩu xong. Chạy xong xóa sạch.
//
// Vì sao cách B là mặc định:
//   · Không cần mật khẩu của ai, không đọc và không đổi mật khẩu của bất kỳ ai.
//   · KHÔNG đụng vào tài khoản đang dùng thật — mọi thao tác ghi chỉ nhắm vào hai
//     tài khoản do chính script tạo ra.
//   · Quan trọng nhất: sau `members:backfill`, **mọi tài khoản thật đều được gán
//     TẤT CẢ dự án**, nên không còn dự án nào nằm ngoài phạm vi để mà kiểm. Muốn
//     kiểm được kịch bản 1 và 2 thì bắt buộc phải có một tài khoản chỉ nắm một
//     phần dự án.
//
// Cách B KHÔNG kiểm được form đăng nhập (nó bỏ qua bước so mật khẩu) — nhưng kịch
// bản 4 đã kiểm đúng chỗ đó, còn kịch bản 1/2/3/5 nói về chuyện SAU khi đăng nhập.
// ---------------------------------------------------------------------------
import crypto from "crypto";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, signSession } from "../src/lib/session";
import type { Role } from "../src/lib/rbac";

const db = new PrismaClient();
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
/** Số dự án gán cho tài khoản thử — phải nhỏ hơn tổng để còn dự án ngoài phạm vi. */
const SO_DU_AN_GAN = 3;

let soDat = 0;
let soTruot = 0;
let soBoQua = 0;

function dat(ten: string, chiTiet = "") {
  soDat++;
  console.log(`  ✔ ${ten}${chiTiet ? ` — ${chiTiet}` : ""}`);
}
function truot(ten: string, chiTiet: string) {
  soTruot++;
  console.log(`  ✘ ${ten} — ${chiTiet}`);
}
function boQua(ten: string, lyDo: string) {
  soBoQua++;
  console.log(`  – ${ten} (bỏ qua: ${lyDo})`);
}

/** Một phiên: giữ cookie và KHÔNG tự đi theo chuyển hướng (307 chính là thứ cần đo). */
class Phien {
  private cookie = "";

  static tuToken(token: string): Phien {
    const p = new Phien();
    p.cookie = `${SESSION_COOKIE}=${token}`;
    return p;
  }

  static async dangNhap(email: string, password: string): Promise<Phien> {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    if (!res.ok) {
      throw new Error(`đăng nhập ${email} thất bại: ${res.status} ${await res.text()}`);
    }
    const p = new Phien();
    p.cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!p.cookie) throw new Error("máy chủ không trả cookie phiên");
    return p;
  }

  get(duongDan: string): Promise<Response> {
    return fetch(`${BASE}${duongDan}`, {
      headers: { Cookie: this.cookie },
      redirect: "manual",
    });
  }
}

/**
 * Đọc file Excel trả về từ /api/reports/summary, gom mọi mã dự án xuất hiện.
 *
 * Nhận vào tập mã THẬT lấy từ DB thay vì dò bằng biểu thức chính quy. Bản đầu tôi
 * dùng regex `N\d{3}|DT\d{2}|DEMO\d+` và nó bỏ sót mất 57/123 mã — dữ liệu thật có
 * tới sáu dạng mã (`N037`, `D24A-01`, `D24-04`, `DT01`, `D24B-02`, `DEMO1`). Phép
 * kiểm khi đó vẫn "đạt" nhưng là đạt rỗng, vì nó không nhìn thấy phần lớn dữ liệu.
 */
async function maDuAnTrongExcel(res: Response, maHopLe: Set<string>): Promise<Set<string>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  const ma = new Set<string>();
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      const s = typeof v === "string" ? v.trim() : "";
      if (maHopLe.has(s)) ma.add(s);
    });
  });
  return ma;
}

/**
 * Kịch bản 4 — chống dò mật khẩu.
 *
 * PHẢI chạy CUỐI CÙNG. Bộ chặn đếm theo cả IP lẫn email, nên 10 lần sai ở đây làm
 * chính IP này bị khóa 15 phút — chạy trước thì mọi lần đăng nhập của các kịch bản
 * còn lại đều nhận 429. (Đã vấp đúng lỗi này lần chạy đầu.)
 */
async function kichBan4(): Promise<void> {
  console.log("\nKịch bản 4 — chống dò mật khẩu (chạy cuối vì nó khóa IP 15 phút)");
  // Email không tồn tại: không đụng tới tài khoản thật nào, không khóa nhầm ai.
  const email = `e2e-${Date.now()}@example.invalid`;
  let ma429 = 0;
  let retryAfter: string | null = null;
  let lanBiChan = 0;
  for (let i = 1; i <= 12; i++) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "sai-mat-khau" }),
      redirect: "manual",
    });
    if (res.status === 429) {
      if (!ma429) lanBiChan = i;
      ma429++;
      retryAfter ??= res.headers.get("Retry-After");
    }
    await res.text();
  }
  if (ma429 > 0 && lanBiChan === 11 && retryAfter) {
    dat("10 lần sai rồi bị chặn", `lần ${lanBiChan} trả 429, Retry-After ${retryAfter}s`);
  } else if (lanBiChan === 1) {
    // Bộ chặn nằm trong bộ nhớ tiến trình và đếm theo IP, nên chạy script hai lần
    // trong vòng 15 phút thì lần sau bị chặn ngay từ request đầu. Đó là trạng thái
    // của môi trường chứ không phải lỗi mã — báo BỎ QUA, đừng báo trượt.
    boQua(
      "10 lần sai rồi bị chặn",
      "IP đang bị chặn sẵn từ lần chạy trước; chờ hết 15 phút hoặc khởi động lại dev server"
    );
  } else if (ma429 > 0) {
    truot("10 lần sai rồi bị chặn", `bị chặn từ lần ${lanBiChan} (mong đợi lần 11)`);
  } else {
    truot("10 lần sai rồi bị chặn", "không lần nào trả 429 — bộ chặn không hoạt động");
  }
}

interface TaiKhoanThu {
  id: string;
  email: string;
  role: Role;
  tokenVersion: number;
}

/** Tạo một tài khoản dùng một lần. Mật khẩu là chuỗi ngẫu nhiên bị vứt đi ngay. */
async function taoTaiKhoanTam(role: Role, hau: string): Promise<TaiKhoanThu> {
  const email = `e2e-tam-${hau}-${Date.now()}@example.invalid`;
  // Băm một chuỗi ngẫu nhiên rồi quên nó: không ai đăng nhập được bằng tài khoản này,
  // kể cả script — phiên được ký thẳng chứ không qua form.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
  const u = await db.user.create({
    data: { email, name: `E2E tạm (${role})`, passwordHash, role, active: true },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  return { ...u, role: u.role as Role };
}

function kySession(u: TaiKhoanThu, tokenVersion = u.tokenVersion): Promise<string> {
  return signSession({
    userId: u.id,
    email: u.email,
    name: `E2E tạm (${u.role})`,
    role: u.role,
    tokenVersion,
  });
}

async function main() {
  console.log(`Kiểm thử end-to-end trên ${BASE}\n`);

  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPass = process.env.E2E_ADMIN_PASSWORD;
  const userEmail = process.env.E2E_USER_EMAIL;
  const userPass = process.env.E2E_USER_PASSWORD;
  const dungTaiKhoanThat = !!(adminEmail && adminPass && userEmail && userPass);

  const tatCa = await db.project.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  // Tập mã thật, dùng để nhận ra dòng dự án trong file Excel xuất ra.
  const moiMa = new Set(tatCa.map((p) => p.code));
  if (tatCa.length < SO_DU_AN_GAN + 1) {
    throw new Error(`cần ít nhất ${SO_DU_AN_GAN + 1} dự án để kiểm phạm vi, đang có ${tatCa.length}`);
  }

  let admin: Phien;
  let user: Phien;
  let userId: string;
  let nhan: string;
  let duocGan: Set<string>;
  let donDep: () => Promise<void> = async () => {};
  let tamSales: TaiKhoanThu | null = null;

  if (dungTaiKhoanThat) {
    console.log("Dùng tài khoản thật (đăng nhập qua form)\n");
    admin = await Phien.dangNhap(adminEmail, adminPass);
    user = await Phien.dangNhap(userEmail, userPass);
    const nd = await db.user.findUnique({
      where: { email: userEmail },
      select: { id: true, role: true, name: true },
    });
    if (!nd) throw new Error(`không tìm thấy user ${userEmail} trong DB`);
    if (nd.role === "ADMIN") {
      throw new Error(`E2E_USER_EMAIL phải là tài khoản KHÔNG phải ADMIN (đang là ${nd.role})`);
    }
    userId = nd.id;
    nhan = `${nd.name} (${nd.role})`;
    duocGan = new Set(
      (await db.projectMember.findMany({ where: { userId: nd.id }, select: { projectId: true } })).map(
        (m) => m.projectId
      )
    );
  } else {
    console.log("Dùng tài khoản thử tạm (tự ký phiên; không đụng tài khoản thật nào)\n");
    const tamAdmin = await taoTaiKhoanTam("ADMIN", "admin");
    tamSales = await taoTaiKhoanTam("SALES", "sales");
    const ganCho = tatCa.slice(0, SO_DU_AN_GAN);
    await db.projectMember.createMany({
      data: ganCho.map((p) => ({ projectId: p.id, userId: tamSales!.id })),
    });

    // Dọn dẹp phải chạy dù kiểm thành công hay thất bại. Xóa user kéo theo
    // ProjectMember nhờ onDelete: Cascade.
    donDep = async () => {
      await db.user.deleteMany({
        where: { id: { in: [tamAdmin.id, tamSales!.id] } },
      });
      console.log(`\n(đã xóa 2 tài khoản thử tạm)`);
    };

    admin = Phien.tuToken(await kySession(tamAdmin));
    user = Phien.tuToken(await kySession(tamSales));
    userId = tamSales.id;
    nhan = `E2E tạm (SALES)`;
    duocGan = new Set(ganCho.map((p) => p.id));
  }

  try {
    const ngoaiPhamVi = tatCa.find((p) => !duocGan.has(p.id));
    const trongPhamVi = tatCa.find((p) => duocGan.has(p.id));
    console.log(`Tài khoản thử: ${nhan} — được gán ${duocGan.size}/${tatCa.length} dự án`);

    // ---- Kịch bản 1 ----
    //
    // `plan/24` viết kịch bản này là "phải ra 404". Chạy thật thì thấy trang trả **200**
    // — kể cả với một id hoàn toàn không tồn tại. Đọc lại tài liệu Next 16
    // (`file-conventions/loading.md`, mục Status Codes) thì đó là hành vi CÓ CHỦ ĐÍCH:
    //
    //   "When streaming, a 200 status code will be returned... Because the response
    //    headers have already been sent, the status code cannot be updated."
    //
    // Streaming bắt đầu ngay khi có một Suspense boundary, mà app này có
    // `(app)/loading.tsx`. Next bù lại bằng cách chèn <meta name="robots" content="noindex">
    // vào HTML.
    //
    // Vậy assertion cũ SAI, không phải code sai. Thứ thật sự cần bảo đảm là **không lộ
    // dữ liệu** — nên kiểm đúng điều đó. (Route API không stream nên vẫn trả 404 đúng,
    // xem kịch bản 2.)
    console.log("\nKịch bản 1 — trang dự án ngoài phạm vi không được lộ dữ liệu");
    if (!ngoaiPhamVi) {
      boQua("trang dự án ngoài phạm vi", "tài khoản này đang được gán TẤT CẢ dự án");
    } else {
      const res = await user.get(`/projects/${ngoaiPhamVi.id}`);
      const html = await res.text();
      const loTen = html.includes(ngoaiPhamVi.name);
      const loMa = html.includes(ngoaiPhamVi.code);
      if (!loTen && !loMa) {
        dat(
          "trang dự án ngoài phạm vi không chứa tên lẫn mã dự án",
          `${ngoaiPhamVi.code}, HTTP ${res.status} (200 là đúng khi có streaming)`
        );
      } else {
        truot(
          "trang dự án ngoài phạm vi không chứa tên lẫn mã dự án",
          `LỘ ${loTen ? "tên" : ""}${loTen && loMa ? " và " : ""}${loMa ? "mã" : ""} của ${ngoaiPhamVi.code}`
        );
      }
    }
    // Đối chứng: nếu dự án TRONG phạm vi cũng không hiện dữ liệu thì phép kiểm trên vô
    // nghĩa — nó chỉ chứng minh trang hỏng, không chứng minh phạm vi có tác dụng.
    if (trongPhamVi) {
      const res = await user.get(`/projects/${trongPhamVi.id}`);
      const html = await res.text();
      if (res.status === 200 && html.includes(trongPhamVi.name)) {
        dat("đối chứng: dự án TRONG phạm vi vẫn hiện đủ dữ liệu", trongPhamVi.code);
      } else {
        truot(
          "đối chứng: dự án TRONG phạm vi vẫn hiện đủ dữ liệu",
          `HTTP ${res.status}, có tên dự án: ${html.includes(trongPhamVi.name)}`
        );
      }
    }

    // ---- Kịch bản 2 ----
    console.log("\nKịch bản 2 — API cũng phải bị chặn, không chỉ trang");
    if (!ngoaiPhamVi) {
      boQua("xuất dự toán ngoài phạm vi", "không có dự án nào ngoài phạm vi");
    } else {
      const res = await user.get(`/api/export/estimate/${ngoaiPhamVi.id}`);
      if (res.status === 404) dat("xuất dự toán ngoài phạm vi trả 404", ngoaiPhamVi.code);
      else truot("xuất dự toán ngoài phạm vi trả 404", `nhận ${res.status}`);
    }
    let soMaCuaUser = 0;
    {
      const res = await user.get("/api/reports/summary");
      if (!res.ok) {
        truot("báo cáo tổng hợp chỉ chứa dự án được gán", `nhận ${res.status}`);
      } else {
        const ma = await maDuAnTrongExcel(res, moiMa);
        soMaCuaUser = ma.size;
        const maDuocGan = new Set(tatCa.filter((p) => duocGan.has(p.id)).map((p) => p.code));
        const loRa = [...ma].filter((m) => !maDuocGan.has(m));
        if (ma.size === 0) {
          // Đạt rỗng: không lọt mã nào chỉ vì chẳng đọc được mã nào. Phải báo trượt,
          // nếu không thì một lỗi đọc file sẽ hiện ra thành "an toàn".
          truot(
            "báo cáo tổng hợp chỉ chứa dự án được gán",
            "không đọc được mã dự án nào trong file — phép kiểm sẽ đạt rỗng"
          );
        } else if (loRa.length === 0) {
          dat("báo cáo tổng hợp chỉ chứa dự án được gán", `${ma.size} mã, không lọt mã nào`);
        } else {
          truot(
            "báo cáo tổng hợp chỉ chứa dự án được gán",
            `LỘ ${loRa.length} dự án ngoài phạm vi: ${loRa.slice(0, 5).join(", ")}`
          );
        }
      }
    }

    // ---- Kịch bản 5 ----
    console.log("\nKịch bản 5 — ADMIN vẫn thấy đầy đủ");
    {
      const res = await admin.get("/api/reports/summary");
      if (!res.ok) {
        truot("ADMIN xuất được báo cáo tổng hợp", `nhận ${res.status}`);
      } else {
        const ma = await maDuAnTrongExcel(res, moiMa);
        if (ma.size > soMaCuaUser) {
          dat("ADMIN thấy nhiều hơn tài khoản bị giới hạn", `${ma.size} mã so với ${soMaCuaUser}`);
        } else {
          truot(
            "ADMIN thấy nhiều hơn tài khoản bị giới hạn",
            `ADMIN ${ma.size} mã, tài khoản giới hạn ${soMaCuaUser} — phạm vi không có tác dụng`
          );
        }
      }
    }

    // ---- Kịch bản 6 ----
    //
    // Thư viện đơn giá là dữ liệu gốc: mọi vai đều XEM được, chỉ ADMIN được SỬA. Ma
    // trận quyền đã có test đơn vị, nhưng test đó chỉ chứng minh hàm `can` đúng — nó
    // không chứng minh trang có HỎI hàm đó không. Đây là phép kiểm cho vế thứ hai.
    console.log("\nKịch bản 6 — thư viện đơn giá: ai cũng xem, chỉ ADMIN sửa");
    {
      const resUser = await user.get("/thu-vien");
      const htmlUser = await resUser.text();
      const resAdmin = await admin.get("/thu-vien");
      const htmlAdmin = await resAdmin.text();

      if (resUser.status === 200 && htmlUser.includes("Thư viện đơn giá")) {
        dat("tài khoản không phải ADMIN vẫn xem được thư viện", `HTTP ${resUser.status}`);
      } else {
        truot(
          "tài khoản không phải ADMIN vẫn xem được thư viện",
          `HTTP ${resUser.status}, có tiêu đề: ${htmlUser.includes("Thư viện đơn giá")}`
        );
      }

      // Đối chứng đi kèm: nếu ADMIN cũng không có nút thì phép kiểm dưới vô nghĩa —
      // nó chỉ chứng minh trang hỏng chứ không chứng minh quyền có tác dụng.
      const adminCoNut = htmlAdmin.includes("Thêm công tác");
      const userCoNut = htmlUser.includes("Thêm công tác");
      if (adminCoNut && !userCoNut) {
        dat("nút sửa thư viện chỉ hiện với ADMIN", "ADMIN có, tài khoản kia không");
      } else {
        truot(
          "nút sửa thư viện chỉ hiện với ADMIN",
          `ADMIN có nút: ${adminCoNut}, tài khoản kia có nút: ${userCoNut}`
        );
      }
    }

    // ---- Kịch bản 3 ----
    console.log("\nKịch bản 3 — thu hồi phiên");
    if (tamSales) {
      // Với tài khoản thử tạm thì kiểm được đầy đủ mà không đụng ai: cả hai thao tác
      // ghi dưới đây chỉ nhắm vào chính tài khoản do script tạo ra.

      // 3a. Token mang tokenVersion cũ — đúng thứ xảy ra khi ADMIN đổi vai trò hoặc
      //     đổi mật khẩu của một người đang mở tab.
      await db.user.update({ where: { id: tamSales.id }, data: { tokenVersion: { increment: 1 } } });
      const cu = Phien.tuToken(await kySession(tamSales, tamSales.tokenVersion));
      {
        const res = await cu.get("/projects");
        if (res.status === 307 || res.status === 302) {
          dat("token mang tokenVersion cũ bị từ chối", `${res.status} → ${res.headers.get("location")}`);
        } else {
          truot("token mang tokenVersion cũ bị từ chối", `vẫn nhận ${res.status}`);
        }
      }

      // 3b. Khóa tài khoản.
      const moi = await db.user.findUniqueOrThrow({
        where: { id: tamSales.id },
        select: { tokenVersion: true },
      });
      const hopLe = Phien.tuToken(await kySession(tamSales, moi.tokenVersion));
      {
        // Trước khi khóa thì token mới này phải dùng được — nếu không, phép kiểm sau
        // chẳng chứng minh được gì.
        const truocKhiKhoa = await hopLe.get("/projects");
        if (truocKhiKhoa.status !== 200) {
          truot("đối chứng: token mới dùng được trước khi khóa", `nhận ${truocKhiKhoa.status}`);
        } else {
          await db.user.update({ where: { id: tamSales.id }, data: { active: false } });
          const res = await hopLe.get("/projects");
          if (res.status === 307 || res.status === 302) {
            dat("khóa tài khoản cắt phiên đang mở", `${res.status} → ${res.headers.get("location")}`);
          } else {
            truot("khóa tài khoản cắt phiên đang mở", `vẫn nhận ${res.status}`);
          }
        }
      }
    } else if (process.env.E2E_ALLOW_MUTATE !== "1") {
      boQua(
        "thu hồi phiên",
        "với tài khoản THẬT thì kịch bản này phải khóa tài khoản đó; bật bằng E2E_ALLOW_MUTATE=1"
      );
    } else {
      const truoc = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { active: true },
      });
      try {
        await db.user.update({
          where: { id: userId },
          data: { active: false, tokenVersion: { increment: 1 } },
        });
        const res = await user.get("/projects");
        if (res.status === 307 || res.status === 302) {
          dat("khóa tài khoản cắt phiên đang mở", `${res.status} → ${res.headers.get("location")}`);
        } else {
          truot("khóa tài khoản cắt phiên đang mở", `vẫn nhận ${res.status}`);
        }
      } finally {
        // tokenVersion CỐ Ý không hạ lại — trường này chỉ được phép tăng; hạ lại là
        // làm sống lại đúng những token mà thao tác khóa vừa giết.
        await db.user.update({ where: { id: userId }, data: { active: truoc.active } });
        console.log(`     (đã mở khóa lại ${userEmail}; người đó cần đăng nhập lại)`);
      }
    }
  } finally {
    await donDep();
  }

  await kichBan4();
  ketLuan();
}

function ketLuan() {
  console.log(`\nĐạt ${soDat} · Trượt ${soTruot} · Bỏ qua ${soBoQua}`);
  if (soTruot > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("\nLỗi:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
