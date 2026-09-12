import { describe, expect, it } from "vitest";
import {
  chonDonGia,
  nhanTroiGia,
  phatHienTroiGia,
  type DongGiaUngVien,
} from "./gia";

const NGAY = new Date("2026-06-01T00:00:00Z");

function ungVien(p: Partial<DongGiaUngVien> & { id: string }): DongGiaUngVien {
  return {
    congTacId: "ct1",
    congTacVatTuId: null,
    khuVucId: null,
    donGia: 100,
    hieuLucTu: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...p,
  };
}

describe("chonDonGia — độ khớp", () => {
  const chung = ungVien({ id: "a", donGia: 100 });
  const theoKhuVuc = ungVien({ id: "b", khuVucId: "kv1", donGia: 110 });
  const theoBienThe = ungVien({ id: "c", congTacVatTuId: "bt1", donGia: 120 });
  const caHai = ungVien({
    id: "d",
    congTacVatTuId: "bt1",
    khuVucId: "kv1",
    donGia: 130,
  });
  const tatCa = [chung, theoKhuVuc, theoBienThe, caHai];

  it("biến thể + khu vực thắng tất cả", () => {
    const kq = chonDonGia(tatCa, {
      congTacId: "ct1",
      congTacVatTuId: "bt1",
      khuVucId: "kv1",
      ngay: NGAY,
    });
    expect(kq.donGiaId).toBe("d");
    expect(kq.donGia).toBe(130);
    expect(kq.doKhop).toBe("BIEN_THE_KHU_VUC");
    expect(kq.canhBao).toEqual([]);
  });

  it("biến thể thắng khu vực khi chỉ có một trong hai khớp đủ", () => {
    const kq = chonDonGia([chung, theoKhuVuc, theoBienThe], {
      congTacId: "ct1",
      congTacVatTuId: "bt1",
      khuVucId: "kv1",
      ngay: NGAY,
    });
    expect(kq.donGiaId).toBe("c");
    expect(kq.doKhop).toBe("BIEN_THE");
  });

  it("khu vực thắng giá chung", () => {
    const kq = chonDonGia([chung, theoKhuVuc], {
      congTacId: "ct1",
      khuVucId: "kv1",
      ngay: NGAY,
    });
    expect(kq.donGiaId).toBe("b");
    expect(kq.doKhop).toBe("KHU_VUC");
  });

  it("không khai gì thì rơi về giá chung", () => {
    const kq = chonDonGia(tatCa, { congTacId: "ct1", ngay: NGAY });
    expect(kq.donGiaId).toBe("a");
    expect(kq.doKhop).toBe("CHUNG");
  });
});

describe("chonDonGia — loại ứng viên mâu thuẫn", () => {
  it("dòng khai KHÁC khu vực bị loại hẳn, không phải hạ điểm", () => {
    const khacKhuVuc = ungVien({ id: "x", khuVucId: "kv-khac", donGia: 999 });
    const chung = ungVien({ id: "a", donGia: 100 });
    const kq = chonDonGia([khacKhuVuc, chung], {
      congTacId: "ct1",
      khuVucId: "kv1",
      ngay: NGAY,
    });
    expect(kq.donGiaId).toBe("a");
    expect(kq.donGia).toBe(100);
  });

  it("dòng khai KHÁC biến thể bị loại hẳn", () => {
    const khacBienThe = ungVien({ id: "x", congTacVatTuId: "bt-khac", donGia: 999 });
    const chung = ungVien({ id: "a", donGia: 100 });
    const kq = chonDonGia([khacBienThe, chung], {
      congTacId: "ct1",
      congTacVatTuId: "bt1",
      ngay: NGAY,
    });
    expect(kq.donGiaId).toBe("a");
  });

  it("hỏi giá chung thì dòng khai riêng khu vực KHÔNG được dùng", () => {
    const theoKhuVuc = ungVien({ id: "b", khuVucId: "kv1", donGia: 110 });
    const kq = chonDonGia([theoKhuVuc], { congTacId: "ct1", ngay: NGAY });
    expect(kq.doKhop).toBe("KHONG_CO");
    expect(kq.donGia).toBeNull();
  });

  it("dòng của công tác khác không bao giờ lọt vào", () => {
    const congTacKhac = ungVien({ id: "z", congTacId: "ct2", donGia: 999 });
    const kq = chonDonGia([congTacKhac], { congTacId: "ct1", ngay: NGAY });
    expect(kq.doKhop).toBe("KHONG_CO");
  });
});

