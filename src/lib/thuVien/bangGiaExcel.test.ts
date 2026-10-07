import { describe, expect, it } from "vitest";
import { docFileBangGia, taoFileBangGia } from "./bangGiaExcel";
import type { DongBangGiaDb } from "./bangGiaDb";

const bang: DongBangGiaDb[] = [
  {
    id: "1", ma: "AA.110", ten: "Thép tổ hợp", donVi: "kg", nhomMa: "AA",
    gia: { vatTu: 15000, nhanCongMay: 5000, heSo: 1.03, donGia: 20600 },
    hieuLucTu: new Date(2020, 0, 1),
  },
  { id: "2", ma: "AB.110", ten: "Bulong neo", donVi: "bộ", nhomMa: "AB", gia: null, hieuLucTu: null },
];

describe("file Excel bảng giá", () => {
  it("tải về rồi đọc lại ra đúng giá", async () => {
    const buf = await taoFileBangGia(bang).xlsx.writeBuffer();
    const kq = await docFileBangGia(buf as ArrayBuffer);
    expect(kq).toEqual({
      ok: true,
      dong: [
        { ma: "AA.110", vatTu: 15000, nhanCongMay: 5000, heSo: 1.03, donGia: 20600 },
        { ma: "AB.110", vatTu: null, nhanCongMay: null, heSo: null, donGia: null },
      ],
    });
  });

  it("đọc được số gõ dạng chữ kiểu Việt", async () => {
    const wb = taoFileBangGia(bang);
    wb.worksheets[0].getCell("H3").value = "215.000";
    const kq = await docFileBangGia((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(kq.ok && kq.dong[1].donGia).toBe(215000);
  });

  it("báo lỗi khi không phải khuôn bảng giá", async () => {
    const wb = taoFileBangGia([]);
    wb.worksheets[0].getRow(1).values = ["Khác"];
    const kq = await docFileBangGia((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(kq.ok).toBe(false);
  });
});
