import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://docuflow-check-ksj03.workspace-658429.chatgpt.site";
  const title = "DocuFlow | AI 문서 초안 작성";
  const description = "문서 종류를 고르고 필요한 정보만 입력하면 AI가 공지문, 신청서, 기획서, 보고서 등의 초안을 작성합니다.";

  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og-v2.png`, width: 1730, height: 909, alt: "DocuFlow AI 문서 초안 작성 도구" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-v2.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
