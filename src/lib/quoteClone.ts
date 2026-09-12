import { sellFromBase } from "./quote";

/**
 * Dựng TOÀN BỘ hàng của một bản sao báo giá trong bộ nhớ, để nơi gọi ghi xuống bằng
 * hai lệnh `createMany` thay vì một lệnh cho mỗi hàng.
 *
 * Vì sao tách khỏi server action: bản cũ ghi từng phần rồi từng dòng bằng `create`
 * trong vòng lặp. Trên máy lập trình, cơ sở dữ liệu chạy cùng tiến trình nên một lệnh
 * mất chưa tới một phần nghìn giây và mọi lần bấm thử đều xanh. Trên Supabase mỗi lệnh
 * đi-về mất ~330ms, nên một báo giá 90 dòng là ~95 lệnh nối đuôi ≈ 32 giây — vượt xa
 * hạn 5 giây của một giao dịch tương tác Prisma. Giao dịch bị huỷ, KHÔNG ghi được gì,
 * và trang đổ vào error boundary. Đây đúng cái lỗi đã sửa ở 7f680ff cho `apBoHangMuc
 * VaoDuToan`, còn sót lại ở đây.
 */

export type NguonPhan = {
  id: string;
  code: string;
  name: string;
  kind: string;
  parentId: string | null;
  area: number | null;
  sortOrder: number;
};

export type NguonDong = {
  sectionId: string;
  workCode: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  baseCost: number | null;
  sellPrice: number | null;
  spec: string | null;
  note: string | null;
  napThamSo: string | null;
  layTuThamSo: string | null;
  heSoQuyDoi: number | null;
  sortOrder: number;
};

export type PhanMoi = Omit<NguonPhan, "parentId"> & { quoteId: string; parentId: string | null };
export type DongMoi = Omit<NguonDong, "sectionId"> & { quoteId: string; sectionId: string };

export function dungBanSaoBaoGia(args: {
  quoteId: string;
  sections: NguonPhan[];
  items: NguonDong[];
  markup: number;
  /** Mã công tác -> đơn giá HIỆN HÀNH. */
  banGia: Map<string, number | null>;
  /** Sinh khoá chính. Tiêm vào để test khẳng định được id, và để id có TRƯỚC khi ghi. */
  idMoi: () => string;
}): { sections: PhanMoi[]; items: DongMoi[] } {
  const { quoteId, sections, items, markup, banGia, idMoi } = args;

  /**
   * Tự sinh id thay vì đọc lại id do cơ sở dữ liệu cấp.
   *
   * Cách hiển nhiên hơn là `createManyAndReturn` rồi tra cha con bằng `code` — nhưng
   * `code` KHÔNG duy nhất trong một báo giá: người dùng tự gõ, và mục con hầu như luôn
   * đánh lại từ "1" dưới mỗi phần. Tra bằng mã sẽ nối dòng của phần B vào phần A mà
   * không báo gì. Có id trước khi ghi thì ánh xạ id cũ -> id mới là một-một, không phụ
   * thuộc vào mã trùng lẫn thứ tự hàng trả về.
   */
  const idCu = new Map(sections.map((s) => [s.id, idMoi()]));

  /**
   * Cha trước con: cả hai nằm trong CÙNG một lệnh `INSERT`, mà PostgreSQL kiểm khoá
   * ngoại ở cuối lệnh nên tự tham chiếu vẫn hợp lệ. Xếp cha lên trước để nếu Prisma có
   * cắt lệnh vì quá nhiều tham số thì cha vẫn nằm ở lô trước.
   */
  const xepCha = [
    ...sections.filter((s) => !s.parentId || !idCu.has(s.parentId)),
    ...sections.filter((s) => s.parentId && idCu.has(s.parentId)),
  ];

  const phanMoi: PhanMoi[] = xepCha.map((s) => ({
    id: idCu.get(s.id)!,
    quoteId,
    code: s.code,
    name: s.name,
    kind: s.kind,
    parentId: s.parentId ? (idCu.get(s.parentId) ?? null) : null,
    area: s.area,
    sortOrder: s.sortOrder,
  }));

  const dongMoi: DongMoi[] = items.flatMap((it) => {
    const sectionId = idCu.get(it.sectionId);
    if (!sectionId) return []; // dòng mồ côi của dữ liệu cũ, không dựng lại
    // Bản chép lấy đơn giá thư viện HIỆN HÀNH, không bê nguyên giá của bản nguồn:
    // chép một báo giá từ năm ngoái mà giữ nguyên giá năm ngoái là cái bẫy đắt tiền.
    const base = it.workCode ? (banGia.get(it.workCode) ?? it.baseCost) : it.baseCost;
    return [
      {
        quoteId,
        sectionId,
        workCode: it.workCode,
        name: it.name,
        unit: it.unit,
        qty: it.qty,
        baseCost: base,
        sellPrice: base != null ? sellFromBase(base, markup) : it.sellPrice,
        spec: it.spec,
        note: it.note,
        // Bản sao phải giữ quan hệ dẫn xuất, nếu không thì sửa khối lượng thép trên
        // bản mới mà cước vận chuyển đứng yên — và không ai đoán được vì sao.
        napThamSo: it.napThamSo,
        layTuThamSo: it.layTuThamSo,
        heSoQuyDoi: it.heSoQuyDoi,
        sortOrder: it.sortOrder,
      },
    ];
  });

  return { sections: phanMoi, items: dongMoi };
}
