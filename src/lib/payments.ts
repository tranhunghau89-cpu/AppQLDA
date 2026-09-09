// Delegate Prisma cho Payment.
import type { Payment } from "@prisma/client";
import { db } from "@/lib/db";

export type PaymentRow = Payment;

export const paymentDb = db.payment;
