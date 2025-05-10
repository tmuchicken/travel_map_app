import type { Metadata, Viewport } from "next"; // Viewport をインポート
import { Inter } from "next/font/google"; // 要件定義に合わせて Inter フォントに変更 (Geistでも良いですが一例)
import "./globals.css";

// Inter フォントの設定 (Geist Sans の代わりに Inter を使用する例)
const inter = Inter({
  subsets: ["latin"],
  display: 'swap', // フォント読み込み中の挙動を指定
  variable: "--font-inter", // CSS変数として利用
});

// アプリケーションのメタデータ設定
export const metadata: Metadata = {
  title: "旅行経路アニメーション", // アプリケーションのタイトルに変更
  description: "地図上に旅行の経路をアニメーションで表示するWebアプリ", // アプリケーションの説明に変更
  // openGraph や twitter などのメタデータもここに追加できます
};

// ビューポート設定
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // maximumScale: 1, // 必要に応じて
  // userScalable: false, // 必要に応じて
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja"> {/* 言語を "ja" に変更 */}
      <body className={`${inter.variable} antialiased`}> {/* Inter フォントを適用 */}
        {children}
      </body>
    </html>
  );
}
