import { describe, expect, it } from "vitest";
import type { BanNhapHopDong } from "./chuanHoa";
import { bangChuKhop, chuanHoaBangChu, kiemTraHopDong, type NguCanhKiemTra } from "./kiemTra";

const NG: NguCanhKiemTra = {
  soHopDongDaCo: [],
  tuKhoaCongTy: ["dubai"],
  homNay: new Date("2026-10-23T00:00:00Z"),
};

function mau(): BanNhapHopDong {
  return {
    hopDong: {
      contractNo: "0704/2026/HĐMB",
      signDate: "2026-04-07",
      effectiveDate: "2026-04-10",
      durationDays: 90,
      subject: "Cung cấp và thi công nhà thép",
      partyAName: "Công ty TNHH ABC",
      partyAInfo: "",
      status: "SIGNED",
      vatPercent: 8,
      paymentTerms: "",
      note: "",
    },
    hangMuc: [
      { name: "Khung thép", unit: "kg", qty: 50_000, unitPrice: 30_000, amount: 1_500_000_000, trang: 3 },
      { name: "Tôn mái", unit: "m2", qty: 1_000, unitPrice: 500_000, amount: 500_000_000, trang: 3 },
    ],
    dotThanhToan: [
      { ten: "Tạm ứng", phanTram: 30, soTien: 648_000_000, dieuKien: "" },
      { ten: "Đợt 2", phanTram: 70, soTien: 1_512_000_000, dieuKien: "" },
    ],
    doiChieu: {
      giaTriTruocVat: 2_000_000_000,
      giaTriSauVat: 2_160_000_000,
      giaTriBangChu: "Hai tỷ một trăm sáu mươi triệu đồng chẵn",
      tenBenB: "Công ty Cổ phần Xây dựng Dubai",
    },
    hangMucTuDong: false,
    tinCayThap: [],
    ngayKhongHopLe: [],
    bangChung: {},
    ghiChuAi: null,
  };
}

const truongLoi = (b: BanNhapHopDong, ng: NguCanhKiemTra = NG) =>
  kiemTraHopDong(b, ng).map((c) => `${c.mucDo}:${c.truong}`);

