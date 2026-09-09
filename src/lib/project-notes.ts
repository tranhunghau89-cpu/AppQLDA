// Delegate Prisma cho ProjectNote / NoteImage.
// (Trước đây là wrapper tự khai báo kiểu vì Prisma Client chưa được generate lại;
//  nay `prisma generate` chạy trong `postinstall` nên dùng thẳng kiểu sinh ra.)
import type { NoteImage, ProjectNote } from "@prisma/client";
import { db } from "@/lib/db";

export type ProjectNoteRow = ProjectNote;
export type NoteImageRow = NoteImage;

export const projectNoteDb = db.projectNote;
export const noteImageDb = db.noteImage;
