// Chạy 5 kịch bản kiểm thử end-to-end mà `plan/24` để lại.
//
// Vì sao là script chứ không phải một bộ khung test (Playwright/Cypress): năm kịch bản
// này kiểm **phân quyền ở tầng HTTP**, không kiểm giao diện. Chúng chỉ cần gọi request
// và đọc mã trạng thái — thêm một bộ khung trình duyệt vào đây là đắt mà không mua thêm
// được gì.
//
// Cách chạy:
//   1. Mở server ở một cửa sổ khác:  npm run dev
//   2. Đặt tài khoản vào .env (hoặc biến môi trường):
//        E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD    — tài khoản ADMIN
//        E2E_USER_EMAIL  / E2E_USER_PASSWORD     — tài khoản KHÔNG phải ADMIN
//   3. npm run e2e
//
// Kịch bản 3 (khóa tài khoản) có GHI vào cơ sở dữ liệu nên mặc định bị bỏ qua; bật bằng
// E2E_ALLOW_MUTATE=1. Script tự mở khóa lại sau khi kiểm, kể cả khi kiểm thất bại.
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

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

/** Một phiên đăng nhập: giữ cookie và không tự đi theo chuyển hướng. */
class Phien {
  private cookie = "";

  async dangNhap(email: string, password: string): Promise<void> {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    if (!res.ok) {
      throw new Error(`đăng nhập ${email} thất bại: ${res.status} ${await res.text()}`);
    }
    // getSetCookie() giữ được nhiều cookie; nối lại thành header Cookie.
    this.cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!this.cookie) throw new Error("máy chủ không trả cookie phiên");
  }

  get(duongDan: string): Promise<Response> {
    return fetch(`${BASE}${duongDan}`, {
      headers: { Cookie: this.cookie },
      // KHÔNG đi theo chuyển hướng: 307 về /login chính là thứ cần đo.
      redirect: "manual",
    });
  }
}

/** Đọc file Excel trả về từ /api/reports/summary, gom mọi mã dự án xuất hiện. */
async function maDuAnTrongExcel(res: Response): Promise<Set<string>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  const ma = new Set<string>();
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      const s = typeof v === "string" ? v.trim() : "";
      // Mã dự án dạng N037 / DT01 / DEMO1.
      if (/^(N\d{3}|DT\d{2}|DEMO\d+)$/.test(s)) ma.add(s);
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
  {
    // Email không tồn tại: không đụng tới tài khoản thật nào, và không làm khóa nhầm
    // ai cả. Bộ đếm theo IP vẫn bị dùng, nên chạy trên máy phát triển.
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

}

