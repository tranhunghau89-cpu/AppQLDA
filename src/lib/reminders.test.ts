import { describe, expect, it } from "vitest";
import {
  buildReminderReport,
  formatReminderText,
  type BaoGiaTheoDoiInput,
  type DotThanhToanInput,
  type MocTreInput,
} from "./reminders";

const NOW = new Date("2026-09-10T00:00:00Z").getTime();
const NGAY = 86_400_000;

function moc(p: Partial<MocTreInput> = {}): MocTreInput {
  return {
    projectId: "p1",
    projectCode: "N001",
    projectName: "K20L60",
    type: "SHOP",
    planDate: new Date(NOW - 3 * NGAY),
    ...p,
  };
}
function dot(p: Partial<DotThanhToanInput> = {}): DotThanhToanInput {
  return {
    projectId: "p1",
    projectCode: "N001",
    direction: "THU",
    name: "Đợt 1",
    counterpart: null,
    amount: 1_000_000,
    dueDate: new Date(NOW - 2 * NGAY),
    ...p,
  };
}

describe("buildReminderReport — mốc trễ", () => {
  it("tính đúng số ngày trễ và xếp trễ nhiều lên trước", () => {
    const r = buildReminderReport(
      [moc({ planDate: new Date(NOW - 2 * NGAY) }), moc({ planDate: new Date(NOW - 9 * NGAY) })],
      [],
      NOW
    );
    expect(r.mocTre.map((m) => m.soNgayTre)).toEqual([9, 2]);
  });

  it("mốc còn hạn không bị nhắc", () => {
    expect(buildReminderReport([moc({ planDate: new Date(NOW + NGAY) })], [], NOW).mocTre).toEqual([]);
  });

  it("mốc đúng thời điểm hiện tại chưa tính là trễ", () => {
    expect(buildReminderReport([moc({ planDate: new Date(NOW) })], [], NOW).mocTre).toEqual([]);
  });
});

describe("buildReminderReport — thanh toán", () => {
  it("tách quá hạn và sắp tới hạn", () => {
    const r = buildReminderReport(
      [],
      [
        dot({ dueDate: new Date(NOW - 5 * NGAY) }),
        dot({ dueDate: new Date(NOW + 3 * NGAY) }),
        dot({ dueDate: new Date(NOW + 30 * NGAY) }), // ngoài cửa sổ 7 ngày
      ],
      NOW
    );
    expect(r.quaHan).toHaveLength(1);
    expect(r.sapToiHan).toHaveLength(1);
    expect(r.quaHan[0].soNgayConLai).toBe(-5);
    expect(r.sapToiHan[0].soNgayConLai).toBe(3);
  });

  it("cộng riêng tổng phải thu và phải trả quá hạn", () => {
    const r = buildReminderReport(
      [],
      [
        dot({ direction: "THU", amount: 3_000_000 }),
        dot({ direction: "CHI", amount: 1_200_000 }),
        dot({ direction: "THU", amount: 500_000 }),
      ],
      NOW
    );
    expect(r.tongPhaiThuQuaHan).toBe(3_500_000);
    expect(r.tongPhaiTraQuaHan).toBe(1_200_000);
  });

  it("đợt chưa ghi số tiền không làm hỏng phép cộng", () => {
    const r = buildReminderReport([], [dot({ amount: null })], NOW);
    expect(r.tongPhaiThuQuaHan).toBe(0);
    expect(r.quaHan).toHaveLength(1);
  });

  it("xếp quá hạn lâu nhất lên trước", () => {
    const r = buildReminderReport(
      [],
      [dot({ dueDate: new Date(NOW - 2 * NGAY) }), dot({ dueDate: new Date(NOW - 20 * NGAY) })],
      NOW
    );
    expect(r.quaHan.map((d) => d.soNgayConLai)).toEqual([-20, -2]);
  });

  it("đổi được cửa sổ 'sắp tới hạn'", () => {
    const ds = [dot({ dueDate: new Date(NOW + 20 * NGAY) })];
    expect(buildReminderReport([], ds, NOW, 7).sapToiHan).toHaveLength(0);
    expect(buildReminderReport([], ds, NOW, 30).sapToiHan).toHaveLength(1);
  });
});

