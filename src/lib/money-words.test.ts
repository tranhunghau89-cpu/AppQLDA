import { describe, expect, it } from "vitest";
import { docBaSo, docTienVietNam } from "./money-words";

describe("docBaSo", () => {
  it("đọc nhóm đứng đầu, bỏ số 0 thừa", () => {
    expect(docBaSo(5, false)).toBe("năm");
    expect(docBaSo(15, false)).toBe("mười lăm");
    expect(docBaSo(105, false)).toBe("một trăm linh năm");
    expect(docBaSo(999, false)).toBe("chín trăm chín mươi chín");
  });

  // Nhóm đứng sau phải đọc đủ, nếu không 1.000.005 thành "một triệu năm".
  it("nhóm đứng sau đọc đủ cả số 0 ở đầu", () => {
    expect(docBaSo(5, true)).toBe("không trăm linh năm");
    expect(docBaSo(15, true)).toBe("không trăm mười lăm");
  });

  it("ba biến âm bắt buộc: mốt, tư, lăm", () => {
    expect(docBaSo(21, false)).toBe("hai mươi mốt");
    expect(docBaSo(24, false)).toBe("hai mươi tư");
    expect(docBaSo(25, false)).toBe("hai mươi lăm");
  });

  // "mười lăm" chứ không phải "mười năm"; nhưng 11 là "mười một" chứ không "mười mốt".
  it("hàng chục bằng 1 đọc khác hàng chục lớn hơn", () => {
    expect(docBaSo(11, false)).toBe("mười một");
    expect(docBaSo(14, false)).toBe("mười bốn");
    expect(docBaSo(10, false)).toBe("mười");
  });

  it("tròn chục, tròn trăm không đọc thừa", () => {
    expect(docBaSo(20, false)).toBe("hai mươi");
    expect(docBaSo(100, false)).toBe("một trăm");
    expect(docBaSo(0, false)).toBe("");
  });
});

describe("docTienVietNam", () => {
  it("số tiền thường gặp trong hợp đồng", () => {
    expect(docTienVietNam(1_670_320_000)).toBe(
      "Một tỷ sáu trăm bảy mươi triệu ba trăm hai mươi nghìn đồng"
    );
    expect(docTienVietNam(847_825_000)).toBe(
      "Tám trăm bốn mươi bảy triệu tám trăm hai mươi lăm nghìn đồng"
    );
  });

  it("bỏ hẳn nhóm toàn số 0", () => {
    expect(docTienVietNam(1_000_000)).toBe("Một triệu đồng");
    expect(docTienVietNam(2_000_000_000)).toBe("Hai tỷ đồng");
  });

  // Chỗ dễ sai nhất: nhóm 0 ở GIỮA vẫn phải đọc.
  it("nhóm 0 ở giữa vẫn đọc đủ", () => {
    expect(docTienVietNam(1_000_005)).toBe("Một triệu không trăm linh năm đồng");
    expect(docTienVietNam(1_000_500)).toBe("Một triệu năm trăm đồng");
    expect(docTienVietNam(1_005)).toBe("Một nghìn không trăm linh năm đồng");
  });

  it("viết hoa chữ đầu và luôn kết bằng đồng", () => {
    expect(docTienVietNam(5)).toBe("Năm đồng");
    expect(docTienVietNam(0)).toBe("Không đồng");
  });

  // Hợp đồng không ghi số lẻ dưới đồng.
  it("làm tròn tới đồng", () => {
    expect(docTienVietNam(1000.4)).toBe("Một nghìn đồng");
    expect(docTienVietNam(1000.6)).toBe("Một nghìn không trăm linh một đồng");
  });

  it("số âm có tiền tố Âm", () => {
    expect(docTienVietNam(-1_000_000)).toBe("Âm một triệu đồng");
  });

  // Chuỗi rỗng để giao diện tự bỏ dòng "Bằng chữ" thay vì in ra NaN.
  it("giá trị không đọc được trả chuỗi rỗng", () => {
    expect(docTienVietNam(null)).toBe("");
    expect(docTienVietNam(undefined)).toBe("");
    expect(docTienVietNam(NaN)).toBe("");
    expect(docTienVietNam(Infinity)).toBe("");
  });

  it("đọc được tới hàng nghìn tỷ", () => {
    expect(docTienVietNam(1_500_000_000_000)).toBe("Một nghìn năm trăm tỷ đồng");
  });
});

// Từ tỷ trở lên tiếng Việt KHÔNG chia tiếp thành "nghìn tỷ"/"triệu tỷ" như cách chia
// nhóm 3 chữ số máy móc — toàn bộ phần trên 10⁹ gộp thành một con số rồi mới đọc "tỷ".
describe("docTienVietNam — phần từ tỷ trở lên", () => {
  it("không tách thành nghìn tỷ + tỷ", () => {
    expect(docTienVietNam(1_500_000_000_000)).toBe("Một nghìn năm trăm tỷ đồng");
    expect(docTienVietNam(2_000_000_000_000)).toBe("Hai nghìn tỷ đồng");
  });

  it("phần dưới tỷ vẫn đọc đủ khi có phần tỷ đứng trước", () => {
    expect(docTienVietNam(1_000_000_005)).toBe("Một tỷ không trăm linh năm đồng");
    expect(docTienVietNam(1_005_000_000)).toBe("Một tỷ không trăm linh năm triệu đồng");
    expect(docTienVietNam(1_500_000_000)).toBe("Một tỷ năm trăm triệu đồng");
  });
});
