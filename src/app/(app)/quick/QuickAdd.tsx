"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ESTIMATE_GROUP, PO_CATEGORY } from "@/lib/constants";
import { quickNote, quickPayment, quickEstimate, quickPurchase } from "./actions";

export interface QuickProject {
  id: string;
  code: string;
  name: string;
}
export interface QuickSupplier {
  id: string;
  name: string;
}
export type QuickType = "note" | "purchase" | "payment" | "estimate";

const TYPE_LABEL: Record<QuickType, string> = {
  note: "Tiến độ / nhật ký",
  purchase: "Đơn hàng / vật tư",
  payment: "Chi phí / thanh toán",
  estimate: "Dự toán / khối lượng",
};

export function QuickAdd({
  projects,
  allowed,
  suppliers,
}: {
  projects: QuickProject[];
  allowed: QuickType[];
  suppliers: QuickSupplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects.length === 1 ? projects[0].id : "");
  const [type, setType] = useState<QuickType>(allowed[0] ?? "note");
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [pending, start] = useTransition();

  const canOpen = projects.length > 0 && allowed.length > 0;

  function run(build: () => FormData, action: (pid: string, f: FormData) => Promise<{ ok: boolean; error?: string }>, reset: () => void) {
    if (!projectId) {
      setError("Chọn dự án trước.");
      return;
    }
    setError(null);
    const fd = build();
    start(async () => {
      const res = await action(projectId, fd);
      if (!res.ok) setError(res.error ?? "Có lỗi xảy ra.");
      else {
        setSavedCount((c) => c + 1);
        reset();
        router.refresh();
      }
    });
  }

  if (!canOpen) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-blue-600 px-5 text-white shadow-lg hover:bg-blue-700 sm:bottom-6 sm:right-6"
      >
        <Plus className="h-5 w-5" />
        <span className="font-medium">Nhập nhanh</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nhập nhanh">
        <div className="space-y-4">
          {projects.length > 1 && (
            <Field label="Dự án *">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— Chọn dự án —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="flex flex-wrap gap-2">
            {allowed.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setError(null);
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  type === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {type === "note" && <NoteForm onSubmit={(b, r) => run(b, quickNote, r)} pending={pending} />}
          {type === "purchase" && (
            <PurchaseForm suppliers={suppliers} onSubmit={(b, r) => run(b, quickPurchase, r)} pending={pending} />
          )}
          {type === "payment" && <PaymentForm onSubmit={(b, r) => run(b, quickPayment, r)} pending={pending} />}
          {type === "estimate" && <EstimateForm onSubmit={(b, r) => run(b, quickEstimate, r)} pending={pending} />}

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {savedCount > 0 && !error && (
            <p className="text-sm text-green-600">✓ Đã lưu {savedCount} mục trong phiên này. Nhập tiếp hoặc đóng.</p>
          )}
        </div>
      </Modal>
    </>
  );
}

type SubmitFn = (build: () => FormData, reset: () => void) => void;

function NoteForm({ onSubmit, pending }: { onSubmit: SubmitFn; pending: boolean }) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div className="space-y-3">
      <Field label="Ghi chú / nội dung *">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="VD: Đã lắp xong khung trục 1–5…" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <Camera className="h-4 w-4" /> Chụp / thêm ảnh
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 5))}
          />
        </label>
        {files.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs">
            {f.name.slice(0, 16)}
            <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Button
        disabled={pending || !content.trim()}
        onClick={() =>
          onSubmit(
            () => {
              const fd = new FormData();
              fd.set("content", content);
              files.forEach((f) => fd.append("images", f));
              return fd;
            },
            () => {
              setContent("");
              setFiles([]);
            }
          )
        }
      >
        {pending ? "Đang lưu…" : "Lưu tiến độ"}
      </Button>
    </div>
  );
}

