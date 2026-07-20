import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "문서체크 | 행정 문서 사전 검토",
  description: "행정 문서의 필수 항목 누락을 배포 전에 확인하는 프로토타입",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
