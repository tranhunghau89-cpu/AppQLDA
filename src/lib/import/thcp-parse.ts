// Bóc tách file Tổng hợp chi phí (quyết toán thực tế) — phần THUẦN, không chạm DB
// và không "server-only", nên chạy được cả trong test lẫn script kiểm tra ngoài Next.
// Phần đọc file + ghi DB nằm ở thcp.ts.
//
// Dữ liệu thật có HAI dạng file khác hẳn nhau, cùng nằm chung một thư mục:
//
//   1. "Quyết toán"   — bảng tổng hợp hạng mục A–K, có NCC / giá trị / thanh toán /
//                       hóa đơn, kèm phần "Chi tiết chi phí" bên dưới.
//   2. "Sổ giá thành" — sổ kế toán, chỉ có danh sách chi phí phát sinh và doanh thu.
//                       Không có mã hạng mục, phải suy ra nhóm từ cột tiền.
//
// `laSoGiaThanh()` phân biệt hai dạng; chọn nhầm thì bóc ra rỗng chứ không báo lỗi,
// nên đây là chỗ đáng test nhất.
import { norm, num, text, type SheetLike } from "./cells";

/** Mã hạng mục A–K trong file quyết toán -> nhóm chi phí + nhãn mặc định. */
export const HANG_MUC: Record<string, { group: string; label: string }> = {
  A: { group: "KCT", label: "Kết cấu thép" },
  B: { group: "XA_GO", label: "Xà gồ" },
  C: { group: "TON", label: "Tôn - Diềm" },
  D: { group: "BL_NEO", label: "Bulong neo" },
  E: { group: "BLLK", label: "BLLK" },
  F: { group: "VT_PHU", label: "Vật tư phụ" },
  G: { group: "NHAN_CONG", label: "Lắp dựng" },
  H: { group: "VAN_CHUYEN", label: "Vận chuyển" },
  I: { group: "MAY", label: "Máy" },
  K: { group: "KHAC", label: "Khác" },
};

export interface NhomChiPhi {
  code: string;
  name: string;
  supplier: string | null;
  value: number | null;
  payment: number | null;
  invoice: number | null;
}

export interface DongChiPhi {
  cat: string;
  name: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  ref: string | null;
  note: string | null;
}

export interface TaiChinh {
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  extraVat: number | null;
  paid: number | null;
  collected: number | null;
  receivable: number | null;
  collectionNote: string | null;
}

export interface KetQuaThcp {
  dang: "quyet-toan" | "so-gia-thanh";
  dims: string;
  location: string;
  customer: string;
  fin: TaiChinh;
  nhom: NhomChiPhi[];
  dong: DongChiPhi[];
  canhBao: string[];
}

// ---------- Nhận dạng kích thước ----------

/** Rút "K25L60" từ một chuỗi bất kỳ (tìm ở giữa chuỗi, khác `dims()` ở cells.ts). */
export function loiKichThuoc(s: string): string | null {
  const m = s.match(/K\s*(\d+)\s*L\s*(\d+)/i);
  return m ? `K${m[1]}L${m[2]}` : null;
}

/** Như trên nhưng nhận thêm dạng "20x50" — sổ giá thành hay ghi kiểu này. */
export function loiKichThuocRong(s: string): string | null {
  const m = s.match(/K\s*(\d+)\s*L\s*(\d+)/i) || s.match(/(\d+)\s*[xX]\s*(\d+)/);
  return m ? `K${m[1]}L${m[2]}` : null;
}

/** Tách K và L thành số để ghi vào Project.kK / Project.kL. */
export function soKichThuoc(s: string): { k: number | null; l: number | null } {
  const m = s.match(/K\s*(\d+)\s*L\s*(\d+)/i);
  return m ? { k: Number(m[1]), l: Number(m[2]) } : { k: null, l: null };
}

// ---------- Phân biệt hai dạng file ----------

