// Tổng hợp công nợ (chỉ đọc) từ dữ liệu sẵn có:
//  - Phải thu theo Chủ đầu tư: quyết toán → hợp đồng → giá bán.
//  - Phải trả theo Nhà cung cấp: đơn hàng (FK) + quyết toán (khớp tên).
//
// Cấu trúc: `buildReceivables` / `buildPayables` là hàm THUẦN (không chạm DB) để test được;
// `getReceivables` / `getPayables` chỉ lo truy vấn + áp phạm vi dự án rồi gọi hàm thuần.
import { db } from "@/lib/db";
import { norm } from "@/lib/text";

/** Phạm vi dự án được phép xem: "ALL" (ADMIN) hoặc danh sách id. */
export type ProjectScope = string[] | "ALL";

// Chuẩn hóa tên để khớp NCC — dùng chung với phần nhập Excel (xem lib/text.ts).
export { norm } from "@/lib/text";

export type ReceivableSource = "QUYETTOAN" | "HOPDONG" | "GIABAN" | "NONE";

export interface ProjectReceivable {
  projectId: string;
  code: string;
  name: string;
  value: number; // giá trị HĐ / doanh thu
  collected: number; // đã thu
  receivable: number; // còn phải thu
  source: ReceivableSource;
}

export interface CustomerDebt {
  customerId: string | null; // null = chưa gán CĐT
  name: string;
  projects: ProjectReceivable[];
  totalValue: number;
  totalCollected: number;
  totalReceivable: number;
}

export interface ProjectPayable {
  projectId: string;
  code: string;
  name: string;
  ordered: number; // Σ đơn hàng
  qtValue: number; // Σ giá trị quyết toán
  paid: number; // Σ đã trả
  base: number; // qtValue>0 ? qtValue : ordered
  payable: number; // base - paid
}

export interface SupplierDebt {
  supplierId: string | null; // null = NCC chưa khớp
  name: string;
  category: string | null;
  matched: boolean;
  projects: ProjectPayable[];
  totalOrdered: number;
  totalQtValue: number;
  totalPaid: number;
  totalBase: number;
  totalPayable: number;
}

// ----- Đầu vào của các hàm thuần -----

export interface ContractValueInput {
  valueWithVat: number | null;
  status: string;
  signDate: Date | null;
}

export interface ReceivableProjectInput {
  id: string;
  code: string;
  name: string;
  salePrice: number | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  costSummary: {
    revenue: number | null;
    collectedWithVat: number | null;
    receivable: number | null;
  } | null;
  contracts: ContractValueInput[];
}

export interface ProjectRefInput {
  id: string;
  code: string;
  name: string;
}

export interface SupplierInput {
  id: string;
  name: string;
  category: string;
}

export interface PayableOrderInput {
  supplierId: string | null;
  value: number | null;
  project: ProjectRefInput;
}

export interface PayableCategoryInput {
  supplier: string | null;
  value: number | null;
  payment: number | null;
  summary: { project: ProjectRefInput } | null;
}

/** Giá trị hợp đồng đại diện của 1 dự án: ưu tiên HĐ đã ký mới nhất. */
export function pickContractValue(contracts: ContractValueInput[]): number | null {
  if (contracts.length === 0) return null;
  const ranked = [...contracts].sort((a, b) => {
    const sa = a.status === "SIGNED" || a.status === "LIQUIDATED" ? 1 : 0;
    const sb = b.status === "SIGNED" || b.status === "LIQUIDATED" ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (b.signDate?.getTime() ?? 0) - (a.signDate?.getTime() ?? 0);
  });
  return ranked[0].valueWithVat ?? null;
}

/** Gom công nợ phải thu theo chủ đầu tư. Hàm thuần — không chạm DB. */
export function buildReceivables(projects: ReceivableProjectInput[]): CustomerDebt[] {
  const groups = new Map<string, CustomerDebt>();

  for (const p of projects) {
    const cs = p.costSummary;
    let value = 0;
    let source: ReceivableSource = "NONE";
    if (cs?.revenue != null) {
      value = cs.revenue;
      source = "QUYETTOAN";
    } else {
      const cv = pickContractValue(p.contracts);
      if (cv != null) {
        value = cv;
        source = "HOPDONG";
      } else if (p.salePrice != null) {
        value = p.salePrice;
        source = "GIABAN";
      }
    }

    const collected = cs?.collectedWithVat ?? 0;
    const receivable = cs?.receivable != null ? cs.receivable : value - collected;

    // Bỏ qua dự án hoàn toàn không có số liệu để tránh nhiễu.
    if (source === "NONE" && collected === 0) continue;

    const key = p.customerId ?? "__none__";
    let g = groups.get(key);
    if (!g) {
      g = {
        customerId: p.customerId ?? null,
        name: p.customer?.name ?? "Chưa gán CĐT",
        projects: [],
        totalValue: 0,
        totalCollected: 0,
        totalReceivable: 0,
      };
      groups.set(key, g);
    }
    g.projects.push({
      projectId: p.id,
      code: p.code,
      name: p.name,
      value,
      collected,
      receivable,
      source,
    });
    g.totalValue += value;
    g.totalCollected += collected;
    g.totalReceivable += receivable;
  }

  return [...groups.values()].sort((a, b) => b.totalReceivable - a.totalReceivable);
}

