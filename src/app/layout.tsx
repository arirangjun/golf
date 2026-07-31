import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { PWARegister } from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "스크린골프 예약",
  description: "PWA 기반 스크린골프 타임슬롯 예약 시스템",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "골프예약",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          {children}
          <PWARegister />
        </AuthProvider>
      </body>
    </html>
  );
}
