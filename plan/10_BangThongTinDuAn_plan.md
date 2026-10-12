# Bảng thông tin dự án — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang tổng hợp `/projects/tong-quan` gắn cờ đỏ/vàng cho dự án đang chạy, và khối "Tổng quan" trong trang chi tiết dự án (CĐT + người liên hệ, tiến độ, thanh toán, vật tư + màu sơn/tôn).

**Architecture:** Toàn bộ luật cờ và chỉ số nằm trong một module thuần `src/lib/projectHealth.ts` (không chạm DB, test bằng vitest). Server component gom dữ liệu bằng Prisma rồi gọi module này. Dữ liệu mới: 2 bảng (`ProjectContact`, `ProjectMaterialSpec`) + 4 cột trên `Project`; ghi qua server actions trong `overviewActions.ts`, có `recordAudit`.

**Tech Stack:** Next.js (bản có thay đổi — đọc `node_modules/next/dist/docs/` trước khi viết route mới), React 19, Prisma + Postgres (PGlite cục bộ), Tailwind, vitest, zod.

**Spec:** `plan/10_BangThongTinDuAn_design.md`

**Điều chỉnh so với spec (đã báo người dùng):** trang `/projects/[id]` hiện **không có tab** — là một trang cuộn dài, và đã có sẵn khối "Tiến độ thực hiện" (sửa mốc) và "Thanh toán theo đợt" (sửa đợt). Để không nhân đôi, "Tổng quan" là **khối đầu trang** (`id="tong-quan"`) gồm: dải cờ + chỉ số, CĐT & người liên hệ, Vật tư. Tiến độ và thanh toán dùng lại khối có sẵn, chỉ thêm tô màu mốc trễ/sắp đến hạn vào `Milestones.tsx`. Trang tổng hợp link tới `/projects/[id]#tong-quan`.

## Global Constraints

- Ngưỡng sắp đến hạn `N = 7` ngày, cố định.
- "Hôm nay" = đầu ngày theo giờ Việt Nam (UTC+7), lấy từ `serverNow()` (`src/lib/now.ts`) — không gọi `Date.now()` trong component.
- Cờ tính lúc tải trang, **không** lưu CSDL.
- Thứ tự mốc: `MILESTONE_TYPE` trong `src/lib/constants.ts` (8 mốc).
- Giá trị HĐ dùng lại `pickContractValue` trong `src/lib/debt.ts`; null → `Project.salePrice`.
- Số tiền (giá trị HĐ, còn phải thu, lý do "chậm thu" có số tiền) chỉ hiện khi `can(role, "debt", "view") || can(role, "cost", "edit")` — giống điều kiện `canViewPayment` hiện có.
- Danh sách dự án luôn lọc qua `scopedProjectWhere(session)` (`src/lib/scope.ts`).
- Không sửa bảng cũ ngoài 4 cột mới trên `Project`.
- Chỉ `git add` đúng file của task — thư mục có nhiều phiên làm việc song song, **không** `git add -A`.
- Kiểm tra giao diện bằng bản build production + PGlite, không dùng `next dev`.

## Review Focus

1. Dự án không có mốc / đợt thu / đơn mua nào → không cờ, % hiện "—", trang không vỡ. (Test ở Task 2.)
2. `paidAmount` hoặc `amount` null ở đợt thu → coi null = 0; `amount` null thì không bao giờ "quá hạn thu". (Test ở Task 2.)
3. Hạn rơi đúng hôm nay → VÀNG "còn 0 ngày", không phải ĐỎ; hạn hôm qua → ĐỎ 1 ngày. Mốc giờ UTC lệch ngày VN (ví dụ `2026-10-11T18:00Z` = 12/10 VN). (Test ở Task 2.)
4. "Lấy từ báo giá" khi dự án có nhiều báo giá, không cái nào `CHOT` → lấy báo giá mới nhất bất kể trạng thái; không có báo giá → lỗi rõ ràng. (Test ở Task 3.)
5. Người dùng không có quyền tiền (Kỹ thuật/Vật tư) mở trang tổng hợp → không lộ số tiền, kể cả trong chuỗi lý do cờ. (Test ở Task 2: `anTien`.)

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `prisma/schema.prisma` | +`ProjectContact`, +`ProjectMaterialSpec`, +4 cột `Project` |
| `prisma/migrations/20261012100000_bang_thong_tin_du_an/migration.sql` | SQL tương ứng |
| `src/lib/projectHealth.ts` (+`.test.ts`) | Hàm thuần: ngày VN, cờ, chỉ số, sắp xếp |
| `src/lib/projectMaterial.ts` (+`.test.ts`) | Hàm thuần: chọn báo giá nguồn, chuyển spec → dòng vật tư dự án |
| `src/lib/constants.ts` | +`CONTACT_ROLE`, `CONTACT_ROLE_MAP` |
| `src/app/(app)/projects/[id]/overviewActions.ts` | Server actions: liên hệ, thông tin vật tư, chủng loại, lấy từ báo giá |
| `src/app/(app)/projects/[id]/HealthBanner.tsx` | Dải cờ + chỉ số (server-safe, không state) |
| `src/app/(app)/projects/[id]/ProjectContacts.tsx` | Client: danh sách + thêm/sửa/xoá liên hệ |
| `src/app/(app)/projects/[id]/MaterialInfo.tsx` | Client: màu sơn/tôn/ghi chú, bảng chủng loại, tóm tắt đơn mua |
| `src/app/(app)/projects/[id]/Milestones.tsx` | +tô màu theo `trangThaiMoc` |
| `src/app/(app)/projects/[id]/page.tsx` | Gắn khối Tổng quan đầu trang |
| `src/app/(app)/projects/tong-quan/page.tsx` | Trang tổng hợp (server) |
| `src/app/(app)/projects/tong-quan/BangTongQuan.tsx` | Client: lọc + bảng |
| `src/components/layout/Sidebar.tsx` | +mục "Tổng quan dự án" |

---

### Task 1: Schema & migration

**Files:**
- Modify: `prisma/schema.prisma` (model `Project` ~dòng 200; thêm 2 model ngay sau `Milestone`)
- Create: `prisma/migrations/20261012100000_bang_thong_tin_du_an/migration.sql`

**Interfaces:**
- Produces: `db.projectContact`, `db.projectMaterialSpec`; `Project.mauSon | mauTonMai | mauTonVach | ghiChuVatTu: string | null`; quan hệ `Project.contacts`, `Project.materialSpecs`.

- [ ] **Step 1: Sửa `model Project`** — thêm sau dòng `note String?`:

```prisma
  // Thông tin vật tư hiển thị ở khối Tổng quan — một giá trị cho cả công trình.
  mauSon       String? // sơn kết cấu: "Chống gỉ xám + phủ trắng sữa"
  mauTonMai    String?
  mauTonVach   String?
  ghiChuVatTu  String?
```

và trong danh sách quan hệ (sau `members ProjectMember[]`):

```prisma
  contacts         ProjectContact[]
  materialSpecs    ProjectMaterialSpec[]
```

- [ ] **Step 2: Thêm 2 model sau `model Milestone`:**

```prisma
// Người liên hệ của MỘT dự án — cùng một CĐT có thể cử người khác nhau cho từng công trình.
model ProjectContact {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  role      String? // CDT | KY_THUAT | GIAM_SAT | KE_TOAN | KHAC
  phone     String?
  email     String?
  note      String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
}

// Chủng loại vật tư theo HĐ. Lưu riêng thay vì đọc thẳng ClientQuoteSpec: khi ký HĐ
// chủng loại hay đổi (độ dày tôn, mác thép), và QC đối chiếu đơn mua với bảng này.
model ProjectMaterialSpec {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tag       String? // VAT_TU_TAG; trống = vật tư dùng chung
  name      String
  spec      String?
  origin    String?
  sortOrder Int     @default(0)

  @@index([projectId])
}
```

- [ ] **Step 3: Viết migration SQL**

