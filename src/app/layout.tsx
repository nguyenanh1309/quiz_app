import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/latin-500.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiểm tra trực tuyến",
  description: "Giao bài trắc nghiệm, tự chấm điểm và theo dõi kết quả theo lớp",
};

// Mọi trang đều đọc dữ liệu mới nhất từ database
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white font-sans">{children}</body>
    </html>
  );
}