async function main() {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPass = process.env.E2E_ADMIN_PASSWORD;
  const userEmail = process.env.E2E_USER_EMAIL;
  const userPass = process.env.E2E_USER_PASSWORD;

  console.log(`Kiểm thử end-to-end trên ${BASE}\n`);

  if (!adminEmail || !adminPass || !userEmail || !userPass) {
    console.log("Kịch bản 1, 2, 3, 5 — cần tài khoản");
    boQua(
      "bốn kịch bản còn lại",
      "chưa đặt E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_USER_EMAIL / E2E_USER_PASSWORD"
    );
    await kichBan4();
    ketLuan();
    return;
  }

  const admin = new Phien();
  const user = new Phien();
  await admin.dangNhap(adminEmail, adminPass);
  await user.dangNhap(userEmail, userPass);

  const nguoiDung = await db.user.findUnique({
    where: { email: userEmail },
    select: { id: true, role: true, name: true },
  });
  if (!nguoiDung) throw new Error(`không tìm thấy user ${userEmail} trong DB`);
  if (nguoiDung.role === "ADMIN") {
    throw new Error(`E2E_USER_EMAIL phải là tài khoản KHÔNG phải ADMIN (đang là ${nguoiDung.role})`);
  }

  const duocGan = new Set(
    (
      await db.projectMember.findMany({
        where: { userId: nguoiDung.id },
        select: { projectId: true },
      })
    ).map((m) => m.projectId)
  );
  const tatCa = await db.project.findMany({ select: { id: true, code: true } });
  const ngoaiPhamVi = tatCa.find((p) => !duocGan.has(p.id));

  console.log(
    `\nTài khoản thử: ${nguoiDung.name} (${nguoiDung.role}) — được gán ${duocGan.size}/${tatCa.length} dự án`
  );

  // ---- Kịch bản 1 ----
  console.log("\nKịch bản 1 — dự án ngoài phạm vi phải ra 404");
  if (!ngoaiPhamVi) {
    boQua("trang dự án ngoài phạm vi", `${userEmail} đang được gán TẤT CẢ dự án`);
  } else {
    const res = await user.get(`/projects/${ngoaiPhamVi.id}`);
    if (res.status === 404) dat("trang dự án ngoài phạm vi trả 404", ngoaiPhamVi.code);
    else truot("trang dự án ngoài phạm vi trả 404", `nhận ${res.status} cho ${ngoaiPhamVi.code}`);
  }

  // ---- Kịch bản 2 ----
  console.log("\nKịch bản 2 — API cũng phải bị chặn, không chỉ trang");
  if (!ngoaiPhamVi) {
    boQua("xuất dự toán ngoài phạm vi", "không có dự án nào ngoài phạm vi");
  } else {
    const res = await user.get(`/api/export/estimate/${ngoaiPhamVi.id}`);
    if (res.status === 404) dat("xuất dự toán ngoài phạm vi trả 404");
    else truot("xuất dự toán ngoài phạm vi trả 404", `nhận ${res.status}`);
  }
  {
    const res = await user.get("/api/reports/summary");
    if (!res.ok) {
      truot("báo cáo tổng hợp chỉ chứa dự án được gán", `nhận ${res.status}`);
    } else {
      const ma = await maDuAnTrongExcel(res);
      const maDuocGan = new Set(
        tatCa.filter((p) => duocGan.has(p.id)).map((p) => p.code)
      );
      const loRa = [...ma].filter((m) => !maDuocGan.has(m));
      if (loRa.length === 0) {
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
      const ma = await maDuAnTrongExcel(res);
      // Không đòi bằng đúng tổng số: báo cáo có thể lọc theo trạng thái. Chỉ cần ADMIN
      // thấy NHIỀU HƠN người dùng bị giới hạn thì phạm vi mới thực sự có tác dụng.
      if (ma.size >= duocGan.size) {
        dat("ADMIN thấy ≥ số dự án của người dùng bị giới hạn", `${ma.size} mã`);
      } else {
        truot("ADMIN thấy ≥ số dự án của người dùng bị giới hạn", `ADMIN ${ma.size} < user ${duocGan.size}`);
      }
    }
  }

  // ---- Kịch bản 3 ----
  console.log("\nKịch bản 3 — khóa tài khoản phải cắt phiên đang mở");
  if (process.env.E2E_ALLOW_MUTATE !== "1") {
    boQua("khóa tài khoản cắt phiên", "kịch bản này GHI vào DB, bật bằng E2E_ALLOW_MUTATE=1");
  } else {
    const truoc = await db.user.findUniqueOrThrow({
      where: { id: nguoiDung.id },
      select: { active: true, tokenVersion: true },
    });
    try {
      // Khóa đúng cách app vẫn làm: hạ active và tăng tokenVersion.
      await db.user.update({
        where: { id: nguoiDung.id },
        data: { active: false, tokenVersion: { increment: 1 } },
      });
      const res = await user.get("/projects");
      // getSession() thấy active=false hoặc tokenVersion lệch -> coi như chưa đăng nhập
      // -> proxy đá về /login.
      if (res.status === 307 || res.status === 302) {
        dat("phiên bị cắt ngay lần điều hướng kế tiếp", `${res.status} → ${res.headers.get("location")}`);
      } else {
        truot("phiên bị cắt ngay lần điều hướng kế tiếp", `vẫn nhận ${res.status}`);
      }
    } finally {
      // Trả lại nguyên trạng dù kiểm có thất bại hay không. tokenVersion CỐ Ý không
      // hạ lại — nó chỉ được phép tăng; hạ lại là làm sống lại token cũ.
      await db.user.update({
        where: { id: nguoiDung.id },
        data: { active: truoc.active },
      });
      console.log(`     (đã mở khóa lại ${userEmail}; người đó cần đăng nhập lại)`);
    }
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
