import { Badge } from "./badge";
import { PROJECT_STATUS_MAP } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const opt = PROJECT_STATUS_MAP[status];
  return <Badge tone={opt?.tone ?? "slate"}>{opt?.label ?? status}</Badge>;
}
