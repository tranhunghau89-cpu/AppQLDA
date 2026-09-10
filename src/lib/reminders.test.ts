import { describe, expect, it } from "vitest";
import {
  buildReminderReport,
  formatReminderText,
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
