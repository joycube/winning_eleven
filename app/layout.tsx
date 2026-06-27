import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

// 🔒 [Day 1 — Next.js 14 호환] viewport/themeColor 를 별도 export 로 분리
//   Next 14 부터 metadata.viewport / metadata.themeColor 는 deprecated → 새 Viewport export 사용
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020617",
};

export const metadata: Metadata = {
  title: "eFootball™ Live evolution™",
  description: "Join the League! eFootball Super League Management System.",
  manifest: "/manifest.json", // 🔥 스마트폰이 앱으로 인식하게 만드는 마법의 한 줄 추가
  openGraph: {
    title: "eFootball™ Live evolution™",
    description: "eFootball 2025 기반 리그 매니지먼트 시스템",
    url: "https://friends-league-iota.vercel.app/",
    siteName: "eFootball Live Evolution",
    images: [
      {
        url: "https://www.konami.com/efootball/s/img/main_page_1.png",
        width: 1200,
        height: 630,
        alt: "eFootball Main",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  icons: {
    icon: "/icon.webp",
    shortcut: "/icon.webp",
    apple: "/icon.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-[#020617] text-white">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
