// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import PreviewOutput from '@/components/PreviewOutput';

// Mapコンポーネントをクライアントサイドでのみレンダリング
const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full bg-gray-200"><p>地図を読み込み中です...</p></div>,
});

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen bg-gray-100 antialiased"> {/* 画面全体の背景色を明るいグレーに */}
      <Header />
      <div className="flex flex-1 overflow-hidden pt-2 px-2 pb-2 space-x-2"> {/* ヘッダー以下のメインコンテンツエリア */}
        {/* 左パネル：経路入力とプロジェクト操作 */}
        <div className="w-[380px] flex-shrink-0 flex flex-col space-y-2"> {/* 左パネルの幅を固定し、縦にコンポーネントを配置 */}
          <ControlPanel className="flex-grow" /> {/* ControlPanelが利用可能な高さを取る */}
        </div>

        {/* 右パネル：地図表示とアニメーション操作 */}
        <div className="flex-1 flex flex-col space-y-2"> {/* 右パネルが残りの幅を取り、縦にコンポーネントを配置 */}
          <main className="flex-1 bg-white rounded-md shadow"> {/* 地図エリア */}
            <MapWithNoSSR />
          </main>
          <AnimationControls />
        </div>
      </div>
      <PreviewOutput /> {/* 画面下部のプレビュー・出力設定エリア */}
    </div>
  );
}