```sql
ALTER TABLE "Project" ADD COLUMN "mauSon" TEXT;
ALTER TABLE "Project" ADD COLUMN "mauTonMai" TEXT;
ALTER TABLE "Project" ADD COLUMN "mauTonVach" TEXT;
ALTER TABLE "Project" ADD COLUMN "ghiChuVatTu" TEXT;

CREATE TABLE "ProjectContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectContact_projectId_idx" ON "ProjectContact"("projectId");
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectMaterialSpec" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tag" TEXT,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "origin" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProjectMaterialSpec_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectMaterialSpec_projectId_idx" ON "ProjectMaterialSpec"("projectId");
ALTER TABLE "ProjectMaterialSpec" ADD CONSTRAINT "ProjectMaterialSpec_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Kiểm tra** — chạy `npx prisma validate` rồi `npx prisma generate` rồi `npm run typecheck`. Expected: không lỗi. Áp migration lên PGlite cục bộ theo cách repo đang làm (xem memory "Xem giao diện cục bộ"; **không** chạy với `.env` — nó trỏ Supabase production).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261012100000_bang_thong_tin_du_an
git commit -m "feat(du-an): bảng người liên hệ, chủng loại vật tư, màu sơn/tôn"
```

---

### Task 2: `projectHealth` — cờ & chỉ số (thuần)

**Files:**
- Create: `src/lib/projectHealth.ts`
- Test: `src/lib/projectHealth.test.ts`

**Interfaces:**
- Consumes: `MILESTONE_TYPE`, `MILESTONE_TYPE_MAP`, `PO_CATEGORY_MAP` (`@/lib/constants`); `pickContractValue`, `ContractValueInput` (`@/lib/debt`); `formatVND` (`@/lib/utils`).
- Produces:

```ts
export const NGUONG_SAP_DEN_HAN = 7;
export type MucCo = "DO" | "VANG" | null;
export type TrangThaiMoc = "XONG" | "TRE" | "SAP_DEN" | "DUNG_HAN" | "CHUA_CO";
export interface LyDo { muc: "DO" | "VANG"; loai: "TIEN_DO" | "THU_TIEN" | "VAT_TU"; text: string; soNgay: number }
export interface HealthInput {
  milestones: { type: string; planDate: Date | null; done: boolean }[];
  payments: { direction: string; name: string; amount: number | null; paidAmount: number | null; dueDate: Date | null }[];
  purchaseOrders: { category: string; status: string; expectedDate: Date | null }[];
  contracts: ContractValueInput[];
  salePrice: number | null;
}
export function dauNgayVN(ms: number): number;
export function soNgay(tu: number, den: number): number; // den - tu, theo ngày VN, có dấu
export function trangThaiMoc(m: { planDate: Date | null; done: boolean }, homNay: number): TrangThaiMoc;
export function tinhCo(d: HealthInput, nowMs: number, opts?: { anTien?: boolean }): { muc: MucCo; lyDo: LyDo[] };
export function tinhChiSo(d: HealthInput): { tienDo: number; daThu: number | null; giaTriHD: number | null; conPhaiThu: number };
export function soSanhCo(a: MucCo, b: MucCo): number; // DO < VANG < null cho sort
```

- [ ] **Step 1: Viết test thất bại** — `src/lib/projectHealth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  dauNgayVN,
  soNgay,
  soSanhCo,
  tinhChiSo,
  tinhCo,
  trangThaiMoc,
  type HealthInput,
} from "./projectHealth";

// 12/10/2026 09:00 giờ VN
const NOW = Date.parse("2026-10-12T02:00:00Z");
const vn = (s: string) => new Date(`${s}T00:00:00+07:00`);

function input(p: Partial<HealthInput> = {}): HealthInput {
  return { milestones: [], payments: [], purchaseOrders: [], contracts: [], salePrice: null, ...p };
}

describe("ngày VN", () => {
  it("đầu ngày theo UTC+7", () => {
    expect(dauNgayVN(NOW)).toBe(vn("2026-10-12").getTime());
    // 18:00Z ngày 11 = 01:00 ngày 12 giờ VN
    expect(dauNgayVN(Date.parse("2026-10-11T18:00:00Z"))).toBe(vn("2026-10-12").getTime());
  });
  it("soNgay có dấu", () => {
    expect(soNgay(NOW, vn("2026-10-15").getTime())).toBe(3);
    expect(soNgay(NOW, vn("2026-10-10").getTime())).toBe(-2);
  });
});

describe("trangThaiMoc", () => {
  const h = NOW;
  it("xong thắng mọi thứ", () => {
    expect(trangThaiMoc({ planDate: vn("2026-01-01"), done: true }, h)).toBe("XONG");
  });
  it("không ngày → CHUA_CO", () => {
    expect(trangThaiMoc({ planDate: null, done: false }, h)).toBe("CHUA_CO");
  });
  it("hôm qua TRE, hôm nay & +7 SAP_DEN, +8 DUNG_HAN", () => {
    expect(trangThaiMoc({ planDate: vn("2026-10-11"), done: false }, h)).toBe("TRE");
    expect(trangThaiMoc({ planDate: vn("2026-10-12"), done: false }, h)).toBe("SAP_DEN");
    expect(trangThaiMoc({ planDate: vn("2026-10-19"), done: false }, h)).toBe("SAP_DEN");
    expect(trangThaiMoc({ planDate: vn("2026-10-20"), done: false }, h)).toBe("DUNG_HAN");
  });
});

describe("tinhCo", () => {
  it("dự án trống → không cờ", () => {
    expect(tinhCo(input(), NOW)).toEqual({ muc: null, lyDo: [] });
  });

  it("mốc quá hạn → ĐỎ có tên mốc và số ngày", () => {
    const r = tinhCo(input({ milestones: [{ type: "LAP_DUNG", planDate: vn("2026-10-07"), done: false }] }), NOW);
    expect(r.muc).toBe("DO");
    expect(r.lyDo[0]).toMatchObject({ muc: "DO", loai: "TIEN_DO", soNgay: 5 });
    expect(r.lyDo[0].text).toBe("Quá hạn Lắp dựng 5 ngày");
  });

  it("mốc đến hạn hôm nay → VÀNG còn 0 ngày", () => {
    const r = tinhCo(input({ milestones: [{ type: "SHOP", planDate: vn("2026-10-12"), done: false }] }), NOW);
    expect(r.muc).toBe("VANG");
    expect(r.lyDo[0].text).toBe("Shop còn 0 ngày");
  });

  it("đợt thu quá hạn chưa đủ → ĐỎ; null paid = 0", () => {
    const r = tinhCo(
      input({ payments: [{ direction: "THU", name: "Đợt 2", amount: 120_000_000, paidAmount: null, dueDate: vn("2026-10-01") }] }),
      NOW
    );
    expect(r.muc).toBe("DO");
    expect(r.lyDo[0].loai).toBe("THU_TIEN");
    expect(r.lyDo[0].text).toContain("Đợt 2");
    expect(r.lyDo[0].text).toContain("120");
  });

  it("đợt thu đã đủ / amount null / chiều CHI → không cờ", () => {
    const r = tinhCo(
      input({
        payments: [
          { direction: "THU", name: "Đợt 1", amount: 100, paidAmount: 100, dueDate: vn("2026-10-01") },
          { direction: "THU", name: "Đợt X", amount: null, paidAmount: null, dueDate: vn("2026-10-01") },
          { direction: "CHI", name: "NCC", amount: 100, paidAmount: 0, dueDate: vn("2026-10-01") },
        ],
      }),
      NOW
    );
    expect(r).toEqual({ muc: null, lyDo: [] });
  });

  it("anTien → lý do thu tiền không chứa số tiền", () => {
    const r = tinhCo(
      input({ payments: [{ direction: "THU", name: "Đợt 2", amount: 120_000_000, paidAmount: 0, dueDate: vn("2026-10-01") }] }),
      NOW,
      { anTien: true }
    );
    expect(r.lyDo[0].text).toBe("Quá hạn thu Đợt 2 11 ngày");
  });

  it("đơn mua trễ giao chưa nhận → ĐỎ; đã nhận → không", () => {
    const r = tinhCo(
      input({
        purchaseOrders: [
          { category: "TON", status: "ORDERED", expectedDate: vn("2026-10-09") },
          { category: "KCT", status: "RECEIVED", expectedDate: vn("2026-10-01") },
        ],
      }),
      NOW
    );
    expect(r.lyDo).toHaveLength(1);
    expect(r.lyDo[0]).toMatchObject({ loai: "VAT_TU", soNgay: 3 });
  });

  it("ĐỎ đứng trước VÀNG, trong cùng mức trễ nhiều đứng trước", () => {
    const r = tinhCo(
      input({
        milestones: [
          { type: "SHOP", planDate: vn("2026-10-14"), done: false },
          { type: "BV_KT", planDate: vn("2026-10-10"), done: false },
          { type: "LAP_DUNG", planDate: vn("2026-10-01"), done: false },
        ],
      }),
      NOW
    );
    expect(r.muc).toBe("DO");
    expect(r.lyDo.map((l) => l.muc)).toEqual(["DO", "DO", "VANG"]);
    expect(r.lyDo[0].soNgay).toBe(11);
  });
});

describe("tinhChiSo", () => {
  it("không dữ liệu → tiến độ 0, đã thu null, giá trị HĐ = salePrice", () => {
    expect(tinhChiSo(input({ salePrice: 500 }))).toEqual({ tienDo: 0, daThu: null, giaTriHD: 500, conPhaiThu: 0 });
  });
  it("tính % và còn phải thu, ưu tiên HĐ đã ký", () => {
    const r = tinhChiSo(
      input({
        salePrice: 1,
        milestones: [
          { type: "BV_KT", planDate: null, done: true },
          { type: "SHOP", planDate: null, done: true },
        ],
        payments: [
          { direction: "THU", name: "1", amount: 300, paidAmount: 300, dueDate: null },
          { direction: "THU", name: "2", amount: 700, paidAmount: null, dueDate: null },
          { direction: "CHI", name: "x", amount: 999, paidAmount: 999, dueDate: null },
        ],
        contracts: [{ valueWithVat: 1000, status: "SIGNED", signDate: vn("2026-01-01") }],
      })
    );
    expect(r).toEqual({ tienDo: 2 / 8, daThu: 0.3, giaTriHD: 1000, conPhaiThu: 700 });
  });
});

describe("soSanhCo", () => {
  it("DO < VANG < null", () => {
    expect((["VANG", null, "DO"] as const).slice().sort(soSanhCo)).toEqual(["DO", "VANG", null]);
  });
});
```

