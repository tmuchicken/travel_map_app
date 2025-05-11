// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // または Geist など、プロジェクトで使用しているフォント
import "./globals.css";

// フォント設定
const inter = Inter({
  subsets: ["latin"],
  display: 'swap', // フォント読み込み戦略
  variable: "--font-inter", // CSS変数として使用
});

// アプリケーションのメタデータ
export const metadata: Metadata = {
  title: "旅行経路アニメーション",
  description: "地図上に旅行の経路をアニメーションで表示するWebアプリ",
  // viewportは別途 viewport オブジェクトで設定するため、ここからは削除してもOK
};

// ビューポート設定
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // JSX内の不要なスペースや改行に注意
    <html lang="ja" className={inter.variable}> {/* フォント変数をhtmlタグに適用するのも一般的 */}
      <body className={`antialiased`}> {/* bodyタグのclassNameをシンプルに */}
        {/*
          classNameの動的な部分 (${inter.variable} など) が
          サーバーとクライアントで初期レンダリング時に完全に一致することが重要です。
          next/font の 'variable' オプションはこのために設計されています。
        */}
        {children}
      </body>
    </html>
  );
}
