// Phân quyền theo bộ phận (RBAC) — dùng chung server + client.

export const ROLES = ["ADMIN", "SALES", "ENGINEERING", "PROCUREMENT", "ACCOUNTING"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Ban giám đốc / Quản lý",
  SALES: "Kinh doanh / CĐT",
  ENGINEERING: "Kỹ thuật / Thiết kế",
  PROCUREMENT: "Vật tư / Mua hàng",
  ACCOUNTING: "Kế toán / Tài chính",
};

// Các "tài nguyên" trong hệ thống.
export type Resource =
  | "project"
  | "progress"
  | "estimate"
  | "contract"
  | "purchase"
  | "cost"
  | "quote"
  | "debt"
  | "profit"
  | "customer"
  | "supplier"
  | "user";

export type Action = "view" | "edit";

// Ma trận quyền: role -> resource -> các action được phép.
const MATRIX: Record<Role, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {
    project: ["view", "edit"],
    progress: ["view", "edit"],
    estimate: ["view", "edit"],
    contract: ["view", "edit"],
    purchase: ["view", "edit"],
    cost: ["view", "edit"],
    quote: ["view", "edit"],
    debt: ["view"],
    profit: ["view"],
    customer: ["view", "edit"],
    supplier: ["view", "edit"],
    user: ["view", "edit"],
  },
  SALES: {
    project: ["view", "edit"],
    progress: ["view"],
    estimate: ["view"],
    contract: ["view", "edit"],
    purchase: ["view"],
    cost: ["view"],
    quote: ["view", "edit"],
    debt: ["view"],
    profit: ["view"],
    customer: ["view", "edit"],
    supplier: ["view"],
  },
  ENGINEERING: {
    project: ["view", "edit"],
    progress: ["view", "edit"],
    estimate: ["view"],
    contract: ["view"],
    purchase: ["view"],
    quote: ["view"],
    customer: ["view"],
    supplier: ["view"],
  },
  PROCUREMENT: {
    project: ["view"],
    progress: ["view"],
    estimate: ["view", "edit"],
    contract: ["view"],
    purchase: ["view", "edit"],
    cost: ["view"],
    quote: ["view"],
    debt: ["view"],
    supplier: ["view", "edit"],
  },
  ACCOUNTING: {
    project: ["view"],
    estimate: ["view"],
    contract: ["view"],
    purchase: ["view"],
    cost: ["view", "edit"],
    quote: ["view"],
    debt: ["view", "edit"],
    profit: ["view"],
    customer: ["view"],
    supplier: ["view"],
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return MATRIX[role]?.[resource]?.includes(action) ?? false;
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