- [ ] **Step 2: Chạy** `npx vitest run src/lib/projectHealth.test.ts` — Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Cài đặt** — `src/lib/projectHealth.ts`:

```ts
// Sức khoẻ dự án: cờ ĐỎ/VÀNG và chỉ số cho bảng thông tin dự án.
//
// Hàm thuần — không chạm DB, không đọc đồng hồ. Server component truyền `serverNow()` vào.
// Cờ tính lúc tải trang, không lưu: dữ liệu nguồn (mốc, đợt thu, đơn mua) đổi là cờ đổi theo.
import { MILESTONE_TYPE, MILESTONE_TYPE_MAP, PO_CATEGORY_MAP } from "@/lib/constants";
import { pickContractValue, type ContractValueInput } from "@/lib/debt";
import { formatVND } from "@/lib/utils";

export const NGUONG_SAP_DEN_HAN = 7;
const NGAY = 86_400_000;
const LECH_VN = 7 * 3_600_000;

export type MucCo = "DO" | "VANG" | null;
export type TrangThaiMoc = "XONG" | "TRE" | "SAP_DEN" | "DUNG_HAN" | "CHUA_CO";

export interface LyDo {
  muc: "DO" | "VANG";
  loai: "TIEN_DO" | "THU_TIEN" | "VAT_TU";
  text: string;
  /** Số ngày trễ (ĐỎ) hoặc số ngày còn lại (VÀNG). */
  soNgay: number;
}

export interface HealthInput {
  milestones: { type: string; planDate: Date | null; done: boolean }[];
  payments: {
    direction: string;
    name: string;
    amount: number | null;
    paidAmount: number | null;
    dueDate: Date | null;
  }[];
  purchaseOrders: { category: string; status: string; expectedDate: Date | null }[];
  contracts: ContractValueInput[];
  salePrice: number | null;
}

/** Mốc 00:00 giờ Việt Nam của ngày chứa `ms`. */
export function dauNgayVN(ms: number): number {
  return Math.floor((ms + LECH_VN) / NGAY) * NGAY - LECH_VN;
}

/** Số ngày VN từ `tu` tới `den` (âm nếu `den` ở trước). */
export function soNgay(tu: number, den: number): number {
  return Math.round((dauNgayVN(den) - dauNgayVN(tu)) / NGAY);
}

function phanLoaiHan(han: Date, nowMs: number): { muc: "DO" | "VANG"; n: number } | null {
  const d = soNgay(nowMs, han.getTime());
  if (d < 0) return { muc: "DO", n: -d };
  if (d <= NGUONG_SAP_DEN_HAN) return { muc: "VANG", n: d };
  return null;
}

export function trangThaiMoc(
  m: { planDate: Date | null; done: boolean },
  nowMs: number
): TrangThaiMoc {
  if (m.done) return "XONG";
  if (!m.planDate) return "CHUA_CO";
  const p = phanLoaiHan(m.planDate, nowMs);
  if (!p) return "DUNG_HAN";
  return p.muc === "DO" ? "TRE" : "SAP_DEN";
}

export function tinhCo(
  d: HealthInput,
  nowMs: number,
  opts: { anTien?: boolean } = {}
): { muc: MucCo; lyDo: LyDo[] } {
  const lyDo: LyDo[] = [];

  for (const m of d.milestones) {
    if (m.done || !m.planDate) continue;
    const p = phanLoaiHan(m.planDate, nowMs);
    if (!p) continue;
    const ten = MILESTONE_TYPE_MAP[m.type]?.label ?? m.type;
    lyDo.push({
      muc: p.muc,
      loai: "TIEN_DO",
      soNgay: p.n,
      text: p.muc === "DO" ? `Quá hạn ${ten} ${p.n} ngày` : `${ten} còn ${p.n} ngày`,
    });
  }

  for (const x of d.payments) {
    if (x.direction !== "THU" || x.amount == null || !x.dueDate) continue;
    const thieu = x.amount - (x.paidAmount ?? 0);
    if (thieu <= 0) continue;
    const p = phanLoaiHan(x.dueDate, nowMs);
    if (!p) continue;
    const tien = opts.anTien ? "" : `: ${formatVND(thieu)}`;
    lyDo.push({
      muc: p.muc,
      loai: "THU_TIEN",
      soNgay: p.n,
      text:
        p.muc === "DO"
          ? `Quá hạn thu ${x.name}${tien || ` ${p.n} ngày`}`
          : `Đến hạn thu ${x.name} còn ${p.n} ngày${tien}`,
    });
  }

  for (const o of d.purchaseOrders) {
    if (o.status === "RECEIVED" || !o.expectedDate) continue;
    const n = -soNgay(nowMs, o.expectedDate.getTime());
    if (n <= 0) continue; // vật tư chỉ có cờ ĐỎ (spec)
    const ten = PO_CATEGORY_MAP[o.category]?.label ?? o.category;
    lyDo.push({ muc: "DO", loai: "VAT_TU", soNgay: n, text: `Trễ giao ${ten} ${n} ngày` });
  }

  lyDo.sort((a, b) =>
    a.muc !== b.muc ? (a.muc === "DO" ? -1 : 1) : a.muc === "DO" ? b.soNgay - a.soNgay : a.soNgay - b.soNgay
  );
  return { muc: lyDo[0]?.muc ?? null, lyDo };
}

export function tinhChiSo(d: HealthInput): {
  tienDo: number;
  daThu: number | null;
  giaTriHD: number | null;
  conPhaiThu: number;
} {
  const xong = d.milestones.filter((m) => m.done && m.type in MILESTONE_TYPE_MAP).length;
  let keHoach = 0;
  let thucThu = 0;
  for (const x of d.payments) {
    if (x.direction !== "THU") continue;
    keHoach += x.amount ?? 0;
    thucThu += x.paidAmount ?? 0;
  }
  return {
    tienDo: xong / MILESTONE_TYPE.length,
    daThu: keHoach > 0 ? thucThu / keHoach : null,
    giaTriHD: pickContractValue(d.contracts) ?? d.salePrice,
    conPhaiThu: keHoach - thucThu,
  };
}

const HANG: Record<string, number> = { DO: 0, VANG: 1 };
export function soSanhCo(a: MucCo, b: MucCo): number {
  return (a ? HANG[a] : 2) - (b ? HANG[b] : 2);
}
```