describe("cờ rỗng", () => {
  it("không có gì -> rong = true (không cần gửi)", () => {
    expect(buildReminderReport([], [], NOW).rong).toBe(true);
  });
  it("có dù chỉ một mục -> rong = false", () => {
    expect(buildReminderReport([moc()], [], NOW).rong).toBe(false);
  });
});

describe("formatReminderText", () => {
  it("rỗng thì báo rõ là không có gì", () => {
    expect(formatReminderText(buildReminderReport([], [], NOW))).toContain("Không có");
  });

  it("có đủ ba mục khi có dữ liệu", () => {
    const t = formatReminderText(
      buildReminderReport(
        [moc()],
        [dot(), dot({ dueDate: new Date(NOW + 2 * NGAY) })],
        NOW
      )
    );
    expect(t).toContain("MỐC TRỄ HẠN");
    expect(t).toContain("THANH TOÁN QUÁ HẠN");
    expect(t).toContain("SẮP TỚI HẠN");
    expect(t).toContain("N001");
  });

  it("cắt bớt khi quá nhiều dòng và ghi rõ còn bao nhiêu", () => {
    const nhieu = Array.from({ length: 15 }, (_, i) =>
      moc({ projectCode: `N${i}`, planDate: new Date(NOW - (i + 1) * NGAY) })
    );
    const t = formatReminderText(buildReminderReport(nhieu, [], NOW), 10);
    expect(t).toContain("và 5 mốc nữa");
  });
});

/* ---------------- Báo giá gửi khách ---------------- */

function bg(p: Partial<BaoGiaTheoDoiInput> = {}): BaoGiaTheoDoiInput {
  return {
    clientQuoteId: "cq1",
    quoteNo: "BG-2026-014",
    projectCode: "K50L120",
    customer: "Công ty CP ABC",
    total: 764_500_000,
    expiryDate: new Date(NOW + 3 * NGAY),
    henLienHeLai: null,
    ...p,
  };
}

