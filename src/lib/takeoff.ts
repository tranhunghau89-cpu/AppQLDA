// Delegate Prisma cho TakeoffItem — CHỈ dùng phía server (import Prisma).
// Phần tính toán & hằng số dùng chung client/server nằm ở takeoff-shared.ts.
import { db } from "@/lib/db";

export type { TakeoffRow } from "@/lib/takeoff-shared";
export { BT_GROUPS, BT_GROUP_MAP, computeConcrete, computeBuiltUp, computePlate } from "@/lib/takeoff-shared";

export const takeoffDb = db.takeoffItem;