Lưu ý: test "anTien" mong `"Quá hạn thu Đợt 2 11 ngày"`; khi không ẩn tiền chuỗi là `"Quá hạn thu Đợt 2: 120.000.000 ₫"` (định dạng do `formatVND` quyết định — test chỉ `toContain("120")`). Nếu `ContractValueInput` chưa được `export` trong `debt.ts`, thêm `export` vào khai báo interface đó.

- [ ] **Step 4: Chạy** `npx vitest run src/lib/projectHealth.test.ts` — Expected: PASS toàn bộ. Sau đó `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projectHealth.ts src/lib/projectHealth.test.ts src/lib/debt.ts
git commit -m "feat(du-an): tính cờ và chỉ số sức khoẻ dự án"
```

---

### Task 3: Server actions + chọn báo giá nguồn

**Files:**
- Create: `src/lib/projectMaterial.ts`, `src/lib/projectMaterial.test.ts`
- Create: `src/app/(app)/projects/[id]/overviewActions.ts`
- Modify: `src/lib/constants.ts` (thêm `CONTACT_ROLE` sau `MILESTONE_TYPE_MAP`)

**Interfaces:**
- Produces:

```ts
// projectMaterial.ts
export interface QuoteSrc { id: string; status: string; createdAt: Date; specs: { tag: string | null; name: string; spec: string | null; origin: string | null; an: boolean; sortOrder: number }[] }
export function chonBaoGiaNguon(quotes: QuoteSrc[]): QuoteSrc | null;
export function specTuBaoGia(q: QuoteSrc): { tag: string | null; name: string; spec: string | null; origin: string | null; sortOrder: number }[];
// constants.ts
export const CONTACT_ROLE: Option[]; export const CONTACT_ROLE_MAP;
// overviewActions.ts (ActionResult từ "../actions")
saveContact(projectId: string, v: ContactInput & { id?: string }): Promise<ActionResult>
deleteContact(projectId: string, id: string): Promise<ActionResult>
saveMaterialInfo(projectId: string, v: { mauSon: string; mauTonMai: string; mauTonVach: string; ghiChuVatTu: string }): Promise<ActionResult>
saveMaterialSpec(projectId: string, v: { id?: string; tag: string; name: string; spec: string; origin: string }): Promise<ActionResult>
deleteMaterialSpec(projectId: string, id: string): Promise<ActionResult>
moveMaterialSpec(projectId: string, id: string, dir: -1 | 1): Promise<ActionResult>
copySpecsFromQuote(projectId: string): Promise<ActionResult>
// ContactInput = { name: string; role: string; phone: string; email: string; note: string }
```

- [ ] **Step 1: Test thất bại** — `src/lib/projectMaterial.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chonBaoGiaNguon, specTuBaoGia, type QuoteSrc } from "./projectMaterial";

const q = (id: string, status: string, ngay: string, specs: QuoteSrc["specs"] = []): QuoteSrc => ({
  id, status, createdAt: new Date(ngay), specs,
});
const s = (name: string, an = false, sortOrder = 0) => ({ tag: null, name, spec: null, origin: null, an, sortOrder });

describe("chonBaoGiaNguon", () => {
  it("không có báo giá → null", () => expect(chonBaoGiaNguon([])).toBeNull());
  it("ưu tiên CHOT, kể cả khi bản khác mới hơn", () => {
    expect(chonBaoGiaNguon([q("a", "DA_GUI", "2026-09-01"), q("b", "CHOT", "2026-01-01")])?.id).toBe("b");
  });
  it("nhiều CHOT → mới nhất", () => {
    expect(chonBaoGiaNguon([q("a", "CHOT", "2026-01-01"), q("b", "CHOT", "2026-05-01")])?.id).toBe("b");
  });
  it("không có CHOT → mới nhất, bỏ HUY nếu còn bản khác", () => {
    expect(chonBaoGiaNguon([q("a", "NHAP", "2026-01-01"), q("b", "HUY", "2026-05-01")])?.id).toBe("a");
    expect(chonBaoGiaNguon([q("b", "HUY", "2026-05-01")])?.id).toBe("b");
  });
});

describe("specTuBaoGia", () => {
  it("bỏ dòng ẩn, giữ thứ tự, đánh lại sortOrder", () => {
    const r = specTuBaoGia(q("a", "CHOT", "2026-01-01", [s("Tôn", false, 5), s("Ẩn", true, 1), s("Thép", false, 2)]));
    expect(r.map((x) => [x.name, x.sortOrder])).toEqual([["Thép", 0], ["Tôn", 1]]);
  });
});
```

- [ ] **Step 2: Chạy** `npx vitest run src/lib/projectMaterial.test.ts` — Expected: FAIL.

- [ ] **Step 3: Cài đặt** `src/lib/projectMaterial.ts`:

```ts
// Chép chủng loại vật tư từ báo giá gửi khách sang dự án. Hàm thuần.
export interface QuoteSrc {
  id: string;
  status: string;
  createdAt: Date;
  specs: { tag: string | null; name: string; spec: string | null; origin: string | null; an: boolean; sortOrder: number }[];
}

/** Báo giá đã CHỐT mới nhất; không có thì bản mới nhất (tránh bản HUỶ nếu còn bản khác). */
export function chonBaoGiaNguon(quotes: QuoteSrc[]): QuoteSrc | null {
  const moiTruoc = [...quotes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    moiTruoc.find((x) => x.status === "CHOT") ??
    moiTruoc.find((x) => x.status !== "HUY") ??
    moiTruoc[0] ??
    null
  );
}

export function specTuBaoGia(q: QuoteSrc) {
  return q.specs
    .filter((s) => !s.an)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s, i) => ({ tag: s.tag, name: s.name, spec: s.spec, origin: s.origin, sortOrder: i }));
}
```

- [ ] **Step 4: Chạy lại test** — Expected: PASS.

- [ ] **Step 5: Thêm hằng** vào `src/lib/constants.ts` sau `MILESTONE_TYPE_MAP`:

```ts
// ----- Vai trò người liên hệ của dự án -----
export const CONTACT_ROLE: Option[] = [
  { value: "CDT", label: "Đại diện CĐT" },
  { value: "KY_THUAT", label: "Kỹ thuật" },
  { value: "GIAM_SAT", label: "Giám sát" },
  { value: "KE_TOAN", label: "Kế toán" },
  { value: "KHAC", label: "Khác" },
];
export const CONTACT_ROLE_MAP = map(CONTACT_ROLE);
```

- [ ] **Step 6: Viết** `src/app/(app)/projects/[id]/overviewActions.ts`:

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denyProject, requireSession } from "@/lib/auth";
import { diffFields, recordAudit } from "@/lib/audit";
import { CONTACT_ROLE_MAP, VAT_TU_TAG_MAP } from "@/lib/constants";
import { chonBaoGiaNguon, specTuBaoGia } from "@/lib/projectMaterial";
import type { ActionResult } from "../actions";

