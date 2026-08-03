// Truy cập bảng Proposal qua wrapper có kiểu (cùng lý do với project-notes.ts).
import { db } from "@/lib/db";

export interface ProposalRow {
  id: string;
  title: string;
  kind: string;
  amount: number | null;
  content: string | null;
  projectId: string | null;
  status: string;
  createdBy: string;
  decidedBy: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProposalDelegate {
  findMany(args?: {
    where?: { status?: string };
    orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">;
  }): Promise<ProposalRow[]>;
  findUnique(args: { where: { id: string } }): Promise<ProposalRow | null>;
  create(args: {
    data: {
      title: string;
      kind: string;
      amount?: number | null;
      content?: string | null;
      projectId?: string | null;
      createdBy: string;
    };
  }): Promise<ProposalRow>;
  update(args: {
    where: { id: string };
    data: {
      status?: string;
      decidedBy?: string | null;
      decisionNote?: string | null;
      decidedAt?: Date | null;
    };
  }): Promise<ProposalRow>;
  delete(args: { where: { id: string } }): Promise<ProposalRow>;
}

export const proposalDb = (db as unknown as { proposal: ProposalDelegate }).proposal;
