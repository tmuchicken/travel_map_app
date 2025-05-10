// src/app/page.tsx
"use client"; // App Routerでクライアントコンポーネントを明示するために必要

import dynamic from 'next/dynamic';
import React from 'react';

// Mapコンポーネントをクライアントサイドでのみレンダリングするためにdynamic importを使用
// Leafletはwindowオブジェクトに依存するため、サーバーサイドレンダリング(SSR)を避ける
const MapWithNoSSR = dynamic(() => import('@/components/Map'), { // '@/components/Map' は src/components/Map.tsx を指す想定
  ssr: false, // サーバーサイドレンダリングを無効にする
  loading: () => <p style={{ textAlign: 'center', paddingTop: '20px' }}>地図を読み込み中です...</p> // ローディング中に表示するコンポーネント
});

export default function HomePage() {
  return (
    // <Head> コンポーネントは layout.tsx での metadata 設定に移行するため削除
    <main style={{ height: '100vh', width: '100vw', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/*
        ヘッダーなどを追加する場合は、ここのレイアウトを調整します。
        例:
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', backgroundColor: '#333', color: 'white', padding: '10px', zIndex: 1000, textAlign: 'center' }}>
          旅行経路アニメーション
        </div>
        <div style={{ paddingTop: '50px', height: 'calc(100vh - 50px)'}}> // ヘッダー分の高さを確保
          <MapWithNoSSR />
        </div>
      */}
      <MapWithNoSSR />
    </main>
  );
}
