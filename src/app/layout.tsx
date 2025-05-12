// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google"; // Noto Sans JP を追加
import "./globals.css";

// フォント設定
const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-inter", // CSS変数としてInterを利用可能に
});

const notoSansJP = Noto_Sans_JP({ // Noto Sans JP の設定
  subsets: ["latin"], // 'japanese' サブセットも利用可能だが、ファイルサイズが大きくなる
  weight: ["400", "700"], // 使用するウェイトを指定
  display: 'swap',
  variable: "--font-noto-sans-jp", // CSS変数としてNoto Sans JPを利用可能に
});

// アプリケーションのメタデータ
export const metadata: Metadata = {
  title: "旅行経路アニメーション生成",
  description: "地図上に旅行の経路をアニメーションで表示するWebアプリケーションです。出発地、目的地、経由地、移動手段を設定して、ルートアニメーションを簡単に作成できます。",
  keywords: ["旅行", "経路", "アニメーション", "地図", "ルートプランナー", "ルートジェネレーター"],
  authors: [{ name: "Your Name or App Name" }], // あなたの名前やアプリ名に置き換えてください
  // OGPタグなどの設定もここに追加できます
  // openGraph: {
  //   title: "旅行経路アニメーション生成",
  //   description: "地図上に旅行の経路をアニメーションで表示するWebアプリ",
  //   type: "website",
  //   url: "https://example.com", // あなたのアプリのURLに置き換えてください
  //   images: [{ url: "https://example.com/og-image.png" }], // OGP画像のURL
  // },
};

// ビューポート設定
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // ピンチズームを無効化する場合 (モバイルでの操作性考慮)
  userScalable: false, // 同上
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // classNameをhtmlタグに適用し、フォント変数を結合
    // globals.css で :root { font-family: var(--font-noto-sans-jp), var(--font-inter), sans-serif; } のように指定
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
      <body className="antialiased bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors duration-300">
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
