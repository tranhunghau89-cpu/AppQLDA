import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { proposalDb } from "@/lib/proposals";
import { ProposalBoard, type ProposalItem } from "./ProposalBoard";

export default async function ApprovalsPage() {
  const session = await requireSession();

  const rows = await proposalDb.findMany({ orderBy: [{ createdAt: "desc" }] });
  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    select: { id: true, code: true, name: true },
  });
  const codeById = new Map(projects.map((p) => [p.id, p.code]));

  const proposals: ProposalItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    amount: r.amount,
    content: r.content,
    projectId: r.projectId,
    projectCode: r.projectId ? (codeById.get(r.projectId) ?? null) : null,
    status: r.status,
    createdBy: r.createdBy,
    decidedBy: r.decidedBy,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Phê duyệt</h1>
        <p className="text-sm text-slate-500">
          Đề xuất mua hàng, thanh toán... — nhân viên gửi, quản trị viên duyệt hoặc từ chối
        </p>
      </div>
      <ProposalBoard
        proposals={proposals}
        projects={projects}
        isAdmin={session.role === "ADMIN"}
        userName={session.name}
      />
    </div>
  );
}