/** File dạng "SỔ GIÁ THÀNH XÂY DỰNG" — tiêu đề nằm đâu đó trong 8 dòng đầu. */
export function laSoGiaThanh(ws: SheetLike): boolean {
  for (let r = 1; r <= 8; r++) {
    for (let c = 1; c <= 8; c++) {
      if (norm(ws.getCell(r, c).value).includes("sogiathanh")) return true;
    }
  }
  return false;
}

/** Số nằm bên phải nhất trong khoảng cột — cột "Thành tiền" đổi chỗ tùy file. */
function soPhaiNhat(ws: SheetLike, r: number, from: number, to: number): number | null {
  let v: number | null = null;
  for (let c = from; c <= to; c++) {
    const n = num(ws.getCell(r, c).value);
    if (n != null) v = n;
  }
  return v;
}

/**
 * Số có trị tuyệt đối lớn nhất trong khoảng cột.
 *
 * Dòng Doanh thu / LNTT thường có một ô tỷ lệ % nhỏ nằm ngay cạnh ô tiền; lấy "ô
 * cuối cùng" sẽ vớ phải số % đó, nên ở đây lấy theo độ lớn.
 */
function soLonNhat(ws: SheetLike, r: number, from: number, to: number): number | null {
  let v: number | null = null;
  let best = -1;
  for (let c = from; c <= to; c++) {
    const n = num(ws.getCell(r, c).value);
    if (n != null && Math.abs(n) > best) {
      best = Math.abs(n);
      v = n;
    }
  }
  return v;
}

// ---------- Dạng 1: quyết toán ----------

