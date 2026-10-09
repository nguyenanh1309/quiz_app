import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ứng dụng này luôn đọc dữ liệu mới nhất từ database nên không bật Cache Components.
  cacheComponents: false,
  experimental: {
    serverActions: {
      // Cho phép upload file Word/Excel lớn hơn 1MB mặc định
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: ["mammoth", "exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
