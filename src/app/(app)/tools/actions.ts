"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  takeoffDb, computeConcrete, computeBuiltUp, computePlate, BT_GROUP_MAP,
} from "@/lib/takeoff";
import { STEEL_SECTIONS } from "@/lib/steel-data";

export type ActionResult = { ok: true } | { ok: false; error: string };

const EDIT_ROLES = ["ADMIN", "ENGINEERING", "PROCUREMENT"];

async function requireEditor() {
  const session = await requireSession();
  if (!EDIT_ROLES.includes(session.role)) {
    throw new Error("Chỉ Ban giám đốc, Kỹ thuật, Vật tư được sửa bảng bóc khối lượng.");
  }
  return session;
}

function n(v: FormDataEntryValue | null): number {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

export async function addTakeoffItem(projectId: string, form: FormData): Promise<ActionResult> {
  try {
    await requireEditor();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không có quyền." };
  }
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return { ok: false, error: "Chưa chọn dự án hợp lệ." };

  const kind = String(form.get("kind") ?? "");
  const code = String(form.get("code") ?? "").trim() || null;
  const note = String(form.get("note") ?? "").trim() || null;
  const qty = Math.max(1, n(form.get("qty")) || 1);

  if (kind === "BT") {
    const group = String(form.get("group") ?? "");
    const g = BT_GROUP_MAP[group];
    if (!g) return { ok: false, error: "Chọn loại cấu kiện." };
    const d1 = n(form.get("d1")), d2 = n(form.get("d2")), d3 = n(form.get("d3"));
    if (d1 <= 0 || d2 <= 0 || d3 <= 0) return { ok: false, error: "Nhập đủ 3 kích thước (m)." };
    const rebarRatio = n(form.get("rebarRatio")) || null;
    const one = computeConcrete(group, d1, d2, d3);
    const concrete = one.concrete * qty;
    const formwork = one.formwork * qty;
    await takeoffDb.create({
      data: {
        projectId, kind, group, code,
        name: `${g.label} ${code ?? ""}`.trim(),
        spec: null,
        dims: JSON.stringify({ d1, d2, d3 }),
        qty, concrete, formwork,
        rebarRatio, rebar: rebarRatio ? concrete * rebarRatio : null,
        steel: null, note,
      },
    });
  } else if (kind === "THEP_HINH") {
    const spec = String(form.get("spec") ?? "");
    const sec = STEEL_SECTIONS.find((x) => x.name === spec);
    if (!sec) return { ok: false, error: "Chọn mã thép trong bảng tra." };
    const L = n(form.get("len"));
    if (L <= 0) return { ok: false, error: "Nhập chiều dài (m)." };
    await takeoffDb.create({
      data: {
        projectId, kind, group: null, code,
        name: `Thép hình ${sec.name}`,
        spec: sec.name,
        dims: JSON.stringify({ len: L, wPerM: sec.wPerM }),
        qty, concrete: null, formwork: null, rebarRatio: null, rebar: null,
        steel: sec.wPerM * L * qty, note,
      },
    });
  } else if (kind === "TO_HOP") {
    const wf = n(form.get("wf")), tf = n(form.get("tf"));
    const hw = n(form.get("hw")), tw = n(form.get("tw"));
    const L = n(form.get("len"));
    if (wf <= 0 || tf <= 0 || hw <= 0 || tw <= 0 || L <= 0) {
      return { ok: false, error: "Nhập đủ: cánh wf×tf, bụng hw×tw (mm) và dài L (m)." };
    }
    await takeoffDb.create({
      data: {
        projectId, kind, group: null, code,
        name: `Tổ hợp I ${hw + 2 * tf}×${wf} (cánh ${wf}×${tf}, bụng ${hw}×${tw})`,
        spec: `2x(${wf}x${tf}) + ${hw}x${tw}`,
        dims: JSON.stringify({ wf, tf, hw, tw, len: L }),
        qty, concrete: null, formwork: null, rebarRatio: null, rebar: null,
        steel: computeBuiltUp(wf, tf, hw, tw, L) * qty, note,
      },
    });
  } else if (kind === "BAN_MA") {
    const w = n(form.get("w")), l = n(form.get("l")), t = n(form.get("t"));
    if (w <= 0 || l <= 0 || t <= 0) return { ok: false, error: "Nhập rộng × dài × dày (mm)." };
    await takeoffDb.create({
      data: {
        projectId, kind, group: null, code,
        name: `Bản mã ${w}×${l}×${t}`,
        spec: `${w}x${l}x${t}mm`,
        dims: JSON.stringify({ w, l, t }),
        qty, concrete: null, formwork: null, rebarRatio: null, rebar: null,
        steel: computePlate(w, l, t) * qty, note,
      },
    });
  } else {
    return { ok: false, error: "Loại cấu kiện không hợp lệ." };
  }
  revalidatePath("/tools");
  return { ok: true };
}

export async function deleteTakeoffItem(id: string): Promise<ActionResult> {
  try {
    await requireEditor();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không có quyền." };
  }
  await takeoffDb.delete({ where: { id } });
  revalidatePath("/tools");
  return { ok: true };
}