describe("kiemTraHopDong", () => {
  it("hợp đồng khớp hết → không cảnh báo", () => {
    expect(kiemTraHopDong(mau(), NG)).toEqual([]);
  });

  it("AI đọc sai một chữ số ở thành tiền → đỏ ở dòng đó và ở tổng", () => {
    const b = mau();
    b.hangMuc[1].amount = 50_000_000; // thiếu một số 0
    expect(truongLoi(b)).toEqual(["do:hangMuc.1.amount", "do:giaTriTruocVat"]);
  });

  it("lệch dưới 1.000đ do làm tròn thì bỏ qua", () => {
    const b = mau();
    b.hangMuc[0] = { ...b.hangMuc[0], qty: 1234.567, unitPrice: 30_000, amount: 37_037_000 };
    b.doiChieu = { ...b.doiChieu, giaTriTruocVat: null, giaTriSauVat: null, giaTriBangChu: null };
    b.dotThanhToan = [];
    expect(truongLoi(b)).toEqual([]);
  });

  it("dòng không có thành tiền mà thiếu KL hoặc đơn giá → đỏ", () => {
    const b = mau();
    b.hangMuc[0] = { ...b.hangMuc[0], amount: null, unitPrice: null };
    expect(truongLoi(b)).toContain("do:hangMuc.0.amount");
  });

  it("dòng khoán (chỉ có thành tiền) là hợp lệ", () => {
    const b = mau();
    b.hangMuc[0] = { ...b.hangMuc[0], qty: null, unitPrice: null };
    expect(truongLoi(b)).toEqual([]);
  });

  it("VAT không khớp → đỏ", () => {
    const b = mau();
    b.hopDong.vatPercent = 10;
    expect(truongLoi(b)).toEqual(["do:giaTriSauVat"]);
  });

  it("bằng chữ không khớp số nào → đỏ", () => {
    const b = mau();
    b.doiChieu.giaTriBangChu = "Hai tỷ một trăm năm mươi triệu đồng";
    expect(truongLoi(b)).toEqual(["do:giaTriBangChu"]);
  });

  it("đợt thanh toán không đủ 100% / không khớp giá trị → vàng", () => {
    const b = mau();
    b.dotThanhToan[1] = { ...b.dotThanhToan[1], phanTram: 60, soTien: 1_000_000_000 };
    expect(truongLoi(b)).toEqual(["vang:dot", "vang:dot"]);
  });

  it("đợt chỉ ghi % (không ghi tiền) thì chỉ kiểm %", () => {
    const b = mau();
    b.dotThanhToan = b.dotThanhToan.map((d) => ({ ...d, soTien: null }));
    expect(truongLoi(b)).toEqual([]);
  });

  it("thiếu trường bắt buộc → vàng, cần nhập tay", () => {
    const b = mau();
    b.hopDong.contractNo = "";
    b.hopDong.partyAName = " ";
    expect(truongLoi(b)).toEqual(["vang:contractNo", "vang:partyAName"]);
  });

  it("ngày: hiệu lực trước ngày ký, ngày ký ở tương lai, ngày AI đọc hỏng", () => {
    const b = mau();
    b.hopDong.signDate = "2027-04-07";
    b.hopDong.effectiveDate = "2026-04-10";
    b.ngayKhongHopLe = ["effectiveDate"];
    expect(truongLoi(b)).toEqual(["do:effectiveDate", "vang:effectiveDate", "vang:signDate"]);
  });

  it("Bên B không phải công ty mình → vàng", () => {
    const b = mau();
    b.doiChieu.tenBenB = "Công ty TNHH Thép Việt";
    expect(truongLoi(b)).toEqual(["vang:tenBenB"]);
  });

  it("số HĐ đã có trong dự án (so không phân biệt dấu, khoảng trắng) → vàng", () => {
    expect(truongLoi(mau(), { ...NG, soHopDongDaCo: ["0704/2026/HDMB"] })).toEqual(["vang:contractNo"]);
  });

  it("trường AI tự nhận không chắc → vàng", () => {
    const b = mau();
    b.tinCayThap = ["giaTriSauVat"];
    expect(truongLoi(b)).toEqual(["vang:giaTriSauVat"]);
  });

  it("dòng trọn gói tự tạo → nhắc người duyệt", () => {
    const b = mau();
    b.hangMuc = [{ name: "Giá trị hợp đồng (trọn gói)", unit: "", qty: null, unitPrice: null, amount: 2_000_000_000, trang: null }];
    b.hangMucTuDong = true;
    expect(truongLoi(b)).toEqual(["vang:hangMuc"]);
  });
});

describe("bangChuKhop", () => {
  it("chấp nhận các cách viết tương đương", () => {
    expect(bangChuKhop("Bằng chữ: Hai tỷ, một trăm sáu mươi triệu đồng chẵn./.", [2_160_000_000])).toBe(true);
    expect(bangChuKhop("Một trăm hai mươi lăm nghìn đồng", [125_000])).toBe(true);
    expect(bangChuKhop("Một trăm hai mươi năm ngàn đồng", [125_000])).toBe(true);
    expect(bangChuKhop("Hai mươi tư triệu Việt Nam đồng", [24_000_000])).toBe(true);
    expect(bangChuKhop("Một triệu không trăm lẻ năm đồng", [1_000_005])).toBe(true);
  });

  it("khớp với bất kỳ số nào trong danh sách, bỏ qua null", () => {
    expect(bangChuKhop("Hai tỷ đồng", [null, 2_160_000_000, 2_000_000_000])).toBe(true);
    expect(bangChuKhop("Hai tỷ đồng", [null])).toBe(false);
  });

  it("chữ 'năm' trong 'Việt Nam' không bị hiểu thành số 5", () => {
    expect(chuanHoaBangChu("Năm triệu Việt Nam đồng")).toBe("nam trieu");
  });
});
