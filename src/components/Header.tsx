// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import { HelpCircle, Moon, Sun, Layers } from 'lucide-react';
import type { TileLayerData } from '@/config/mapLayers';

interface HeaderProps {
  availableTileLayers: TileLayerData[];
  selectedTileLayerId: string;
  onTileLayerChange: (newId: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  availableTileLayers,
  selectedTileLayerId,
  onTileLayerChange,
}) => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('darkMode');
      if (savedMode) return savedMode === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', String(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleHelpClick = () => {
    alert(
      "旅行経路アニメーション生成アプリへようこそ！\n\n" +
      "使い方:\n" +
      "1. 「出発地」と「目的地」に地名を入力し、「検索」ボタンで座標を取得します。\n" +
      "2. 必要に応じて「中継地点を追加」ボタンで経由地を設定します。\n" +
      "3. 各地点間の「移動手段」を選択します。\n" +
      "4. 「ルートを生成/更新」ボタンを押すと、地図上に経路が表示されます。\n" +
      "5. 「アニメーション操作」で再生速度を設定し、「再生」ボタンでアニメーションを開始します。\n" +
      "6. 「プロジェクト操作」で現在の設定を保存したり、以前保存した設定を読み込んだりできます。\n\n" +
      "注意:\n" +
      "- 経路検索にはOSRMのデモサーバーを使用しています。本番環境での利用には適していません。\n" +
      "- ジオコーディング(地名からの座標検索)にはNominatimを使用しています。利用規約を守ってご利用ください。"
    );
  };

  return (
    <header className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-3 shadow-md flex items-center justify-between h-[70px] md:h-[80px]">
      <div className="flex items-center">
        <button
          onClick={handleHelpClick}
          aria-label="ヘルプ"
          className="p-2 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors mr-2 md:mr-3"
        >
          <HelpCircle size={28} className="text-blue-600 dark:text-blue-400" />
        </button>
        <h1 className="text-xl md:text-2xl font-bold">旅行経路アニメーション</h1>
      </div>
      <div className="flex items-center space-x-2 md:space-x-3">
        <div className="flex items-center">
          {/* ▼▼▼ 修正箇所 ▼▼▼ */}
          <span title="地図スタイル"> {/* Layersアイコンをspanで囲み、title属性をspanに付与 */}
            <Layers size={18} className="text-slate-600 dark:text-slate-400 mr-1 hidden sm:inline-block" />
          </span>
          {/* ▲▲▲ 修正箇所 ▲▲▲ */}
          <select
            value={selectedTileLayerId}
            onChange={(e) => onTileLayerChange(e.target.value)}
            className="bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs sm:text-sm rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-6"
            title="地図スタイルを選択" // select要素のtitleは残しても良い
            style={{ backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' class='w-5 h-5'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z' clip-rule='evenodd' /%3E%3C/svg%3E")`}}
          >
            {availableTileLayers.map(layer => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={toggleDarkMode}
          aria-label="ダークモード切り替え"
          className="p-2 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          title={darkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {darkMode ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20} className="text-slate-600"/>}
        </button>
      </div>
    </header>
  );
};

export default Header;