const NO_EDIT = "Bạn không có quyền sửa thông tin dự án.";
const t = (v: string) => v.trim() || null;

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nhập tên người liên hệ."),
  role: z.string(),
  phone: z.string(),
  email: z.string(),
  note: z.string(),
});

export async function saveContact(projectId: string, v: z.input<typeof contactSchema>): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const p = contactSchema.safeParse(v);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  if (d.role && !(d.role in CONTACT_ROLE_MAP)) return { ok: false, error: "Vai trò không hợp lệ." };
  const data = { name: d.name, role: t(d.role), phone: t(d.phone), email: t(d.email), note: t(d.note) };
  const session = await requireSession();

  if (d.id) {
    const truoc = await db.projectContact.findFirst({ where: { id: d.id, projectId } });
    if (!truoc) return { ok: false, error: "Không tìm thấy người liên hệ." };
    await db.projectContact.update({ where: { id: d.id }, data });
    await recordAudit({
      actor: session, entity: "ProjectContact", entityId: d.id, entityLabel: d.name, projectId,
      action: "UPDATE", changes: diffFields(truoc, data, ["name", "role", "phone", "email", "note"]),
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, id: d.id };
  }
  const count = await db.projectContact.count({ where: { projectId } });
  const created = await db.projectContact.create({ data: { ...data, projectId, sortOrder: count } });
  await recordAudit({
    actor: session, entity: "ProjectContact", entityId: created.id, entityLabel: d.name, projectId, action: "CREATE",
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: created.id };
}

export async function deleteContact(projectId: string, id: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const row = await db.projectContact.findFirst({ where: { id, projectId } });
  if (!row) return { ok: false, error: "Không tìm thấy người liên hệ." };
  await db.projectContact.delete({ where: { id } });
  await recordAudit({
    actor: await requireSession(), entity: "ProjectContact", entityId: id, entityLabel: row.name, projectId, action: "DELETE",
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

const INFO_FIELDS = ["mauSon", "mauTonMai", "mauTonVach", "ghiChuVatTu"] as const;

export async function saveMaterialInfo(
  projectId: string,
  v: { mauSon: string; mauTonMai: string; mauTonVach: string; ghiChuVatTu: string }
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const truoc = await db.project.findUnique({ where: { id: projectId }, select: { code: true, mauSon: true, mauTonMai: true, mauTonVach: true, ghiChuVatTu: true } });
  if (!truoc) return { ok: false, error: "Không tìm thấy dự án." };
  const data = { mauSon: t(v.mauSon), mauTonMai: t(v.mauTonMai), mauTonVach: t(v.mauTonVach), ghiChuVatTu: t(v.ghiChuVatTu) };
  await db.project.update({ where: { id: projectId }, data });
  await recordAudit({
    actor: await requireSession(), entity: "Project", entityId: projectId, entityLabel: truoc.code, projectId,
    action: "UPDATE", changes: diffFields(truoc, data, INFO_FIELDS),
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function saveMaterialSpec(
  projectId: string,
  v: { id?: string; tag: string; name: string; spec: string; origin: string }
): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const name = v.name.trim();
  if (!name) return { ok: false, error: "Nhập tên vật tư." };
  if (v.tag && !(v.tag in VAT_TU_TAG_MAP)) return { ok: false, error: "Nhóm vật tư không hợp lệ." };
  const data = { tag: t(v.tag), name, spec: t(v.spec), origin: t(v.origin) };
  if (v.id) {
    const n = await db.projectMaterialSpec.updateMany({ where: { id: v.id, projectId }, data });
    if (n.count === 0) return { ok: false, error: "Không tìm thấy dòng vật tư." };
  } else {
    const count = await db.projectMaterialSpec.count({ where: { projectId } });
    await db.projectMaterialSpec.create({ data: { ...data, projectId, sortOrder: count } });
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteMaterialSpec(projectId: string, id: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  await db.projectMaterialSpec.deleteMany({ where: { id, projectId } });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function moveMaterialSpec(projectId: string, id: string, dir: -1 | 1): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const rows = await db.projectMaterialSpec.findMany({ where: { projectId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.$transaction(rows.map((r, k) => db.projectMaterialSpec.update({ where: { id: r.id }, data: { sortOrder: k } })));
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Thay TOÀN BỘ chủng loại của dự án bằng bảng vật liệu của báo giá nguồn. UI hỏi xác nhận trước. */
export async function copySpecsFromQuote(projectId: string): Promise<ActionResult> {
  const denied = await denyProject("project", "edit", projectId, NO_EDIT);
  if (denied) return denied;
  const quotes = await db.clientQuote.findMany({
    where: { projectId },
    select: {
      id: true, status: true, createdAt: true,
      specs: { select: { tag: true, name: true, spec: true, origin: true, an: true, sortOrder: true } },
    },
  });
  const nguon = chonBaoGiaNguon(quotes);
  if (!nguon) return { ok: false, error: "Dự án chưa có báo giá gửi khách." };
  const rows = specTuBaoGia(nguon);
  await db.$transaction([
    db.projectMaterialSpec.deleteMany({ where: { projectId } }),
    db.projectMaterialSpec.createMany({ data: rows.map((r) => ({ ...r, projectId })) }),
  ]);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
```

Kiểm tra trước khi viết: tên quan hệ trên `ClientQuote` tới `ClientQuoteSpec` (giả định là `specs` — `grep -n "ClientQuoteSpec\[\]" prisma/schema.prisma`), và `AuditInput.action` có nhận `"CREATE" | "DELETE"` (`src/lib/audit.ts:96`). Sửa theo tên thật nếu khác.

- [ ] **Step 7: Kiểm tra** `npm run typecheck && npx vitest run src/lib/projectMaterial.test.ts` — Expected: sạch / PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/projectMaterial.ts src/lib/projectMaterial.test.ts src/lib/constants.ts "src/app/(app)/projects/[id]/overviewActions.ts"
git commit -m "feat(du-an): action người liên hệ, thông tin vật tư, lấy chủng loại từ báo giá"
```

---

### Task 4: Khối "Tổng quan" trong trang chi tiết dự án

**Files:**
- Create: `src/app/(app)/projects/[id]/HealthBanner.tsx`, `ProjectContacts.tsx`, `MaterialInfo.tsx`
- Modify: `src/app/(app)/projects/[id]/page.tsx` (truy vấn + chèn khối ngay dưới header, trên lưới "Thông tin dự án"), `Milestones.tsx`

**Interfaces:**
- Consumes: Task 2 (`tinhCo`, `tinhChiSo`, `trangThaiMoc`, `LyDo`, `MucCo`), Task 3 actions, `CONTACT_ROLE`, `VAT_TU_TAG`, `PO_CATEGORY_MAP`, `PO_STATUS_MAP`, `Badge`, `Button`, `Input`, `Textarea`, `Select`, `useToast`.
- Produces: props
  - `HealthBanner({ muc: MucCo; lyDo: LyDo[]; tienDo: number; daThu: number | null; giaTriHD: number | null; conPhaiThu: number; hienTien: boolean })`
  - `ProjectContacts({ projectId: string; contacts: ContactRow[]; canEdit: boolean })`, `ContactRow = { id; name; role: string|null; phone: string|null; email: string|null; note: string|null }`
  - `MaterialInfo({ projectId; info: { mauSon; mauTonMai; mauTonVach; ghiChuVatTu: string|null }; specs: SpecRow[]; orders: OrderSummary[]; canEdit: boolean; coBaoGia: boolean; nowMs: number })`, `SpecRow = { id; tag: string|null; name; spec: string|null; origin: string|null }`, `OrderSummary = { id; category; status; supplierName: string|null; value: number|null; totalWeight: number|null; expectedDate: string|null; receivedDate: string|null }`
  - `Milestones` thêm prop `nowMs: number`.

- [ ] **Step 1: `page.tsx` — mở rộng truy vấn `db.project.findUnique` include:**

```ts
        contacts: { orderBy: { sortOrder: "asc" } },
        materialSpecs: { orderBy: { sortOrder: "asc" } },
        clientQuotes: { select: { id: true } },
```

và trong `purchaseOrders.include` giữ nguyên (đã có `supplier.name`; các cột `value`, `expectedDate`, `receivedDate` có sẵn trên model). Sau `if (!project) notFound();`:

```ts
  const nowMs = serverNow();
  const healthInput = {
    milestones: project.milestones,
    payments: paymentRows,
    purchaseOrders: project.purchaseOrders,
    contracts: project.contracts,
    salePrice: project.salePrice,
  };
  const hienTien = canViewPayment; // dời khai báo canEditPayment/canViewPayment lên trên đoạn này
  const co = tinhCo(healthInput, nowMs, { anTien: !hienTien });
  const chiSo = tinhChiSo(healthInput);
```

`project.contracts` cần thêm `valueWithVat`, `signDate` — include hiện tại lấy toàn bộ cột scalar nên đã có.

- [ ] **Step 2: Chèn khối** ngay sau `</div>` của header (trước `<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">`):

```tsx
      <section id="tong-quan" className="space-y-6 scroll-mt-20">
        <HealthBanner muc={co.muc} lyDo={co.lyDo} {...chiSo} hienTien={hienTien} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Chủ đầu tư & người liên hệ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="divide-y divide-slate-100">
                <InfoRow label="Chủ đầu tư" value={project.customer?.name ?? "—"} />
                <InfoRow label="Địa chỉ" value={project.customer?.address ?? "—"} />
              </div>
              <ProjectContacts
                projectId={project.id}
                contacts={project.contacts.map(({ id, name, role, phone, email, note }) => ({ id, name, role, phone, email, note }))}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Vật tư</CardTitle></CardHeader>
            <CardContent>
              <MaterialInfo
                projectId={project.id}
                info={{ mauSon: project.mauSon, mauTonMai: project.mauTonMai, mauTonVach: project.mauTonVach, ghiChuVatTu: project.ghiChuVatTu }}
                specs={project.materialSpecs.map(({ id, tag, name, spec, origin }) => ({ id, tag, name, spec, origin }))}
                orders={canViewPurchase ? project.purchaseOrders.map((o) => ({
                  id: o.id, category: o.category, status: o.status, supplierName: o.supplier?.name ?? null,
                  value: canViewProfit ? o.value : null, totalWeight: o.totalWeight,
                  expectedDate: o.expectedDate?.toISOString() ?? null, receivedDate: o.receivedDate?.toISOString() ?? null,
                })) : []}
                canEdit={canEdit}
                coBaoGia={project.clientQuotes.length > 0}
                nowMs={nowMs}
              />
            </CardContent>
          </Card>
        </div>
      </section>
```

Trong khối "Thông tin dự án" cũ, bỏ 3 dòng Chủ đầu tư / Người phụ trách / Điện thoại (đã chuyển lên khối mới; dòng người liên hệ cũ của `Customer` hiện trong `ProjectContacts` như mục đầu tiên, xem Step 4). Truyền `nowMs={nowMs}` cho `<Milestones>` và đổi `now={serverNow()}` của `ProjectPayments` thành `now={nowMs}`.

- [ ] **Step 3: `HealthBanner.tsx`** (không `"use client"`):

```tsx
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatVND } from "@/lib/utils";
import type { LyDo, MucCo } from "@/lib/projectHealth";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export function HealthBanner(p: {
  muc: MucCo; lyDo: LyDo[]; tienDo: number; daThu: number | null;
  giaTriHD: number | null; conPhaiThu: number; hienTien: boolean;
}) {
  const style =
    p.muc === "DO" ? "border-red-200 bg-red-50" : p.muc === "VANG" ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50";
  const Icon = p.muc === "DO" ? AlertTriangle : p.muc === "VANG" ? Clock : CheckCircle2;
  const iconCls = p.muc === "DO" ? "text-red-600" : p.muc === "VANG" ? "text-amber-600" : "text-green-600";
  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconCls}`} />
          {p.lyDo.length === 0 ? (
            <p className="text-sm font-medium text-green-800">Không có việc quá hạn hay sắp đến hạn.</p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {p.lyDo.map((l, i) => (
                <li key={i} className={l.muc === "DO" ? "text-red-800" : "text-amber-800"}>{l.text}</li>
              ))}
            </ul>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-500">Tiến độ</dt><dd className="font-semibold">{pct(p.tienDo)}</dd></div>
          <div><dt className="text-slate-500">Đã thu</dt><dd className="font-semibold">{pct(p.daThu)}</dd></div>
          {p.hienTien && (
            <>
              <div><dt className="text-slate-500">Giá trị HĐ</dt><dd className="font-semibold">{p.giaTriHD != null ? formatVND(p.giaTriHD) : "—"}</dd></div>
              <div><dt className="text-slate-500">Còn phải thu</dt><dd className="font-semibold">{formatVND(p.conPhaiThu)}</dd></div>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `ProjectContacts.tsx`** — client component. Hiển thị danh sách (tên, badge vai trò từ `CONTACT_ROLE_MAP`, `tel:` link, `mailto:` link, ghi chú); khi `canEdit`: nút "Thêm người liên hệ", mỗi dòng có Sửa/Xoá; form inline 5 ô (Input tên, Select vai trò từ `CONTACT_ROLE` + option rỗng, Input SĐT, Input email, Input ghi chú). Theo đúng mẫu `useTransition` + `useToast` + `router.refresh()` của `Milestones.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { CONTACT_ROLE, CONTACT_ROLE_MAP } from "@/lib/constants";
import { deleteContact, saveContact } from "./overviewActions";

export interface ContactRow { id: string; name: string; role: string | null; phone: string | null; email: string | null; note: string | null }
type Draft = { id?: string; name: string; role: string; phone: string; email: string; note: string };
const EMPTY: Draft = { name: "", role: "", phone: "", email: "", note: "" };

export function ProjectContacts({ projectId, contacts, canEdit }: { projectId: string; contacts: ContactRow[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!draft) return;
    start(async () => {
      const r = await saveContact(projectId, draft);
      if (!r.ok) return toast.error(r.error);
      setDraft(null);
      router.refresh();
    });
  }
  function remove(c: ContactRow) {
    if (!confirm(`Xoá người liên hệ "${c.name}"?`)) return;
    start(async () => {
      const r = await deleteContact(projectId, c.id);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  return (
    <div className="space-y-2">
      {contacts.length === 0 && !draft && <p className="text-sm text-slate-400">Chưa có người liên hệ</p>}
      {contacts.map((c) =>
        draft?.id === c.id ? null : (
          <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{c.name}</span>
                {c.role && <Badge tone="blue">{CONTACT_ROLE_MAP[c.role]?.label ?? c.role}</Badge>}
              </div>
              <div className="text-slate-600">
                {c.phone && <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>}
                {c.phone && c.email && <span className="mx-1.5 text-slate-300">·</span>}
                {c.email && <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>}
              </div>
              {c.note && <div className="text-xs text-slate-500">{c.note}</div>}
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label="Sửa" onClick={() => setDraft({ id: c.id, name: c.name, role: c.role ?? "", phone: c.phone ?? "", email: c.email ?? "", note: c.note ?? "" })}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Xoá" disabled={pending} onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        )
      )}
      {draft && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          <Input placeholder="Tên *" value={draft.name} onChange={set("name")} />
          <Select value={draft.role} onChange={set("role")}>
            <option value="">— Vai trò —</option>
            {CONTACT_ROLE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Input placeholder="Điện thoại" value={draft.phone} onChange={set("phone")} />
          <Input placeholder="Email" type="email" value={draft.email} onChange={set("email")} />
          <Input className="sm:col-span-2" placeholder="Ghi chú" value={draft.note} onChange={set("note")} />
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" disabled={pending} onClick={save}>Lưu</Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>Huỷ</Button>
          </div>
        </div>
      )}
      {canEdit && !draft && (
        <Button size="sm" variant="outline" onClick={() => setDraft(EMPTY)}><Plus className="h-4 w-4" /> Thêm người liên hệ</Button>
      )}
    </div>
  );
}
```

Ở `page.tsx`, nếu `project.customer?.contactPerson` có giá trị thì hiện thêm một `InfoRow label="Liên hệ (hồ sơ CĐT)"` với `contactPerson · phone` trên danh sách — giữ được thông tin cũ.

- [ ] **Step 5: `MaterialInfo.tsx`** — client component, ba phần:

1. **Màu & ghi chú:** chế độ xem = lưới 2 cột "Màu sơn kết cấu", "Màu tôn mái", "Màu tôn vách", "Ghi chú vật tư" (giá trị null → "—"). Khi `canEdit` có nút "Sửa" chuyển sang 3 `Input` + 1 `Textarea`, nút Lưu gọi `saveMaterialInfo(projectId, { mauSon, mauTonMai, mauTonVach, ghiChuVatTu })`.
2. **Chủng loại theo HĐ:** bảng cột Nhóm (`VAT_TU_TAG_MAP[tag]?.label ?? "Dùng chung"`), Tên, Thông số, Xuất xứ. `canEdit`: mỗi dòng có ↑ ↓ (`moveMaterialSpec`), Sửa (form inline 4 ô: Select nhóm với option rỗng "Dùng chung", Input tên, thông số, xuất xứ → `saveMaterialSpec`), Xoá (`confirm` → `deleteMaterialSpec`); nút "Thêm dòng"; nút "Lấy từ báo giá" — `disabled={!coBaoGia}` với `title="Dự án chưa có báo giá gửi khách"`; khi bảng đã có dòng thì `confirm("Thay toàn bộ chủng loại hiện tại bằng bảng vật liệu của báo giá?")` trước khi gọi `copySpecsFromQuote`.
3. **Đơn mua:** gom `orders` theo `category` theo thứ tự KCT, XA_GO, TON, VTP; mỗi đơn một dòng: Badge nhóm (`PO_CATEGORY_MAP`), Badge trạng thái (`PO_STATUS_MAP`), NCC, `formatNumber(totalWeight) kg`, `formatVND(value)` nếu value ≠ null, "Giao: dd/mm" dự kiến/thực tế (`formatDate`). Đơn trễ (`status !== "RECEIVED"` và `expectedDate` và `soNgay(nowMs, Date.parse(expectedDate)) < 0`) có viền đỏ `border border-red-200 bg-red-50`. `orders` rỗng → "Chưa có đơn đặt hàng".

Mọi action theo đúng mẫu `start(async () => { const r = await …; if (!r.ok) toast.error(r.error); else router.refresh(); })`. Import `soNgay` từ `@/lib/projectHealth` (module thuần, dùng được ở client).

- [ ] **Step 6: Tô màu mốc trong `Milestones.tsx`** — thêm prop `nowMs: number` cho `Milestones` và `Row`; trong `Row` tính:

```ts
  const tt = trangThaiMoc({ planDate: value.planDate ? new Date(value.planDate) : null, done: value.done }, nowMs);
  const mau = { XONG: "border-l-green-500", TRE: "border-l-red-500 bg-red-50", SAP_DEN: "border-l-amber-500 bg-amber-50", DUNG_HAN: "border-l-slate-300", CHUA_CO: "border-l-slate-200" }[tt];
```

và thêm `border-l-4 ${mau}` vào className phần tử gốc của dòng (cả nhánh `!canEdit` lẫn nhánh sửa). Dùng giá trị đã lưu (`value`), không dùng state đang gõ.

- [ ] **Step 7: Kiểm tra** `npm run typecheck && npm run lint && npm test` — Expected: sạch. Build production + PGlite cục bộ, mở một dự án có mốc trễ, một dự án trống: khối Tổng quan hiện đúng, thêm/sửa/xoá liên hệ, sửa màu, thêm/sắp xếp/xoá chủng loại, "Lấy từ báo giá" chạy; đăng nhập vai Kỹ thuật → không thấy số tiền ở dải cờ.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/projects/[id]/page.tsx" "src/app/(app)/projects/[id]/Milestones.tsx" "src/app/(app)/projects/[id]/HealthBanner.tsx" "src/app/(app)/projects/[id]/ProjectContacts.tsx" "src/app/(app)/projects/[id]/MaterialInfo.tsx"
git commit -m "feat(du-an): khối Tổng quan trong trang chi tiết dự án"
```

---

### Task 5: Trang tổng hợp `/projects/tong-quan`

**Files:**
- Create: `src/app/(app)/projects/tong-quan/page.tsx`, `src/app/(app)/projects/tong-quan/BangTongQuan.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (sau mục `/projects`, dòng ~114), `src/app/(app)/projects/page.tsx` (nút link cạnh "Xuất Excel")

**Interfaces:**
- Consumes: `tinhCo`, `tinhChiSo`, `soSanhCo`, `MucCo`, `LyDo`; `scopedProjectWhere`; `requireView("project")`; `PROJECT_STATUS`, `PROJECT_STATUS_MAP`.
- Produces: `TongQuanRow = { id; code; name; customerName: string|null; status: string; muc: MucCo; lyDo: string[]; tienDo: number; daThu: number|null; giaTriHD: number|null; conPhaiThu: number }`.

- [ ] **Step 1: Đọc tài liệu route** trong `node_modules/next/dist/docs/` về segment tĩnh nằm cạnh segment động (`projects/tong-quan` vs `projects/[id]`) — xác nhận segment tĩnh thắng. Nếu không, đổi đường dẫn sang `/tong-quan-du-an` và cập nhật mọi link trong task này.

- [ ] **Step 2: `page.tsx`:**

```tsx
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { scopedProjectWhere } from "@/lib/scope";
import { serverNow } from "@/lib/now";
import { soSanhCo, tinhChiSo, tinhCo } from "@/lib/projectHealth";
import { BangTongQuan, type TongQuanRow } from "./BangTongQuan";

export default async function TongQuanDuAnPage() {
  const session = await requireView("project");
  const hienTien = can(session.role, "debt", "view") || can(session.role, "cost", "edit");
  const where = { AND: [await scopedProjectWhere(session), { status: { not: "HOAN_THANH" } }] };
  const nowMs = serverNow();

  const projects = await db.project.findMany({
    where,
    select: {
      id: true, code: true, name: true, status: true, salePrice: true,
      customer: { select: { name: true } },
      milestones: { select: { type: true, planDate: true, done: true } },
      payments: { where: { direction: "THU" }, select: { direction: true, name: true, amount: true, paidAmount: true, dueDate: true } },
      purchaseOrders: { select: { category: true, status: true, expectedDate: true } },
      contracts: { select: { valueWithVat: true, status: true, signDate: true } },
    },
  });

  const rows: TongQuanRow[] = projects
    .map((p) => {
      const co = tinhCo(p, nowMs, { anTien: !hienTien });
      const cs = tinhChiSo(p);
      return {
        id: p.id, code: p.code, name: p.name, customerName: p.customer?.name ?? null, status: p.status,
        muc: co.muc, lyDo: co.lyDo.map((l) => l.text), tienDo: cs.tienDo, daThu: cs.daThu,
        giaTriHD: hienTien ? cs.giaTriHD : null, conPhaiThu: hienTien ? cs.conPhaiThu : 0,
      };
    })
    .sort((a, b) => soSanhCo(a.muc, b.muc) || a.code.localeCompare(b.code));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tổng quan dự án</h1>
        <p className="text-sm text-slate-500">Dự án đang chạy — cờ đỏ: quá hạn, cờ vàng: đến hạn trong 7 ngày</p>
      </div>
      <BangTongQuan rows={rows} hienTien={hienTien} />
    </div>
  );
}
```

Nếu `scopedProjectWhere` trả kiểu không ghép được vào `AND`, xem kiểu trả về trong `src/lib/scope.ts` và ghép theo đúng kiểu `Prisma.ProjectWhereInput`.

- [ ] **Step 3: `BangTongQuan.tsx`** — client component. State: `loc: "ALL" | "DO" | "VANG" | "CO"` (mặc định `"ALL"`), `trangThai: string` (mặc định `""`). Thanh lọc: 4 nút chọn cờ (kèm số lượng mỗi loại) + `Select` trạng thái từ `PROJECT_STATUS`. Bảng (bọc `overflow-x-auto`) cột: Cờ (chấm tròn đỏ/vàng/xanh), Dự án (`code` mono + tên), CĐT, Giai đoạn (Badge từ `PROJECT_STATUS_MAP`), Tiến độ (thanh % nhỏ + số), Đã thu (% hoặc "—"), [Giá trị HĐ, Còn phải thu khi `hienTien`], Lý do (`lyDo[0]` + `(+k)` khi `lyDo.length > 1`, `title` = toàn bộ lý do nối `\n`). Cả dòng là `Link` tới `/projects/${id}#tong-quan`. Không có dòng → "Không có dự án nào khớp bộ lọc".

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { PROJECT_STATUS, PROJECT_STATUS_MAP } from "@/lib/constants";
import { formatVND } from "@/lib/utils";
import type { MucCo } from "@/lib/projectHealth";

export interface TongQuanRow {
  id: string; code: string; name: string; customerName: string | null; status: string;
  muc: MucCo; lyDo: string[]; tienDo: number; daThu: number | null; giaTriHD: number | null; conPhaiThu: number;
}
type Loc = "ALL" | "DO" | "VANG" | "CO";
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const CHAM: Record<string, string> = { DO: "bg-red-500", VANG: "bg-amber-400", OK: "bg-green-500" };

export function BangTongQuan({ rows, hienTien }: { rows: TongQuanRow[]; hienTien: boolean }) {
  const [loc, setLoc] = useState<Loc>("ALL");
  const [trangThai, setTrangThai] = useState("");
  const dem = useMemo(
    () => ({ ALL: rows.length, DO: rows.filter((r) => r.muc === "DO").length, VANG: rows.filter((r) => r.muc === "VANG").length, CO: rows.filter((r) => r.muc).length }),
    [rows]
  );
  const hien = rows.filter(
    (r) =>
      (loc === "ALL" || (loc === "CO" ? r.muc !== null : r.muc === loc)) &&
      (!trangThai || r.status === trangThai)
  );
  const NUT: [Loc, string][] = [["ALL", "Tất cả"], ["DO", "Cờ đỏ"], ["VANG", "Cờ vàng"], ["CO", "Có cờ"]];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {NUT.map(([k, label]) => (
          <button key={k} onClick={() => setLoc(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${loc === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {label} ({dem[k]})
          </button>
        ))}
        <Select className="w-48" value={trangThai} onChange={(e) => setTrangThai(e.target.value)}>
          <option value="">Mọi giai đoạn</option>
          {PROJECT_STATUS.filter((o) => o.value !== "HOAN_THANH").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Dự án</th>
              <th className="px-3 py-2">CĐT</th>
              <th className="px-3 py-2">Giai đoạn</th>
              <th className="px-3 py-2">Tiến độ</th>
              <th className="px-3 py-2">Đã thu</th>
              {hienTien && <th className="px-3 py-2 text-right">Giá trị HĐ</th>}
              {hienTien && <th className="px-3 py-2 text-right">Còn phải thu</th>}
              <th className="px-3 py-2">Lý do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hien.length === 0 && (
              <tr><td colSpan={hienTien ? 9 : 7} className="px-3 py-6 text-center text-slate-400">Không có dự án nào khớp bộ lọc</td></tr>
            )}
            {hien.map((r) => {
              const st = PROJECT_STATUS_MAP[r.status];
              const href = `/projects/${r.id}#tong-quan`;
              const cell = (c: React.ReactNode, cls = "") => <td className={`px-3 py-2 ${cls}`}><Link href={href} className="block">{c}</Link></td>;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  {cell(<span className={`inline-block h-2.5 w-2.5 rounded-full ${CHAM[r.muc ?? "OK"]}`} />)}
                  {cell(<><span className="font-mono">{r.code}</span> <span className="text-slate-600">{r.name}</span></>)}
                  {cell(r.customerName ?? "—")}
                  {cell(<Badge tone={st?.tone ?? "slate"}>{st?.label ?? r.status}</Badge>)}
                  {cell(
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded bg-slate-200"><div className="h-1.5 rounded bg-blue-500" style={{ width: `${r.tienDo * 100}%` }} /></div>
                      {pct(r.tienDo)}
                    </div>
                  )}
                  {cell(pct(r.daThu))}
                  {hienTien && cell(r.giaTriHD != null ? formatVND(r.giaTriHD) : "—", "text-right")}
                  {hienTien && cell(formatVND(r.conPhaiThu), "text-right")}
                  {cell(
                    <span title={r.lyDo.join("\n")} className={r.muc === "DO" ? "text-red-700" : "text-amber-700"}>
                      {r.lyDo[0] ?? ""}{r.lyDo.length > 1 && <span className="text-slate-400"> (+{r.lyDo.length - 1})</span>}
                    </span>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Kiểm tra trước: `PROJECT_STATUS` có tồn tại và `Option` có trường `tone` (`grep -n "PROJECT_STATUS\b\|interface Option" -A3 src/lib/constants.ts`); `Select` nhận `className`.

- [ ] **Step 4: Sidebar** — thêm ngay sau mục `/projects`:

```ts
      { href: "/projects/tong-quan", label: "Tổng quan dự án", icon: Gauge, resource: "project" },
```

thêm `Gauge` vào import `lucide-react` của file. Kiểm tra logic tô sáng mục đang chọn của Sidebar: nếu mục "Dự án" khớp theo tiền tố `/projects`, đảm bảo khi ở `/projects/tong-quan` chỉ mục mới sáng (xem cách các mục khác dùng `gianh`).

- [ ] **Step 5: Link từ danh sách dự án** — trong `src/app/(app)/projects/page.tsx`, bọc nút "Xuất Excel" trong `<div className="flex gap-2">` và thêm trước nó:

```tsx
          <Link href="/projects/tong-quan" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Gauge className="h-4 w-4" /> Tổng quan
          </Link>
```

(import `Link` từ `next/link`, `Gauge` từ `lucide-react`).

- [ ] **Step 6: Kiểm tra** `npm run typecheck && npm run lint && npm test`; build production + PGlite: mở `/projects/tong-quan` — dự án cờ đỏ ở đầu, bộ lọc chạy, bấm dòng nhảy tới `#tong-quan`; vai Kỹ thuật không thấy cột tiền; dự án `HOAN_THANH` không hiện.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/projects/tong-quan" src/components/layout/Sidebar.tsx "src/app/(app)/projects/page.tsx"
git commit -m "feat(du-an): trang tổng quan dự án có cờ cảnh báo"
```

---

## Self-review

- Spec coverage: trang tổng hợp (T5), khối CĐT + liên hệ (T4), tiến độ tô màu (T4 Step 6), thanh toán (khối có sẵn + chỉ số ở dải cờ, T4), vật tư + màu + chủng loại + lấy từ báo giá + tóm tắt đơn mua (T3–T4), luật cờ & chỉ số (T2), schema (T1), phân quyền xem dự án (T5), audit (T3). Spec mục "tóm tắt chiều CHI" — **không làm riêng**: khối "Thanh toán theo đợt" có sẵn đã hiện cả chiều CHI; ghi chú cho người duyệt.
- Kiểu dùng xuyên task: `HealthInput`, `tinhCo(d, nowMs, {anTien})`, `tinhChiSo`, `soSanhCo`, `trangThaiMoc`, `soNgay` khớp giữa T2/T4/T5.
