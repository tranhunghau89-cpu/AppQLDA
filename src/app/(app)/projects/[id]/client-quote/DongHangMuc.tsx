"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tr, Td } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { lineAmount } from "@/lib/clientQuote";
import { VAT_TU_TAG_MAP } from "@/lib/constants";
import { formatNumber, formatQty, formatVND, parseViNumber } from "@/lib/utils";
import { luuOHangMuc } from "./actions";
import type { LineView } from "./types";
import { NhanLai } from "./GiaVonPanel";
import type { ChuBaoGia } from "@/lib/quoteOwner";

/** Năm ô có mặt trên bảng. Mọi thứ còn lại của một dòng vẫn sửa trong hộp thoại. */
interface OBang {
  name: string;
  unit: string;
  qty: string;
  unitPrice: string;
  amount: string;
}

const O_BANG = ["name", "unit", "qty", "unitPrice", "amount"] as const;

/**
 * Ô số là ô CHỮ, không phải `<input type="number">`.
 *
 * Đơn giá viết liền "1104000" rất dễ đọc nhầm một chữ số trên văn bản gửi khách, mà ô
 * số của trình duyệt thì không cho chèn dấu phân cách. Ở đây nhận cả "1104000" lẫn
 * "1.104.000" (parseViNumber), và mỗi lần rời hàng thì viết lại cho có dấu chấm.
 */
const so = (v: string) => parseViNumber(v);

/** Tiền: 1104000 -> "1.104.000". Rỗng vẫn là rỗng, không phải "—". */
const hienTien = (n: number | null) => (n == null ? "" : formatNumber(n));

/** Khối lượng: giữ tối đa 2 số lẻ, 15.6 -> "15,6". */
const hienKhoiLuong = (n: number | null) => (n == null ? "" : formatQty(n));

const NHAN_SO = { qty: "Khối lượng", unitPrice: "Đơn giá", amount: "Thành tiền" } as const;

/**
 * Ô số nào gõ vào mà không ra số. Trả nhãn của ô đó, hoặc null khi mọi ô đều đọc được.
 *
 * Không có phép kiểm này thì `chuanHoa` lặng lẽ biến "1.104.00o" thành ô trống, và
 * dòng đó đi thẳng vào bản in với đơn giá rỗng.
 */
function oSoHong(o: OBang): string | null {
  for (const k of ["qty", "unitPrice", "amount"] as const) {
    if (o[k].trim() !== "" && so(o[k]) == null) return NHAN_SO[k];
  }
  return null;
}

/** Dạng hiển thị chuẩn của năm ô — dùng cả lúc nạp lẫn lúc vừa lưu xong. */
function chuanHoa(o: OBang): OBang {
  return {
    ...o,
    qty: hienKhoiLuong(so(o.qty)),
    unitPrice: hienTien(so(o.unitPrice)),
    amount: hienTien(so(o.amount)),
  };
}

const O_NHAP =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm " +
  "placeholder:text-slate-300 hover:border-slate-200 focus:border-blue-500 " +
  "focus:bg-white focus:outline-none";

/** Ô số gõ sai thì đỏ ngay tại chỗ — thông báo nổi lên rồi tắt, ô thì vẫn còn đó. */
const O_HONG = " border-red-400 bg-red-50";

const oNhapSo = (hong: boolean) =>
  O_NHAP + " text-right tabular-nums" + (hong ? O_HONG : "");

/**
 * FormData gửi lên: ô số đi dạng SỐ THÔ, không mang dấu chấm phân cách.
 * "1.104.000" mà gửi nguyên thì zod đọc ra 1.104 — sai gấp nghìn lần.
 */
function duLieu(o: OBang): FormData {
  const f = new FormData();
  f.set("name", o.name);
  f.set("unit", o.unit);
  for (const k of ["qty", "unitPrice", "amount"] as const) {
    const n = so(o[k]);
    f.set(k, n == null ? "" : String(n));
  }
  return f;
}