describe("buildReminderReport — báo giá gửi khách", () => {
  it("hết hiệu lực 3 ngày trước thì vào mục hết hạn, số ngày mang dấu âm", () => {
    const r = buildReminderReport([], [], NOW, 7, [
      bg({ expiryDate: new Date(NOW - 3 * NGAY) }),
    ]);
    expect(r.baoGiaHetHan).toHaveLength(1);
    expect(r.baoGiaHetHan[0].hetHan).toBe(true);
    expect(r.baoGiaHetHan[0].soNgayConLai).toBe(-3);
    expect(r.baoGiaSapHetHan).toHaveLength(0);
  });

  it("còn 3 ngày thì vào mục sắp hết hạn", () => {
    const r = buildReminderReport([], [], NOW, 7, [bg()]);
    expect(r.baoGiaSapHetHan).toHaveLength(1);
    expect(r.baoGiaSapHetHan[0].soNgayConLai).toBe(3);
    expect(r.baoGiaSapHetHan[0].hetHan).toBe(false);
  });

  it("còn 30 ngày thì chưa nhắc", () => {
    const r = buildReminderReport([], [], NOW, 7, [
      bg({ expiryDate: new Date(NOW + 30 * NGAY) }),
    ]);
    expect(r.baoGiaHetHan).toHaveLength(0);
    expect(r.baoGiaSapHetHan).toHaveLength(0);
    expect(r.rong).toBe(true);
  });

  it("dùng đúng cửa sổ sapToiHanTrongNgay được truyền vào", () => {
    const q = [bg({ expiryDate: new Date(NOW + 20 * NGAY) })];
    expect(buildReminderReport([], [], NOW, 7, q).baoGiaSapHetHan).toHaveLength(0);
    expect(buildReminderReport([], [], NOW, 30, q).baoGiaSapHetHan).toHaveLength(1);
  });

  it("sắp hết hạn gần nhất đứng trước", () => {
    const r = buildReminderReport([], [], NOW, 7, [
      bg({ quoteNo: "B", expiryDate: new Date(NOW + 5 * NGAY) }),
      bg({ quoteNo: "A", expiryDate: new Date(NOW + 1 * NGAY) }),
    ]);
    expect(r.baoGiaSapHetHan.map((x) => x.quoteNo)).toEqual(["A", "B"]);
  });

  it("CHỈ có báo giá sắp hết hạn thì rong phải là false", () => {
    // Chốt điểm dễ quên nhất: mục được tính đủ nhưng cờ rong không mở rộng thì
    // route.ts sẽ không bao giờ gửi bản tin.
    const r = buildReminderReport([], [], NOW, 7, [bg()]);
    expect(r.rong).toBe(false);
  });

  it("CHỈ có báo giá đã hết hạn thì rong cũng phải là false", () => {
    const r = buildReminderReport([], [], NOW, 7, [
      bg({ expiryDate: new Date(NOW - 1 * NGAY) }),
    ]);
    expect(r.rong).toBe(false);
  });

  it("không truyền tham số báo giá thì mọi thứ cũ giữ nguyên", () => {
    const r = buildReminderReport([moc()], [dot()], NOW);
    expect(r.baoGiaHetHan).toEqual([]);
    expect(r.baoGiaSapHetHan).toEqual([]);
    expect(r.mocTre).toHaveLength(1);
    expect(r.quaHan).toHaveLength(1);
  });
});

describe("formatReminderText — báo giá gửi khách", () => {
  it("in số báo giá, mã dự án, tên CĐT, tiền và số ngày", () => {
    const t = formatReminderText(buildReminderReport([], [], NOW, 7, [bg()]));
    expect(t).toContain("BÁO GIÁ SẮP HẾT HIỆU LỰC (1)");
    expect(t).toContain("BG-2026-014");
    expect(t).toContain("K50L120");
    expect(t).toContain("Công ty CP ABC");
    expect(t).toContain("764.500.000 ₫");
    expect(t).toContain("hết hiệu lực còn 3 ngày");
  });

  it("gộp hẹn liên hệ lại vào cùng dòng, không tách mục riêng", () => {
    const t = formatReminderText(
      buildReminderReport([], [], NOW, 7, [
        bg({ henLienHeLai: new Date("2026-09-14T00:00:00Z") }),
      ])
    );
    expect(t).toContain("(hẹn liên hệ lại 14/09)");
    expect(t.split("hẹn liên hệ lại").length - 1).toBe(1);
  });

  it("báo giá quá hạn dùng cách nói khác hẳn", () => {
    const t = formatReminderText(
      buildReminderReport([], [], NOW, 7, [bg({ expiryDate: new Date(NOW - 5 * NGAY) })])
    );
    expect(t).toContain("BÁO GIÁ HẾT HIỆU LỰC (1)");
    expect(t).toContain("hết hiệu lực 5 ngày trước");
  });

  it("không có số báo giá thì vẫn đọc được", () => {
    const t = formatReminderText(
      buildReminderReport([], [], NOW, 7, [bg({ quoteNo: null, customer: null })])
    );
    expect(t).toContain("K50L120");
  });

  it("cắt bớt khi quá nhiều báo giá", () => {
    const nhieu = Array.from({ length: 13 }, (_, i) =>
      bg({ quoteNo: `BG-${i}`, expiryDate: new Date(NOW + (i % 7) * NGAY) })
    );
    const t = formatReminderText(buildReminderReport([], [], NOW, 7, nhieu), 10);
    expect(t).toContain("và 3 báo giá nữa");
  });
});
