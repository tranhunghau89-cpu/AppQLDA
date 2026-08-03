// Truy cập bảng Payment qua wrapper có kiểu (cùng lý do với project-notes.ts).
import { db } from "@/lib/db";

export interface PaymentRow {
  id: string;
  projectId: string;
  direction: string; // THU | CHI
  counterpart: string | null;
  name: string;
  amount: number | null;
  dueDate: Date | null;
  paidDate: Date | null;
  paidAmount: number | null;
  note: string | null;
  createdAt: Date;
}

interface PaymentDelegate {
  findMany(args?: {
    where?: { projectId?: string; direction?: string };
    orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">;
  }): Promise<PaymentRow[]>;
  findUnique(args: { where: { id: string } }): Promise<PaymentRow | null>;
  create(args: {
    data: {
      projectId: string;
      direction: string;
      counterpart?: string | null;
      name: string;
      amount?: number | null;
      dueDate?: Date | null;
      paidDate?: Date | null;
      paidAmount?: number | null;
      note?: string | null;
    };
  }): Promise<PaymentRow>;
  update(args: {
    where: { id: string };
    data: { paidDate?: Date | null; paidAmount?: number | null; note?: string | null };
  }): Promise<PaymentRow>;
  delete(args: { where: { id: string } }): Promise<PaymentRow>;
}

export const paymentDb = (db as unknown as { payment: PaymentDelegate }).payment;
