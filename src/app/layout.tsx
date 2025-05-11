// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // プロジェクトで使用しているフォントに合わせてください
import "./globals.css";

// フォント設定
const inter = Inter({
  subsets: ["latin"],
  display: 'swap', // フォント読み込み戦略
  variable: "--font-inter", // CSS変数として使用 (globals.cssで利用)
});

// アプリケーションのメタデータ
export const metadata: Metadata = {
  title: "旅行経路アニメーション",
  description: "地図上に旅行の経路をアニメーションで表示するWebアプリ",
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
    // classNameをhtmlタグに適用し、bodyタグはシンプルに
    // <html>と<body>の間に余計なスペースや改行がないことを確認
    <html lang="ja" className={inter.variable}>
      <body className="antialiased">
        {/*
          ここに {children} 以外のテキストノード (スペースや文字列など) を
          直接記述しないように注意してください。
          もし追加のラッパーdivなどが必要な場合は、
          {children} をそのラッパーで囲んでください。
        */}
        {children}
      </body>
    </html>
  );
}