function bocQuyetToan(ws: SheetLike, tenFile: string): KetQuaThcp {
  const C = (r: number, c: number) => ws.getCell(r, c).value;
  const canhBao: string[] = [];

  // Thông tin dự án nằm rải rác ở 8 dòng đầu, nhãn ở cột B.
  let dims = "";
  let location = "";
  let customer = "";
  for (let r = 1; r <= 8; r++) {
    const b = norm(C(r, 2));
    if (b.includes("cdt") || b.includes("kh")) customer = customer || text(C(r, 3));
    if (b.includes("kichthuoc")) dims = text(C(r, 4)) || text(C(r, 3));
    if (b.includes("vitri")) location = text(C(r, 4)) || text(C(r, 3));
  }

  // Khối tài chính, dòng 8–16. Cột C = số tiền chính; D = Đã chi; E = Đã thu;
  // G = Còn phải thu (đôi khi lại là ghi chú dạng chữ, ví dụ "đã thu đủ").
  const fin: TaiChinh = {
    revenue: null,
    cost: null,
    profit: null,
    extraVat: null,
    paid: null,
    collected: null,
    receivable: null,
    collectionNote: null,
  };
  for (let r = 8; r <= 16; r++) {
    const b = norm(C(r, 2));
    if (!b) continue;
    if (b.includes("doanhthu")) fin.revenue = num(C(r, 3));
    else if (b.includes("chiphi")) fin.cost = num(C(r, 3));
    else if (b.includes("lntt")) fin.profit = num(C(r, 3));
    else if (b.includes("vatduocnhanthem")) fin.extraVat = num(C(r, 3));

    if (b.includes("doanhthu") || b.includes("chiphi")) {
      if (fin.paid == null) fin.paid = num(C(r, 4));
      if (fin.collected == null) fin.collected = num(C(r, 5));
      const g = C(r, 7);
      if (num(g) != null && fin.receivable == null) fin.receivable = num(g);
      else if (!fin.collectionNote && text(g)) fin.collectionNote = text(g);
    }
  }

  // Bảng tổng hợp hạng mục — nhận ra nhờ dòng tiêu đề có B chứa "Hạng mục", C chứa "NCC".
  const nhom: NhomChiPhi[] = [];
  let hdr = 0;
  for (let r = 1; r <= 30; r++) {
    if (norm(C(r, 3)).includes("ncc") && norm(C(r, 2)).includes("hangmuc")) {
      hdr = r;
      break;
    }
  }
  if (hdr) {
    for (let r = hdr + 1; r <= hdr + 14; r++) {
      const a = text(C(r, 1)).trim().toUpperCase();
      if (!/^[A-K]$/.test(a)) {
        if (norm(C(r, 1)).includes("chitiet")) break;
        continue;
      }
      nhom.push({
        code: a,
        name: text(C(r, 2)) || HANG_MUC[a]?.label || a,
        supplier: text(C(r, 3)) || null,
        value: num(C(r, 4)),
        payment: num(C(r, 5)),
        invoice: num(C(r, 6)),
      });
    }
  } else {
    canhBao.push("Không tìm thấy bảng tổng hợp hạng mục (dòng tiêu đề có ô Hạng mục và ô NCC).");
  }

  // Phần "Chi tiết chi phí": dòng chữ cái A–K là subtotal của nhóm (bỏ qua),
  // các dòng dưới nó thuộc về nhóm đó cho tới khi gặp chữ cái tiếp theo.
  const dong: DongChiPhi[] = [];
  let det = 0;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (norm(C(r, 1)).includes("chitietchiphi")) {
      det = r + 1; // dòng ngay sau là header "Hạng Mục"
      break;
    }
  }
  let moCoi = 0;
  if (det) {
    let cur = "";
    let trong = 0;
    for (let r = det + 1; r <= ws.rowCount; r++) {
      const a = text(C(r, 1)).trim().toUpperCase();
      const name = text(C(r, 2));
      const qty = num(C(r, 3));
      const price = num(C(r, 4));
      const amount = num(C(r, 5));
      if (!a && !name && qty == null && price == null && amount == null) {
        // 20 dòng trống liên tiếp mới coi là hết bảng — giữa bảng hay có khoảng trống.
        if (++trong > 20) break;
        continue;
      }
      trong = 0;
      if (/^[A-K]$/.test(a)) {
        cur = a;
        continue;
      }
      if (!name || (qty == null && price == null && amount == null)) continue;
      if (!cur) {
        moCoi++;
        continue;
      }
      dong.push({
        cat: cur,
        name,
        qty,
        unitPrice: price,
        amount,
        ref: text(C(r, 6)) || null,
        note: text(C(r, 7)) || null,
      });
    }
  } else {
    canhBao.push("Không tìm thấy phần Chi tiết chi phí — chỉ nhập được số tổng hợp theo hạng mục.");
  }
  if (moCoi > 0) {
    canhBao.push(
      `${moCoi} dòng chi tiết nằm trước mã hạng mục A–K nên không biết thuộc nhóm nào, đã bỏ qua.`
    );
  }

  return {
    dang: "quyet-toan",
    dims: dims || loiKichThuoc(tenFile) || "",
    location,
    customer,
    fin,
    nhom,
    dong,
    canhBao,
  };
}

// ---------- Dạng 2: sổ giá thành ----------

