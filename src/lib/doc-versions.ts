// Truy cập bảng DocVersion qua wrapper có kiểu (cùng lý do với project-notes.ts).
import { db } from "@/lib/db";

export interface DocVersionRow {
  id: string;
  projectId: string;
  docType: string;
  version: string;
  issuedAt: Date | null;
  status: string;
  note: string | null;
  authorName: string | null;
  createdAt: Date;
}

interface DocVersionDelegate {
  findMany(args?: {
    where?: { projectId?: string; docType?: string };
    orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">;
  }): Promise<DocVersionRow[]>;
  create(args: {
    data: {
      projectId: string;
      docType: string;
      version: string;
      issuedAt?: Date | null;
      status?: string;
      note?: string | null;
      authorName?: string | null;
    };
  }): Promise<DocVersionRow>;
  delete(args: { where: { id: string } }): Promise<DocVersionRow>;
}

export const docVersionDb = (db as unknown as { docVersion: DocVersionDelegate }).docVersion;