/** Gom công nợ phải trả theo nhà cung cấp. Hàm thuần — không chạm DB. */
export function buildPayables(
  suppliers: SupplierInput[],
  orders: PayableOrderInput[],
  categories: PayableCategoryInput[]
): SupplierDebt[] {
  // Khóa nhóm: supplierId nếu có/khớp được, ngược lại "name:<norm>".
  const byNorm = new Map<string, SupplierInput>();
  for (const s of suppliers) {
    const n = norm(s.name);
    if (n && !byNorm.has(n)) byNorm.set(n, s);
  }
  const byId = new Map(suppliers.map((s) => [s.id, s]));

  const groups = new Map<string, SupplierDebt>();
  function group(key: string, seed: () => SupplierDebt): SupplierDebt {
    let g = groups.get(key);
    if (!g) {
      g = seed();
      groups.set(key, g);
    }
    return g;
  }
  function project(g: SupplierDebt, p: ProjectRefInput): ProjectPayable {
    let pr = g.projects.find((x) => x.projectId === p.id);
    if (!pr) {
      pr = {
        projectId: p.id,
        code: p.code,
        name: p.name,
        ordered: 0,
        qtValue: 0,
        paid: 0,
        base: 0,
        payable: 0,
      };
      g.projects.push(pr);
    }
    return pr;
  }

  // Đơn hàng (FK supplierId).
  for (const o of orders) {
    if (!o.supplierId) continue;
    const s = byId.get(o.supplierId);
    if (!s) continue;
    const g = group(`id:${s.id}`, () => ({
      supplierId: s.id,
      name: s.name,
      category: s.category,
      matched: true,
      projects: [],
      totalOrdered: 0,
      totalQtValue: 0,
      totalPaid: 0,
      totalBase: 0,
      totalPayable: 0,
    }));
    project(g, o.project).ordered += o.value ?? 0;
  }

  // Quyết toán (CostCategory.supplier là text → khớp theo norm).
  for (const c of categories) {
    if (!c.supplier || !c.summary?.project) continue;
    const matched = byNorm.get(norm(c.supplier));
    const key = matched ? `id:${matched.id}` : `name:${norm(c.supplier)}`;
    const supplierName = c.supplier;
    const g = group(key, () =>
      matched
        ? {
            supplierId: matched.id,
            name: matched.name,
            category: matched.category,
            matched: true,
            projects: [],
            totalOrdered: 0,
            totalQtValue: 0,
            totalPaid: 0,
            totalBase: 0,
            totalPayable: 0,
          }
        : {
            supplierId: null,
            name: supplierName,
            category: null,
            matched: false,
            projects: [],
            totalOrdered: 0,
            totalQtValue: 0,
            totalPaid: 0,
            totalBase: 0,
            totalPayable: 0,
          }
    );
    const pr = project(g, c.summary.project);
    pr.qtValue += c.value ?? 0;
    pr.paid += c.payment ?? 0;
  }

  // Tính base/payable & tổng.
  for (const g of groups.values()) {
    for (const pr of g.projects) {
      pr.base = pr.qtValue > 0 ? pr.qtValue : pr.ordered;
      // Còn phải trả = phần chưa thanh toán; đã trả vượt giá trị (gồm VAT) ⇒ coi như tất toán.
      pr.payable = Math.max(0, pr.base - pr.paid);
      g.totalOrdered += pr.ordered;
      g.totalQtValue += pr.qtValue;
      g.totalPaid += pr.paid;
      g.totalBase += pr.base;
      g.totalPayable += pr.payable;
    }
    g.projects.sort((a, b) => b.base - a.base);
  }

  // Ưu tiên NCC còn nợ; nếu đã tất toán thì xếp theo quy mô giao dịch.
  return [...groups.values()]
    .filter((g) => g.totalBase > 0 || g.totalPaid > 0 || g.totalOrdered > 0)
    .sort((a, b) => b.totalPayable - a.totalPayable || b.totalBase - a.totalBase);
}

// ----- Truy vấn (áp phạm vi dự án được giao) -----

export async function getReceivables(scope: ProjectScope = "ALL"): Promise<CustomerDebt[]> {
  const projects = await db.project.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    select: {
      id: true,
      code: true,
      name: true,
      salePrice: true,
      customerId: true,
      customer: { select: { id: true, name: true } },
      costSummary: {
        select: { revenue: true, collectedWithVat: true, receivable: true },
      },
      contracts: { select: { valueWithVat: true, status: true, signDate: true } },
    },
    orderBy: { code: "asc" },
  });

  return buildReceivables(projects);
}

export async function getPayables(scope: ProjectScope = "ALL"): Promise<SupplierDebt[]> {
  const [suppliers, orders, categories] = await Promise.all([
    db.supplier.findMany({ select: { id: true, name: true, category: true } }),
    db.purchaseOrder.findMany({
      where: scope === "ALL" ? {} : { projectId: { in: scope } },
      select: {
        supplierId: true,
        value: true,
        project: { select: { id: true, code: true, name: true } },
      },
    }),
    db.costCategory.findMany({
      where: scope === "ALL" ? {} : { summary: { projectId: { in: scope } } },
      select: {
        supplier: true,
        value: true,
        payment: true,
        summary: { select: { project: { select: { id: true, code: true, name: true } } } },
      },
    }),
  ]);

  return buildPayables(suppliers, orders, categories);
}
