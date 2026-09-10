import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Mặc định Next chỉ cho server action nhận body 1MB. Trang /import gửi nguyên
       * file Excel qua server action, mà file thật lớn nhất trong kho là 5,9MB
       * (THCPMau/THCP 20X30 Hà Tĩnh a Duyên.xlsx) — để nguyên 1MB thì phần lớn file
       * thật sẽ hỏng.
       *
       * 12MB = 10MB (giới hạn app tự đặt trong import/actions.ts) + phần bao gói của
       * multipart. Nới ở đây áp cho MỌI server action, nên cố ý không đặt cao hơn mức
       * thực sự cần.
       */
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
