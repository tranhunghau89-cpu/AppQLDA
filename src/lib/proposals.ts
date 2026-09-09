// Delegate Prisma cho Proposal.
import type { Proposal } from "@prisma/client";
import { db } from "@/lib/db";

export type ProposalRow = Proposal;

export const proposalDb = db.proposal;
