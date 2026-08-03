// Wrapper DB cho TakeoffItem — CHỈ dùng phía server (import Prisma).
import { db } from "@/lib/db";
import type { TakeoffRow } from "@/lib/takeoff-shared";

export type { TakeoffRow } from "@/lib/takeoff-shared";
export { BT_GROUPS, BT_GROUP_MAP, computeConcrete, computeBuiltUp, computePlate } from "@/lib/takeoff-shared";

interface TakeoffDelegate {
  findMany(args?: {
    where?: { projectId?: string; kind?: string };
    orderBy?: Array<Record<string, "asc" | "desc">>;
  }): Promise<TakeoffRow[]>;
  create(args: { data: Omit<TakeoffRow, "id" | "sortOrder"> & { sortOrder?: number } }): Promise<TakeoffRow>;
  delete(args: { where: { id: string } }): Promise<TakeoffRow>;
  findUnique(args: { where: { id: string } }): Promise<TakeoffRow | null>;
}

export const takeoffDb = (db as unknown as { takeoffItem: TakeoffDelegate }).takeoffItem;
