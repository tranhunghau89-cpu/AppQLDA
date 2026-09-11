import { describe, expect, it } from "vitest";
import { soOThieu, thongTinIn, type NguonThongTin } from "./clientQuoteInfo";

function q(p: Partial<NguonThongTin> = {}): NguonThongTin {
  return {
    recipient: "Công ty CP ABC",
    customerPhone: "0901234567",
    location: "Hà Nội",
    scope: "Kết cấu thép và bao che",
    quoteDate: "2026-09-11T00:00:00.000Z",
    validDays: 7,
    expiryDate: "2026-09-18T00:00:00.000Z",
    salesName: "Trần Hùng",
    salesPhone: "0912345678",
    salesEmail: "hung@xaydungdubai.com.vn",
    ...p,
  };
}

const oCua = (nhan: string, n: NguonThongTin) =>
  thongTinIn(n).find((x) => x.nhan === nhan)!;

describe("thongTinIn", () => {
  it("điền đủ thì không thiếu ô nào", () => {
    expect(soOThieu(thongTinIn(q()))).toBe(0);
  });

  it("đếm đúng số ô còn trống", () => {
    const o = thongTinIn(q({ salesPhone: null, customerPhone: "", location: null }));
    expect(soOThieu(o)).toBe(3);
    expect(oCua("SĐT phụ trách", q({ salesPhone: null })).giaTri).toBe("");
  });

  it("chuỗi toàn khoảng trắng tính là chưa điền", () => {
    // Trên giấy thì một dấu cách cũng là chỗ trống.
    for (const v of ["   ", "\t", "\n "]) {
      expect(oCua("Hạng mục", q({ scope: v })).giaTri).toBe("");
    }
  });

  it("hiệu lực 0 ngày là giá trị thật, không phải chỗ trống", () => {
    const o = oCua("Hiệu lực", q({ validDays: 0, expiryDate: null }));
    expect(o.giaTri).toBe("0 ngày");
  });

  it("có hạn thì ghi kèm ngày hết hiệu lực", () => {
    expect(oCua("Hiệu lực", q()).giaTri).toBe("7 ngày · đến 18/09/2026");
  });

  it("chưa đặt số ngày hiệu lực thì là chưa điền", () => {
    expect(oCua("Hiệu lực", q({ validDays: null })).giaTri).toBe("");
  });

  it("ngày báo giá in kiểu Việt Nam, rỗng hoặc hỏng thì là chưa điền", () => {
    expect(oCua("Ngày báo giá", q()).giaTri).toBe("11/09/2026");
    expect(oCua("Ngày báo giá", q({ quoteDate: null })).giaTri).toBe("");
    expect(oCua("Ngày báo giá", q({ quoteDate: "khong-phai-ngay" })).giaTri).toBe("");
  });

  it("đủ 9 ô và không ô nào trùng nhãn", () => {
    // Thêm trường in ra mà quên thêm vào đây thì ô đó lại vô hình như cũ. Còn hai ô
    // trùng nhãn ("SĐT" của khách và của người phụ trách) thì nhìn vào không biết ô
    // nào đang trống.
    const o = thongTinIn(q());
    expect(o).toHaveLength(9);
    expect(new Set(o.map((x) => x.nhan)).size).toBe(9);
  });
});
