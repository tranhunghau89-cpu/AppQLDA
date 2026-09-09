import { describe, expect, it } from "vitest";
import { can, isValidRole, ROLES, ROLE_LABEL } from "./rbac";

describe("isValidRole", () => {
  it("nhận đúng các vai trò đã khai báo", () => {
    for (const r of ROLES) expect(isValidRole(r)).toBe(true);
  });

  it("từ chối giá trị lạ", () => {
    expect(isValidRole("SUPERADMIN")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(123)).toBe(false);
  });
});

describe("can — ma trận phân quyền", () => {
  it("ADMIN sửa được mọi tài nguyên trừ những thứ chỉ đọc", () => {
    expect(can("ADMIN", "project", "edit")).toBe(true);
    expect(can("ADMIN", "user", "edit")).toBe(true);
    // Công nợ và lợi nhuận là số liệu tổng hợp — chỉ đọc kể cả với ADMIN.
    expect(can("ADMIN", "debt", "edit")).toBe(false);
    expect(can("ADMIN", "profit", "edit")).toBe(false);
  });

  it("chỉ ADMIN được quản lý người dùng", () => {
    for (const r of ROLES) {
      expect(can(r, "user", "edit")).toBe(r === "ADMIN");
      expect(can(r, "user", "view")).toBe(r === "ADMIN");
    }
  });

  it("chỉ ADMIN được quản lý mẫu dự toán", () => {
    for (const r of ROLES) {
      expect(can(r, "template", "edit")).toBe(r === "ADMIN");
    }
  });

  it("Kỹ thuật không truy cập được số liệu tiền", () => {
    expect(can("ENGINEERING", "cost", "view")).toBe(false);
    expect(can("ENGINEERING", "debt", "view")).toBe(false);
    expect(can("ENGINEERING", "profit", "view")).toBe(false);
  });

  it("Vật tư sửa được đơn hàng và dự toán, nhưng chỉ xem dự án", () => {
    expect(can("PROCUREMENT", "purchase", "edit")).toBe(true);
    expect(can("PROCUREMENT", "estimate", "edit")).toBe(true);
    expect(can("PROCUREMENT", "project", "edit")).toBe(false);
    expect(can("PROCUREMENT", "project", "view")).toBe(true);
  });

  it("Kinh doanh sửa được hợp đồng, báo giá, CĐT", () => {
    expect(can("SALES", "contract", "edit")).toBe(true);
    expect(can("SALES", "quote", "edit")).toBe(true);
    expect(can("SALES", "customer", "edit")).toBe(true);
    expect(can("SALES", "supplier", "edit")).toBe(false);
  });

  it("Kế toán sửa được chi phí và công nợ", () => {
    expect(can("ACCOUNTING", "cost", "edit")).toBe(true);
    expect(can("ACCOUNTING", "debt", "edit")).toBe(true);
    expect(can("ACCOUNTING", "project", "edit")).toBe(false);
  });

  it("quyền edit luôn kéo theo quyền view", () => {
    const resources = [
      "project", "progress", "estimate", "contract", "purchase",
      "cost", "quote", "debt", "customer", "supplier", "user", "template",
    ] as const;
    for (const role of ROLES) {
      for (const res of resources) {
        if (can(role, res, "edit")) {
          expect(can(role, res, "view"), `${role}/${res}`).toBe(true);
        }
      }
    }
  });

  it("mọi vai trò đều có nhãn hiển thị", () => {
    for (const r of ROLES) expect(ROLE_LABEL[r]).toBeTruthy();
  });
});
