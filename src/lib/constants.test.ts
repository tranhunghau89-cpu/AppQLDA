import { describe, expect, it } from "vitest";
import {
  ESTIMATE_GROUP_MAP,
  NHOM_MA_SANG_NHOM_CHI_PHI,
  WORK_GROUP,
  nhomChiPhiTheoNhomMa,
  workGroupOf,
} from "./constants";

describe("nhomChiPhiTheoNhomMa", () => {
  it("mọi nhóm mã trong danh mục đều có nhóm chi phí", () => {
    for (const g of WORK_GROUP) {
      expect(NHOM_MA_SANG_NHOM_CHI_PHI[g.value], `thiếu ánh xạ cho ${g.value}`).toBeTypeOf(
        "string"
      );
    }
  });

  it("mọi nhóm chi phí ánh xạ ra đều là nhóm dự toán có thật", () => {
    for (const v of Object.values(NHOM_MA_SANG_NHOM_CHI_PHI)) {
      expect(ESTIMATE_GROUP_MAP[v], `nhóm chi phí lạ: ${v}`).toBeDefined();
    }
  });

  it("ánh xạ đúng nghiệp vụ đã chốt", () => {
    expect(nhomChiPhiTheoNhomMa("AA")).toBe("KCT");
    expect(nhomChiPhiTheoNhomMa("AB")).toBe("BL_NEO");
    expect(nhomChiPhiTheoNhomMa("AC")).toBe("BLLK");
    expect(nhomChiPhiTheoNhomMa("AD")).toBe("TON");
    expect(nhomChiPhiTheoNhomMa("AE")).toBe("VT_PHU");
    // Sàn decking mua cùng nhà cán tôn, nên gom vào nhóm TÔN chứ không phải KCT.
    expect(nhomChiPhiTheoNhomMa("AF")).toBe("TON");
    expect(nhomChiPhiTheoNhomMa("AG")).toBe("VAN_CHUYEN");
    expect(nhomChiPhiTheoNhomMa("AK")).toBe("NHAN_CONG");
    expect(nhomChiPhiTheoNhomMa("AL")).toBe("KHAC");
  });

  it("nhóm lạ, rỗng hay chữ thường đều không làm vỡ", () => {
    expect(nhomChiPhiTheoNhomMa("ZZ")).toBe("KHAC");
    expect(nhomChiPhiTheoNhomMa("")).toBe("KHAC");
    expect(nhomChiPhiTheoNhomMa(null)).toBe("KHAC");
    expect(nhomChiPhiTheoNhomMa(undefined)).toBe("KHAC");
    expect(nhomChiPhiTheoNhomMa("aa")).toBe("KCT");
  });

  it("nối được với workGroupOf: từ mã công tác ra thẳng nhóm chi phí", () => {
    expect(nhomChiPhiTheoNhomMa(workGroupOf("AD.210"))).toBe("TON");
    expect(nhomChiPhiTheoNhomMa(workGroupOf("AA.110"))).toBe("KCT");
    // Mã không thuộc nhóm nào -> workGroupOf trả "AL" -> KHAC.
    expect(nhomChiPhiTheoNhomMa(workGroupOf("XX.999"))).toBe("KHAC");
  });
});
