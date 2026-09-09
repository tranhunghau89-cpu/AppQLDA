// Delegate Prisma cho DocVersion.
import type { DocVersion } from "@prisma/client";
import { db } from "@/lib/db";

export type DocVersionRow = DocVersion;

export const docVersionDb = db.docVersion;