/**
 * Con trỏ có còn nằm trong hàng không.
 *
 * Tab từ ô này sang ô kia TRONG cùng một hàng cũng bắn `focusout`. Không kiểm thì mỗi
 * lần Tab là một lượt ghi xuống máy chủ, mà nội dung thì chưa gõ xong.
 */
function conTrongHang(e: React.FocusEvent<HTMLElement>): boolean {
  return e.currentTarget.contains(e.relatedTarget as Node | null);
}

export function DongHangMuc({
  chu,
  quoteId,
  l,
  moTa,
  giaVonM2,
  canEdit,
  onSua,
  onXoa,
  onBoDeGia,
}: {
  chu: ChuBaoGia;
  quoteId: string;
  l: LineView;
  /** Mô tả ghép sẵn từ câu chung + vật tư đã gắn; chỉ để hiện, sửa ở hộp thoại. */
  moTa: string;
  /** Đơn giá vốn trên m² của phần đã sinh ra dòng này; null = chưa suy được. */
  giaVonM2?: number | null;
  canEdit: boolean;
  onSua: () => void;
  onXoa: () => void;
  onBoDeGia: () => void;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  // Chỉ giữ ô người dùng ĐÃ GÕ; còn lại luôn đọc từ máy chủ. Xem chú thích cùng kiểu
  // ở ThongTinIn: mỗi lần lưu, server action tự làm mới cây trang.
  const [nhap, setNhap] = useState<Partial<OBang>>({});
  const [vuaChot, setVuaChot] = useState(false);
  const daLuu = useRef<OBang | null>(null);

  const goc: OBang = {
    name: l.name,
    unit: l.unit ?? "",
    qty: hienKhoiLuong(l.qty),
    unitPrice: hienTien(l.unitPrice),
    amount: hienTien(l.amount),
  };
  const v: OBang = { ...goc, ...nhap };

  const khoan = v.amount.trim() !== "";
  const hong = oSoHong(v);
  const thanhTien = lineAmount({
    qty: so(v.qty),
    unitPrice: so(v.unitPrice),
    amount: khoan ? so(v.amount) : null,
  });

  function roiHang(e: React.FocusEvent<HTMLTableRowElement>) {
    if (!canEdit || conTrongHang(e)) return;
    const truoc = daLuu.current ?? goc;
    if (O_BANG.every((k) => v[k] === truoc[k])) return;
    if (!v.name.trim()) {
      toast.error("Nội dung công việc không được để trống.");
      return;
    }
    const hong = oSoHong(v);
    if (hong) {
      toast.error(`${hong} không phải là số.`);
      return;
    }

    const gui = chuanHoa(v);
    daLuu.current = gui;
    // Viết lại ngay các ô số cho có dấu chấm, để lần rời hàng sau không thấy "khác"
    // rồi lưu lại y hệt một lần nữa.
    setNhap(gui);
    start(async () => {
      const res = await luuOHangMuc(chu, quoteId, l.id, duLieu(gui));
      if (!res.ok) {
        daLuu.current = truoc;
        setNhap(truoc);
        toast.error(res.error);
      }
    });
  }

  const oSo = (k: "qty" | "unitPrice") => (
    <input
      aria-label={k === "qty" ? `Khối lượng — ${l.name}` : `Đơn giá — ${l.name}`}
      inputMode="decimal"
      value={v[k]}
      onChange={(e) => setNhap((p) => ({ ...p, [k]: e.target.value }))}
      className={oNhapSo(v[k].trim() !== "" && so(v[k]) == null)}
    />
  );

  if (!canEdit) return <DongChiDoc l={l} moTa={moTa} thanhTien={thanhTien} />;

  return (
    <Tr onBlur={roiHang}>
      <Td className="text-slate-500">{l.code ?? "—"}</Td>

      <Td className="text-slate-900">
        <div className="flex items-center gap-2">
          <input
            aria-label="Nội dung công việc"
            value={v.name}
            onChange={(e) => setNhap((p) => ({ ...p, name: e.target.value }))}
            className={O_NHAP + " font-medium"}
          />
          {l.priceOverridden && (
            <Badge tone="amber" title="Đơn giá đã sửa tay">
              đè giá
            </Badge>
          )}
          {/* Lãi của riêng hạng mục này — nhìn lướt biết chỗ nào mỏng. Chi tiết giá
              vốn nằm ở bảng "Giá vốn theo hạng mục" dưới bảng báo giá. */}
          <span title="Lãi của hạng mục này so với giá vốn">
            <NhanLai von={giaVonM2 ?? null} ban={l.unitPrice} />
          </span>
        </div>
        {moTa && <div className="whitespace-pre-line px-1.5 text-xs text-slate-400">{moTa}</div>}
        {l.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1 px-1.5">
            {l.tags.map((t) => (
              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {VAT_TU_TAG_MAP[t]?.label ?? t}
              </span>
            ))}
          </div>
        )}
        {l.note && <div className="px-1.5 text-xs text-slate-400">{l.note}</div>}
      </Td>

      <Td className="px-1">
        <input
          aria-label={`Đơn vị — ${l.name}`}
          value={v.unit}
          onChange={(e) => setNhap((p) => ({ ...p, unit: e.target.value }))}
          className={O_NHAP}
        />
      </Td>
      <Td className="px-1">{oSo("qty")}</Td>
      <Td className="px-1">{oSo("unitPrice")}</Td>

      <Td className="px-1 text-right">
        {khoan ? (
          <div className="flex items-center justify-end gap-1">
            <input
              aria-label={`Thành tiền khoán — ${l.name}`}
              inputMode="decimal"
              autoFocus={vuaChot}
              value={v.amount}
              onChange={(e) => setNhap((p) => ({ ...p, amount: e.target.value }))}
              className={oNhapSo(so(v.amount) == null) + " font-medium"}
            />
            <button
              type="button"
              title="Bỏ khoán — quay về khối lượng × đơn giá"
              aria-label={`Bỏ khoán — ${l.name}`}
              onClick={() => setNhap((p) => ({ ...p, amount: "" }))}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          // Gõ đè lên thành tiền CHÍNH LÀ chốt cứng — dòng khoán kiểu "Cửa đẩy chớp
          // (6 cái)". Không cần thêm một dấu tích riêng để nói điều đó.
          <button
            type="button"
            title="Bấm để chốt cứng thành tiền (dòng khoán)"
            onClick={() => {
              setVuaChot(true);
              setNhap((p) => ({ ...p, amount: hienTien(thanhTien) }));
            }}
            className="w-full rounded px-1.5 py-1 text-right font-medium tabular-nums text-slate-700 hover:bg-slate-100"
          >
            {/* Ô số đang hỏng thì `so()` trả null và thành tiền ra 0 — in "0 đ" lên đó
                là nói dối; để dấu gạch cho tới khi ô kia gõ lại cho đúng. */}
            {hong ? "—" : formatVND(thanhTien)}
          </button>
        )}
      </Td>

      <Td className="text-right">
        <div className="flex justify-end gap-1">
          {l.priceOverridden && (
            <Button variant="ghost" size="icon" title="Bỏ đè giá" aria-label="Bỏ đè giá" onClick={onBoDeGia}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sửa hạng mục"
            title="Vật tư, mô tả, ghi chú, xếp phần"
            onClick={onSua}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-600 hover:bg-red-50"
            aria-label="Xóa hạng mục"
            onClick={onXoa}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Td>
    </Tr>
  );
}

/** Bản chỉ đọc cho người không có quyền sửa — cùng bố cục, không có ô nhập. */
function DongChiDoc({
  l,
  moTa,
  thanhTien,
}: {
  l: LineView;
  moTa: string;
  thanhTien: number;
}) {
  return (
    <Tr>
      <Td className="text-slate-500">{l.code ?? "—"}</Td>
      <Td className="text-slate-900">
        <span>{l.name}</span>
        {moTa && <div className="whitespace-pre-line text-xs text-slate-400">{moTa}</div>}
        {l.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {l.tags.map((t) => (
              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {VAT_TU_TAG_MAP[t]?.label ?? t}
              </span>
            ))}
          </div>
        )}
        {l.note && <div className="text-xs text-slate-400">{l.note}</div>}
      </Td>
      <Td className="text-slate-600">{l.unit ?? "—"}</Td>
      <Td className="text-right tabular-nums">{l.qty ?? "—"}</Td>
      <Td className="text-right tabular-nums">{l.unitPrice ?? "—"}</Td>
      <Td className="text-right font-medium">{formatVND(thanhTien)}</Td>
    </Tr>
  );
}

/**
 * Hàng trắng thường trực ở cuối mỗi phần.
 *
 * Gõ vào là thành hạng mục mới, Enter đẩy xuống hàng trắng kế tiếp — người lập dự toán
 * đang chép một danh sách xuống, không có lý do gì bắt họ mở rồi đóng hộp thoại cho
 * từng dòng.
 */
export function DongMoi({
  chu,
  quoteId,
  partCode,
  partName,
}: {
  chu: ChuBaoGia;
  quoteId: string;
  partCode: string;
  partName: string;
}) {
  const toast = useToast();
  const [dangLuu, start] = useTransition();
  const [v, setV] = useState<OBang>({ name: "", unit: "m2", qty: "", unitPrice: "", amount: "" });
  const oTen = useRef<HTMLInputElement>(null);

  const thanhTien = lineAmount({ qty: so(v.qty), unitPrice: so(v.unitPrice), amount: null });
  const coGi = v.name.trim() !== "";

  function tao(rangBuoc: boolean) {
    if (!coGi) {
      // Rời hàng mà chưa gõ gì thì im lặng — chỉ báo lỗi khi người dùng chủ động Enter.
      if (rangBuoc) toast.error("Nội dung công việc không được để trống.");
      return;
    }
    const hong = oSoHong(v);
    if (hong) {
      toast.error(`${hong} không phải là số.`);
      return;
    }

    const gui = { ...v };
    setV({ name: "", unit: gui.unit, qty: "", unitPrice: "", amount: "" });
    start(async () => {
      const form = duLieu(gui);
      form.set("partCode", partCode);
      form.set("partName", partName);
      const res = await luuOHangMuc(chu, quoteId, null, form);
      if (!res.ok) {
        // Trả lại đúng thứ vừa gõ để người dùng không phải nhớ lại mà gõ từ đầu.
        setV(gui);
        toast.error(res.error);
      }
    });
  }

  return (
    <Tr
      className="bg-slate-50/40"
      onBlur={(e) => {
        if (conTrongHang(e)) return;
        tao(false);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        tao(true);
        oTen.current?.focus();
      }}
    >
      <Td className="text-slate-300">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </Td>
      <Td>
        <input
          ref={oTen}
          aria-label={`Hạng mục mới trong ${partName}`}
          value={v.name}
          disabled={dangLuu}
          placeholder="Thêm hạng mục — gõ rồi nhấn Enter"
          onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
          className={O_NHAP}
        />
      </Td>
      <Td className="px-1">
        <input
          aria-label="Đơn vị của hạng mục mới"
          value={v.unit}
          disabled={dangLuu}
          onChange={(e) => setV((p) => ({ ...p, unit: e.target.value }))}
          className={O_NHAP}
        />
      </Td>
      <Td className="px-1">
        <input
          aria-label="Khối lượng của hạng mục mới"
          inputMode="decimal"
          value={v.qty}
          disabled={dangLuu}
          onChange={(e) => setV((p) => ({ ...p, qty: e.target.value }))}
          className={oNhapSo(v.qty.trim() !== "" && so(v.qty) == null)}
        />
      </Td>
      <Td className="px-1">
        <input
          aria-label="Đơn giá của hạng mục mới"
          inputMode="decimal"
          value={v.unitPrice}
          disabled={dangLuu}
          onChange={(e) => setV((p) => ({ ...p, unitPrice: e.target.value }))}
          className={oNhapSo(v.unitPrice.trim() !== "" && so(v.unitPrice) == null)}
        />
      </Td>
      <Td className="text-right tabular-nums text-slate-400">
        {coGi && !oSoHong(v) ? formatVND(thanhTien) : "—"}
      </Td>
      <Td />
    </Tr>
  );
}
