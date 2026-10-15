"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { guiThongBaoNhanh } from "./thongBaoNhanhActions";

type Nhom = "VAT_TU" | "TIEN_DO" | "THIET_KE" | "HOP_DONG" | "THANH_TOAN" | "KHAC";

/** Chủ đề nhập nhanh: bộ phận nhận mặc định + câu mẫu bấm là điền. */
const CHU_DE: { nhom: Nhom; ten: string; phong: Role[]; mau: string[] }[] = [
  {
    nhom: "VAT_TU",
    ten: "Điều chỉnh vật tư",
    phong: ["PROCUREMENT", "ENGINEERING"],
    mau: ["Điều chỉnh chủng loại/quy cách vật tư: ", "Bổ sung khối lượng vật tư: ", "Đổi nhà cung cấp: "],
  },
  {
    nhom: "TIEN_DO",
    ten: "Giục tiến độ",
    phong: ["ENGINEERING"],
    mau: ["Tiến độ đang chậm, đề nghị đẩy nhanh hạng mục: ", "Đề nghị báo cáo tiến độ thực tế trước ngày ", "CĐT yêu cầu hoàn thành sớm: "],
  },
  {
    nhom: "THIET_KE",
    ten: "Kiểm tra lại thiết kế",
    phong: ["ENGINEERING"],
    mau: ["Đề nghị kiểm tra lại quy cách thiết kế: ", "Bản vẽ chưa khớp hiện trạng tại: ", "CĐT yêu cầu điều chỉnh thiết kế: "],
  },
  {
    nhom: "HOP_DONG",
    ten: "Điều chỉnh hợp đồng",
    phong: ["ADMIN", "ACCOUNTING"],
    mau: ["Phát sinh ngoài hợp đồng: ", "Đề nghị lập phụ lục hợp đồng: "],
  },
  {
    nhom: "THANH_TOAN",
    ten: "Thanh toán",
    phong: ["ACCOUNTING"],
    mau: ["Đề nghị đôn đốc thu tiền đợt: ", "Đề nghị thanh toán cho NCC: "],
  },
  { nhom: "KHAC", ten: "Khác", phong: [], mau: [] },
];

export function ThongBaoNhanh({
  projectId,
  nguoiDung,
}: {
  projectId: string;
  nguoiDung: { id: string; name: string; role: string }[];
}) {
  const [mo, setMo] = useState(false);
  const [nhom, setNhom] = useState<Nhom>("VAT_TU");
  const [phong, setPhong] = useState<Role[]>(CHU_DE[0].phong);
  const [thanhVien, setThanhVien] = useState(true);
  const [nguoiIds, setNguoiIds] = useState<string[]>([]);
  const [canXuLy, setCanXuLy] = useState(true);
  const [noiDung, setNoiDung] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);
  const [dang, start] = useTransition();
  const cd = CHU_DE.find((c) => c.nhom === nhom)!;

  function chonChuDe(n: Nhom) {
    setNhom(n);
    setPhong(CHU_DE.find((c) => c.nhom === n)!.phong);
  }

  function gui() {
    setLoi(null);
    start(async () => {
      const r = await guiThongBaoNhanh(projectId, { nhom, canXuLy, phong, thanhVien, nguoiIds, noiDung });
      if (!r.ok) return setLoi(r.error);
      setXong(`Đã gửi tới ${r.soNguoi} người.`);
      setNoiDung("");
      setNguoiIds([]);
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setXong(null); setMo(true); }}>
        Thông báo nhanh
      </Button>
      <Modal
        open={mo}
        onClose={() => setMo(false)}
        title="Thông báo nhanh tới bộ phận"
        footer={
          <div className="flex items-center justify-end gap-2">
            {xong && <span className="mr-auto text-sm text-green-700">{xong}</span>}
            <Button variant="outline" onClick={() => setMo(false)}>Đóng</Button>
            <Button disabled={dang} onClick={gui}>Gửi</Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {CHU_DE.map((c) => (
              <button
                key={c.nhom}
                type="button"
                onClick={() => chonChuDe(c.nhom)}
                className={`rounded-full border px-3 py-1 ${
                  c.nhom === nhom ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"
                }`}
              >
                {c.ten}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-1 font-medium text-slate-700">Gửi tới bộ phận</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={phong.includes(r)}
                    onChange={(e) => setPhong(e.target.checked ? [...phong, r] : phong.filter((x) => x !== r))}
                  />
                  {ROLE_LABEL[r]}
                </label>
              ))}
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={thanhVien} onChange={(e) => setThanhVien(e.target.checked)} />
                Thành viên dự án
              </label>
            </div>
          </div>

          <div>
            <p className="mb-1 font-medium text-slate-700">Thêm người cụ thể</p>
            <select
              className="h-9 w-full rounded-md border border-slate-300 px-2"
              value=""
              onChange={(e) => e.target.value && setNguoiIds([...new Set([...nguoiIds, e.target.value])])}
            >
              <option value="">— Chọn người —</option>
              {nguoiDung.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {ROLE_LABEL[u.role as Role] ?? u.role}
                </option>
              ))}
            </select>
            {nguoiIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {nguoiIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNguoiIds(nguoiIds.filter((x) => x !== id))}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    title="Bỏ"
                  >
                    {nguoiDung.find((u) => u.id === id)?.name ?? id} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {cd.mau.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {cd.mau.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNoiDung(noiDung ? `${noiDung}\n${m}` : m)}
                    className="rounded border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {m.replace(/:\s*$/, "")}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={noiDung}
              onChange={(e) => setNoiDung(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Nội dung thông báo"
              className="w-full rounded-md border border-slate-300 p-2"
            />
            <label className="mt-1 flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={canXuLy} onChange={(e) => setCanXuLy(e.target.checked)} />
              Cần người nhận xử lý (đánh dấu nổi bật trong hộp thư)
            </label>
          </div>
          {loi && <p className="text-red-600">{loi}</p>}
        </div>
      </Modal>
    </>
  );
}
