import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#5F7C69',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'GuessWhat —— 双人实时在线猜词',
  description: '双人实时在线是非推理猜词游戏。',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GuessWhat',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
