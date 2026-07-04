// Truy cập bảng ProjectNote qua wrapper có kiểu.
// Lý do: Prisma Client trong node_modules có thể chưa được generate lại sau khi
// thêm model ProjectNote (generate chạy trong build trên Vercel). Wrapper này
// giữ type-safety ở mức app mà không phụ thuộc type generated.
import { db } from "@/lib/db";

export interface ProjectNoteRow {
  id: string;
  projectId: string;
  content: string;
  authorName: string | null;
  createdAt: Date;
}

interface ProjectNoteDelegate {
  findMany(args?: {
    where?: { projectId?: string };
    orderBy?: { createdAt: "asc" | "desc" };
    take?: number;
  }): Promise<ProjectNoteRow[]>;
  create(args: {
    data: { projectId: string; content: string; authorName?: string | null };
  }): Promise<ProjectNoteRow>;
  delete(args: { where: { id: string } }): Promise<ProjectNoteRow>;
}

export const projectNoteDb = (db as unknown as { projectNote: ProjectNoteDelegate }).projectNote;
