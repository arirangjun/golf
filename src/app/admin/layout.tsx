import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "스크린골프 관리",
  description: "관리자용 스크린골프 예약 관리",
  manifest: "/admin/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "골프관리",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
