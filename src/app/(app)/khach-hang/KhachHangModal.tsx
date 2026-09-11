"use client";

import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../projects/[id]/quote/ModalActions";
import { KHACH_NGUON } from "@/lib/constants";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { saveKhachHang } from "./actions";
import type { KhachHangRow, NhanVien } from "./KhachHangManager";

export function KhachHangModal({
  editing,
  nhanVien,
  laAdmin,
  onClose,
  onDone,
}: {
  editing: KhachHangRow | null;
  nhanVien: NhanVien[];
  /** Chỉ quản trị viên mới gán khách cho người khác. */
  laAdmin: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveKhachHang(editing?.id ?? null, form));
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Sửa khách hàng" : "Thêm khách hàng"}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Tên khách / công ty *">
          <Input
            name="tenCty"
            defaultValue={editing?.tenCty ?? ""}
            required
            placeholder="Công ty CP ABC — hoặc tên người nếu mới chỉ biết tới đó"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Người liên hệ">
            <Input name="nguoiLienHe" defaultValue={editing?.nguoiLienHe ?? ""} />
          </Field>
          <Field label="Điện thoại">
            <Input name="phone" defaultValue={editing?.phone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={editing?.email ?? ""} />
          </Field>
        </div>

        <Field label="Địa chỉ">
          <Input name="diaChi" defaultValue={editing?.diaChi ?? ""} />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nguồn khách">
            <Select name="nguon" defaultValue={editing?.nguon ?? ""}>
              <option value="">— Chưa rõ —</option>
              {KHACH_NGUON.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </Select>
          </Field>

          {laAdmin ? (
            <Field label="Người phụ trách">
              <Select name="ownerId" defaultValue={editing?.ownerId ?? ""}>
                <option value="">— Chưa phân công —</option>
                {nhanVien.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {ROLE_LABEL[u.role as Role] ?? u.role}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Người phụ trách">
              <Input value={editing?.ownerName ?? "Bạn"} disabled readOnly />
            </Field>
          )}
        </div>

        <Field label="Ghi chú">
          <Textarea name="note" rows={2} defaultValue={editing?.note ?? ""} />
        </Field>

        {!laAdmin && (
          <p className="text-xs text-slate-400">
            Khách bạn tạo sẽ do chính bạn phụ trách. Cần đổi người thì nhờ quản trị viên.
          </p>
        )}

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