function PurchaseForm({ suppliers, onSubmit, pending }: { suppliers: QuickSupplier[]; onSubmit: SubmitFn; pending: boolean }) {
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState(PO_CATEGORY[0]?.value ?? "KHAC");
  const [rows, setRows] = useState([{ name: "", unit: "", qty: "", price: "" }]);
  const update = (i: number, k: string, v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const valid = rows.some((r) => r.name.trim());
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nhà cung cấp">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— Chọn —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Loại">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {PO_CATEGORY.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input className="col-span-5" placeholder="Tên vật tư" value={r.name} onChange={(e) => update(i, "name", e.target.value)} />
            <Input className="col-span-2" placeholder="ĐV" value={r.unit} onChange={(e) => update(i, "unit", e.target.value)} />
            <Input className="col-span-2" placeholder="SL" value={r.qty} onChange={(e) => update(i, "qty", e.target.value)} />
            <Input className="col-span-3" placeholder="Đơn giá" value={r.price} onChange={(e) => update(i, "price", e.target.value)} />
          </div>
        ))}
        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setRows((r) => [...r, { name: "", unit: "", qty: "", price: "" }])}>
          ＋ Thêm dòng
        </button>
      </div>
      <Button
        disabled={pending || !valid}
        onClick={() =>
          onSubmit(
            () => {
              const fd = new FormData();
              fd.set("supplierId", supplierId);
              fd.set("category", category);
              rows.forEach((r) => {
                if (!r.name.trim()) return;
                fd.append("itemName", r.name);
                fd.append("itemUnit", r.unit);
                fd.append("itemQty", r.qty);
                fd.append("itemPrice", r.price);
              });
              return fd;
            },
            () => setRows([{ name: "", unit: "", qty: "", price: "" }])
          )
        }
      >
        {pending ? "Đang lưu…" : "Lưu đơn hàng"}
      </Button>
    </div>
  );
}

function PaymentForm({ onSubmit, pending }: { onSubmit: SubmitFn; pending: boolean }) {
  const [direction, setDirection] = useState("THU");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Loại">
          <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="THU">Thu (khách trả)</option>
            <option value="CHI">Chi (trả NCC)</option>
          </Select>
        </Field>
        <Field label="Số tiền">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="VD: 100000000" />
        </Field>
      </div>
      <Field label="Tên đợt *">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tạm ứng, Đợt 1, Quyết toán…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hạn (tùy chọn)">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="CĐT / NCC">
          <Input value={counterpart} onChange={(e) => setCounterpart(e.target.value)} />
        </Field>
      </div>
      <Field label="Ghi chú">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button
        disabled={pending || !name.trim()}
        onClick={() =>
          onSubmit(
            () => {
              const fd = new FormData();
              fd.set("direction", direction);
              fd.set("name", name);
              fd.set("amount", amount);
              fd.set("dueDate", dueDate);
              fd.set("counterpart", counterpart);
              fd.set("note", note);
              return fd;
            },
            () => {
              setName("");
              setAmount("");
              setDueDate("");
              setNote("");
            }
          )
        }
      >
        {pending ? "Đang lưu…" : "Lưu thanh toán"}
      </Button>
    </div>
  );
}

function EstimateForm({ onSubmit, pending }: { onSubmit: SubmitFn; pending: boolean }) {
  const [groupCode, setGroupCode] = useState(ESTIMATE_GROUP[0]?.value ?? "");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const amount = useMemo(() => {
    const q = Number(qty.replace(/[.,\s]/g, ""));
    const p = Number(price.replace(/[.,\s]/g, ""));
    return Number.isFinite(q) && Number.isFinite(p) && qty && price ? q * p : null;
  }, [qty, price]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nhóm">
          <Select value={groupCode} onChange={(e) => setGroupCode(e.target.value)}>
            {ESTIMATE_GROUP.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Đơn vị">
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, m², tấn…" />
        </Field>
      </div>
      <Field label="Hạng mục *">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên hạng mục" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Khối lượng">
          <Input value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Đơn giá">
          <Input value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      {amount != null && <p className="text-sm text-slate-500">Thành tiền: {amount.toLocaleString("vi")} ₫</p>}
      <Button
        disabled={pending || !name.trim()}
        onClick={() =>
          onSubmit(
            () => {
              const fd = new FormData();
              fd.set("groupCode", groupCode);
              fd.set("name", name);
              fd.set("unit", unit);
              fd.set("designQty", qty);
              fd.set("unitPrice", price);
              fd.set("amount", amount != null ? String(amount) : "");
              return fd;
            },
            () => {
              setName("");
              setQty("");
              setPrice("");
            }
          )
        }
      >
        {pending ? "Đang lưu…" : "Lưu dự toán"}
      </Button>
    </div>
  );
}
