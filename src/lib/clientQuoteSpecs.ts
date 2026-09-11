// Sợi dây nối hạng mục (mục 1) với bảng vật liệu & thông số kỹ thuật (mục 2).
//
// Quy tắc: mỗi dòng vật liệu mang một NHÃN loại vật tư; mỗi hạng mục khai nó dùng
// những nhãn nào. Bảng vật liệu chỉ in dòng có nhãn thuộc một hạng mục đang có —
// báo giá không bán thưng vách thì không in tôn thưng.
//
// Dòng vật liệu KHÔNG mang nhãn là vật tư dùng chung (que hàn, sơn, bulong, keo
// vít): công trình kết cấu thép nào cũng có, nên luôn in.
//
// Logic thuần, không đụng Prisma.

/**
 * Đoán nhãn vật tư từ tên một "phần" của báo giá chi tiết ("Khung thép và tôn phần
 * mái" -> KHUNG_THEP + TON_MAI).
 *
 * Chỉ để rót sẵn lúc sinh báo giá cho đỡ phải tick tay — người lập vẫn sửa được.
 * Không đoán ra gì thì trả mảng rỗng chứ không đoán bừa: gắn nhầm nhãn sẽ in thừa
 * cả một nhóm vật liệu vào báo giá gửi khách.
 */
export function doanNhan(tenPhan: string): string[] {
  const t = tenPhan.toLowerCase();
  const ra: string[] = [];
  const co = (...tu: string[]) => tu.some((x) => t.includes(x));

  if (co("khung", "kết cấu", "ket cau", "thép", "thep")) ra.push("KHUNG_THEP");
  if (co("mái hiên", "mai hien", "canopy")) ra.push("MAI_HIEN");
  if (co("cửa trời", "cua troi", "nóc gió", "noc gio")) ra.push("CUA_TROI");
  // "mái hiên" đã bắt ở trên; ở đây là mái chính.
  if (co("mái", "mai") && !co("mái hiên", "mai hien")) ra.push("TON_MAI");
  if (co("thưng", "thung", "vách", "vach", "bao che")) ra.push("TON_THUNG");
  if (co("sàn", "san ")) ra.push("SAN");

  return [...new Set(ra)];
}

export interface SpecLike {
  tag?: string | null;
  name: string;
  spec?: string | null;
}

export interface LineLike {
  tags?: string[] | null;
}

/** Tập nhãn mà báo giá này thực sự đang dùng, gộp từ mọi hạng mục. */
export function tagsDangDung(lines: LineLike[]): Set<string> {
  const s = new Set<string>();
  for (const l of lines) {
    for (const t of l.tags ?? []) {
      const v = t.trim();
      if (v) s.add(v);
    }
  }
  return s;
}

/**
 * Lọc bảng vật liệu theo các hạng mục đang có.
 *
 * Giữ nguyên thứ tự đầu vào. Dòng không nhãn luôn được giữ.
 */
export function specsHienThi<T extends SpecLike>(specs: T[], dangDung: Set<string>): T[] {
  return specs.filter((sp) => {
    const tag = sp.tag?.trim();
    if (!tag) return true; // vật tư dùng chung
    return dangDung.has(tag);
  });
}

/** Các dòng vật liệu thuộc về một hạng mục cụ thể (chỉ dòng CÓ nhãn khớp). */
export function specsCuaHangMuc<T extends SpecLike>(specs: T[], tags: string[] | null): T[] {
  const cua = new Set((tags ?? []).map((t) => t.trim()).filter(Boolean));
  if (cua.size === 0) return [];
  return specs.filter((sp) => {
    const tag = sp.tag?.trim();
    return !!tag && cua.has(tag);
  });
}

/** Một dòng gạch đầu dòng mô tả vật tư: "- Tôn mái sóng CN — 0.45mm, AZ50G550". */
function dongVatTu(sp: SpecLike): string {
  const ten = sp.name.trim();
  const ky = sp.spec?.trim();
  return ky ? `- ${ten} — ${ky}` : `- ${ten}`;
}

/**
 * Mô tả in dưới tên một hạng mục.
 *
 * Ghép theo thứ tự: câu mô tả chung của báo giá, rồi các vật tư đã gắn cho hạng mục
 * đó. Nhờ vậy mô tả LUÔN khớp với bảng vật liệu ở mục 2 — không phải gõ hai nơi rồi
 * tự nhớ cập nhật cho khớp.
 *
 * `detail` riêng của dòng, nếu có, ĐÈ hoàn toàn: người lập muốn viết khác thì viết.
 */
export function moTaHangMuc(
  detail: string | null | undefined,
  moTaChung: string | null | undefined,
  specs: SpecLike[],
  tags: string[] | null | undefined
): string | null {
  const rieng = detail?.trim();
  if (rieng) return rieng;

  const phan: string[] = [];
  const chung = moTaChung?.trim();
  if (chung) phan.push(chung);
  for (const sp of specsCuaHangMuc(specs, tags ?? null)) phan.push(dongVatTu(sp));

  return phan.length > 0 ? phan.join("\n") : null;
}