function bocSoGiaThanh(ws: SheetLike, tenFile: string): KetQuaThcp {
  const C = (r: number, c: number) => ws.getCell(r, c).value;
  const canhBao: string[] = [];
  const maxCol = Math.min(ws.columnCount || 14, 20);

  let hdr = 0;
  for (let r = 1; r <= 12; r++) if (norm(C(r, 1)).includes("mahang")) hdr = r;
  let numRow = 0;
  for (let r = hdr; r <= hdr + 3; r++) {
    if (text(C(r, 1)) === "1") {
      numRow = r;
      break;
    }
  }
  const start = (numRow || hdr) + 1;

  let dims: string | null = null;
  for (let r = start; r <= start + 3 && !dims; r++) {
    dims = loiKichThuocRong(text(C(r, 2))) || loiKichThuocRong(text(C(r, 3)));
  }
  dims = dims || loiKichThuocRong(tenFile) || tenFile.replace(/\.xlsx?$/i, "");

  // Sổ không ghi địa điểm, chỉ tên file có. Bỏ chữ "THCP" và phần kích thước ra.
  const location = tenFile
    .replace(/\.xlsx?$/i, "")
    .replace(/thcp/gi, "")
    .replace(/K?\s*\d+\s*[xXlL]\s*\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const dong: DongChiPhi[] = [];
  const tui: Record<string, number> = { A: 0, G: 0, H: 0 };
  let revenue: number | null = null;
  let hetBang = false;

  for (let r = start; r <= ws.rowCount; r++) {
    const name = text(C(r, 3)) || text(C(r, 4));
    const n1 = norm(C(r, 1));
    const n3 = norm(name);
    if (n1.includes("doanhthu") || n3.includes("doanhthu")) {
      revenue = soLonNhat(ws, r, 6, maxCol);
      continue;
    }
    if (n1.includes("lntt") || n3.includes("lntt")) continue;
    if (n1.includes("tongcong") || n3.includes("tongcong")) {
      hetBang = true;
      continue;
    }
    if (n1.includes("nguoighiso") || n3.includes("nguoighiso")) break;
    if (hetBang || !name || /^\d+$/.test(name)) continue;

    const amount = soPhaiNhat(ws, r, 6, maxCol);
    if (amount == null || amount === 0) continue;

    // Sổ không có mã hạng mục. Cột 6 có tiền => vật tư, cột 7/8 có tiền => nhân công,
    // còn lại xếp "khác". Thô, nhưng đó là tất cả những gì file này cho biết.
    const mat = num(C(r, 6));
    const lab = num(C(r, 7)) ?? num(C(r, 8));
    const cat = mat != null && mat !== 0 ? "A" : lab != null && lab !== 0 ? "G" : "H";
    tui[cat] += amount;
    dong.push({ cat, name, qty: num(C(r, 5)), unitPrice: null, amount, ref: null, note: null });
  }

  // Chi phí = tổng các dòng đã bóc, để luôn khớp với phần chi tiết hiển thị.
  // Ô LNTT trong sổ đôi khi lệch nên tính lại thay vì đọc thẳng.
  const cost = dong.reduce((s, i) => s + (i.amount || 0), 0);
  const profit = revenue != null ? revenue - cost : null;

  const nhom: NhomChiPhi[] = [
    { code: "A", name: "Vật tư (NVL)", supplier: null, value: tui.A || null, payment: null, invoice: null },
    { code: "G", name: "Nhân công", supplier: null, value: tui.G || null, payment: null, invoice: null },
    { code: "H", name: "Chi phí khác", supplier: null, value: tui.H || null, payment: null, invoice: null },
  ].filter((c) => c.value != null);

  if (revenue == null) canhBao.push("Sổ không có dòng Doanh thu — LNTT sẽ để trống.");
  canhBao.push(
    "File dạng sổ giá thành không có mã hạng mục A–K; nhóm chi phí được suy ra từ cột tiền (vật tư / nhân công / khác)."
  );

  return {
    dang: "so-gia-thanh",
    dims,
    location,
    customer: "",
    fin: {
      revenue,
      cost,
      profit,
      extraVat: null,
      paid: null,
      collected: null,
      receivable: null,
      collectionNote: null,
    },
    nhom,
    dong,
    canhBao,
  };
}

// ---------- Cửa vào ----------

/** Bóc file THCP, tự nhận dạng format. Hàm THUẦN. */
export function bocTachThcp(ws: SheetLike, tenFile: string): KetQuaThcp {
  const kq = laSoGiaThanh(ws) ? bocSoGiaThanh(ws, tenFile) : bocQuyetToan(ws, tenFile);

  if (kq.dong.length === 0 && kq.nhom.length === 0) {
    kq.canhBao.unshift("Không bóc được dòng chi phí nào — kiểm tra lại cấu trúc file.");
  }

  // Đối chiếu chi tiết với con số tổng ghi sẵn trong file. Lệch dưới 1% coi như làm tròn.
  const tongChiTiet = kq.dong.reduce((s, i) => s + (i.amount || 0), 0);
  if (kq.fin.cost != null && kq.fin.cost > 0 && tongChiTiet > 0) {
    const lech = Math.abs(tongChiTiet - kq.fin.cost) / kq.fin.cost;
    if (lech > 0.01) {
      kq.canhBao.push(
        `Tổng chi tiết ${Math.round(tongChiTiet).toLocaleString("vi-VN")} ₫ lệch ${(lech * 100).toFixed(1)}% so với ô Chi phí ${Math.round(kq.fin.cost).toLocaleString("vi-VN")} ₫ ghi trong file.`
      );
    }
  }

  return { ...kq, canhBao: kq.canhBao.slice(0, 20) };
}

// ---------- Khớp dự án ----------

/** Chỉ cần bấy nhiêu trường để khớp — nhận cả kết quả findMany rút gọn. */
export interface DuAnRutGon {
  id: string;
  code: string;
  name: string;
  location: string | null;
}

export interface KetQuaKhop<T extends DuAnRutGon> {
  duAn: T | null;
  cachKhop: string;
  canhBao: string[];
}

/**
 * Tìm dự án tương ứng với file THCP. Hàm THUẦN — nhận sẵn danh sách dự án.
 *
 * Hai bước, theo đúng script CLI cũ:
 *   1. tên dự án trùng khít phần kích thước ("K20L50");
 *   2. tên dự án CHỨA kích thước VÀ địa điểm trùng nhau một phần.
 *
 * Bước 2 lỏng, nên chỉ dùng khi cả hai bên đều có địa điểm — nếu không, hai nhà cùng
 * kích thước ở hai tỉnh khác nhau sẽ bị gộp làm một. Khác script cũ ở một điểm: khi
 * bước 2 ra NHIỀU ứng viên, script cũ lấy cái đầu tiên; ở đây từ chối đoán và báo
 * cho người dùng, vì ghi đè nhầm quyết toán của dự án khác là không sửa lại được.
 */
export function khopDuAn<T extends DuAnRutGon>(
  kq: Pick<KetQuaThcp, "dims" | "location">,
  projects: T[],
  tenFile: string
): KetQuaKhop<T> {
  const canhBao: string[] = [];
  const nDims = norm(kq.dims);

  if (nDims) {
    const dung = projects.find((p) => norm(p.name) === nDims);
    if (dung) return { duAn: dung, cachKhop: "khớp tên dự án theo kích thước", canhBao };
  }

  const core = loiKichThuoc(kq.dims) || loiKichThuoc(tenFile);
  const nCore = core ? norm(core) : "";
  const nLoc = norm(kq.location);
  if (nCore && nLoc) {
    const ungVien = projects.filter((p) => {
      const pl = norm(p.location || "");
      return norm(p.name).includes(nCore) && pl.length > 0 && (pl.includes(nLoc) || nLoc.includes(pl));
    });
    if (ungVien.length === 1) {
      return {
        duAn: ungVien[0],
        cachKhop: `khớp kích thước ${core} + địa điểm "${kq.location}"`,
        canhBao,
      };
    }
    if (ungVien.length > 1) {
      canhBao.push(
        `${ungVien.length} dự án cùng khớp kích thước ${core} và địa điểm "${kq.location}" (${ungVien
          .map((p) => p.code)
          .join(", ")}) — không tự chọn được, sẽ TẠO DỰ ÁN MỚI. Kiểm tra kỹ trước khi xác nhận.`
      );
    }
  }

  return {
    duAn: null,
    cachKhop: "không khớp dự án nào — sẽ TẠO DỰ ÁN MỚI (trạng thái Hoàn thành)",
    canhBao,
  };
}