describe("chonDonGia — hiệu lực theo thời gian", () => {
  it("lấy bản mới nhất còn hiệu lực", () => {
    const cu = ungVien({
      id: "cu",
      donGia: 100,
      hieuLucTu: new Date("2026-01-01T00:00:00Z"),
    });
    const moi = ungVien({
      id: "moi",
      donGia: 120,
      hieuLucTu: new Date("2026-05-01T00:00:00Z"),
    });
    const kq = chonDonGia([cu, moi], { congTacId: "ct1", ngay: NGAY });
    expect(kq.donGiaId).toBe("moi");
    expect(kq.donGia).toBe(120);
  });

  it("bỏ qua bản chưa tới ngày hiệu lực", () => {
    const tuongLai = ungVien({
      id: "sau",
      donGia: 200,
      hieuLucTu: new Date("2026-12-01T00:00:00Z"),
    });
    const hienHanh = ungVien({ id: "nay", donGia: 120 });
    const kq = chonDonGia([tuongLai, hienHanh], { congTacId: "ct1", ngay: NGAY });
    expect(kq.donGiaId).toBe("nay");
  });

  it("biên hieuLucTu là BAO GỒM — đúng ngày hiệu lực thì đã áp dụng", () => {
    const dungNgay = ungVien({ id: "d", donGia: 150, hieuLucTu: NGAY });
    const kq = chonDonGia([dungNgay], { congTacId: "ct1", ngay: NGAY });
    expect(kq.donGiaId).toBe("d");
  });

  it("giá riêng khu vực CŨ vẫn thắng giá chung MỚI", () => {
    const chungMoi = ungVien({
      id: "chung",
      donGia: 500,
      hieuLucTu: new Date("2026-05-01T00:00:00Z"),
    });
    const khuVucCu = ungVien({
      id: "kv",
      khuVucId: "kv1",
      donGia: 300,
      hieuLucTu: new Date("2026-01-01T00:00:00Z"),
    });
    const kq = chonDonGia([chungMoi, khuVucCu], {
      congTacId: "ct1",
      khuVucId: "kv1",
      ngay: NGAY,
    });
    expect(kq.donGiaId).toBe("kv");
  });
});

describe("chonDonGia — không có giá", () => {
  it("danh sách rỗng trả KHONG_CO, không NaN", () => {
    const kq = chonDonGia([], { congTacId: "ct1", ngay: NGAY });
    expect(kq).toMatchObject({ donGia: null, donGiaId: null, doKhop: "KHONG_CO" });
    expect(kq.canhBao.length).toBeGreaterThan(0);
  });

  it("mọi bản đều chưa hiệu lực trả KHONG_CO", () => {
    const sau = ungVien({ id: "s", hieuLucTu: new Date("2027-01-01T00:00:00Z") });
    expect(chonDonGia([sau], { congTacId: "ct1", ngay: NGAY }).doKhop).toBe("KHONG_CO");
  });
});

describe("chonDonGia — cảnh báo", () => {
  it("hỏi theo khu vực nhưng chỉ có giá chung thì báo rõ", () => {
    const chung = ungVien({ id: "a" });
    const kq = chonDonGia([chung], { congTacId: "ct1", khuVucId: "kv1", ngay: NGAY });
    expect(kq.doKhop).toBe("CHUNG");
    expect(kq.canhBao.join(" ")).toContain("khu vực");
  });

  it("hỏi theo biến thể nhưng chỉ có giá chung thì báo rõ", () => {
    const chung = ungVien({ id: "a" });
    const kq = chonDonGia([chung], {
      congTacId: "ct1",
      congTacVatTuId: "bt1",
      ngay: NGAY,
    });
    expect(kq.canhBao.join(" ")).toContain("vật liệu");
  });
});

describe("chonDonGia — tất định", () => {
  const ds = [
    ungVien({ id: "b2", donGia: 100 }),
    ungVien({ id: "a1", donGia: 100 }),
    ungVien({ id: "c3", donGia: 100 }),
  ];

  it("cùng điểm, cùng ngày → id nhỏ nhất, bất kể thứ tự đầu vào", () => {
    for (let i = 0; i < 100; i++) {
      const xao = [...ds].sort(() => Math.random() - 0.5);
      expect(chonDonGia(xao, { congTacId: "ct1", ngay: NGAY }).donGiaId).toBe("a1");
    }
  });

  it("không làm thay đổi mảng đầu vào", () => {
    const goc = [...ds];
    chonDonGia(ds, { congTacId: "ct1", ngay: NGAY });
    expect(ds).toEqual(goc);
  });
});

describe("phatHienTroiGia", () => {
  it("bằng nhau thì không trôi", () => {
    expect(phatHienTroiGia(185000, 185000).coTroi).toBe(false);
  });

  it("khác nhau thì trôi và giữ cả hai con số", () => {
    const kq = phatHienTroiGia(185000, 192000);
    expect(kq).toMatchObject({ coTroi: true, cu: 185000, moi: 192000 });
  });

  it("chưa chụp giá thư viện thì không trôi", () => {
    expect(phatHienTroiGia(null, 192000).coTroi).toBe(false);
  });

  it("thư viện không còn giá thì không trôi", () => {
    expect(phatHienTroiGia(185000, null).coTroi).toBe(false);
  });

  it("lệch dưới một đồng là sai số làm tròn, không phải trôi giá", () => {
    expect(phatHienTroiGia(185000, 185000.4).coTroi).toBe(false);
  });
});

describe("nhanTroiGia", () => {
  it("in ra hai con số kiểu Việt", () => {
    expect(nhanTroiGia(185000, 192000)).toBe("Đơn giá TV đã đổi: 185.000 → 192.000");
  });
});
