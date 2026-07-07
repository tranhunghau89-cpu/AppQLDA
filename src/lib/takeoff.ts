// Bóc tách khối lượng — công thức + wrapper DB (wrapper cùng lý do với project-notes.ts).
import { db } from "@/lib/db";

export const BT_GROUPS: { value: string; label: string; dims: string[]; hint: string }[] = [
  { value: "FD", label: "Móng", dims: ["Dài L (m)", "Rộng B (m)", "Cao H (m)"], hint: "BT = L×B×H · VK = 2(L+B)×H" },
  { value: "CL", label: "Cột", dims: ["Rộng b (m)", "Cao tiết diện h (m)", "Chiều cao H (m)"], hint: "BT = b×h×H · VK = 2(b+h)×H" },
  { value: "FR", label: "Dầm, Giằng", dims: ["Rộng b (m)", "Cao h (m)", "Dài L (m)"], hint: "BT = b×h×L · VK = (b+2h)×L" },
  { value: "FL", label: "Sàn", dims: ["Dài L (m)", "Rộng B (m)", "Dày d (m)"], hint: "BT = L×B×d · VK = L×B" },
  { value: "WA", label: "Vách, Tường", dims: ["Dài L (m)", "Dày t (m)", "Cao H (m)"], hint: "BT = L×t×H · VK = 2×L×H" },
  { value: "LT", label: "Lanh tô", dims: ["Rộng b (m)", "Cao h (m)", "Dài L (m)"], hint: "BT = b×h×L · VK = (b+2h)×L" },
];
export const BT_GROUP_MAP = Object.fromEntries(BT_GROUPS.map((g) => [g.value, g]));

/** Tính BT (m³) và VK (m²) cho 1 cấu kiện theo nhóm — d1,d2,d3 theo thứ tự dims ở trên. */
export function computeConcrete(group: string, d1: number, d2: number, d3: number) {
  switch (group) {
    case "FD": return { concrete: d1 * d2 * d3, formwork: 2 * (d1 + d2) * d3 };
    case "CL": return { concrete: d1 * d2 * d3, formwork: 2 * (d1 + d2) * d3 };
    case "FR": return { concrete: d1 * d2 * d3, formwork: (d1 + 2 * d2) * d3 };
    case "FL": return { concrete: d1 * d2 * d3, formwork: d1 * d2 };
    case "WA": return { concrete: d1 * d2 * d3, formwork: 2 * d1 * d3 };
    case "LT": return { concrete: d1 * d2 * d3, formwork: (d1 + 2 * d2) * d3 };
    default: return { concrete: 0, formwork: 0 };
  }
}

/** Thép tổ hợp I hàn: 2 bản cánh wf×tf + bụng hw×tw (mm), dài L (m) → kg (γ=7850). */
export function computeBuiltUp(wf: number, tf: number, hw: number, tw: number, L: number) {
  return ((2 * wf * tf + hw * tw) * L * 7850) / 1e6;
}

/** Bản mã / thép tấm: w×l (mm) × t (mm) → kg. */
export function computePlate(w: number, l: number, t: number) {
  return (w * l * t * 7850) / 1e9;
}

export interface TakeoffRow {
  id: string;
  projectId: string;
  kind: string;
  group: string | null;
  code: string | null;
  name: string;
  spec: string | null;
  dims: string | null;
  qty: number;
  concrete: number | null;
  formwork: number | null;
  rebarRatio: number | null;
  rebar: number | null;
  steel: number | null;
  note: string | null;
  sortOrder: number;
}

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
