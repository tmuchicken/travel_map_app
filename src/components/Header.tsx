// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import { HelpCircle, Moon, Sun } from 'lucide-react';

const Header: React.FC = () => {
  // ダークモードの状態をlocalStorageから読み込むか、OSの設定に合わせる(オプション)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('darkMode');
      if (savedMode) return savedMode === 'true';
      // OSのテーマ設定を検知 (オプション)
      // return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false; // デフォルトはライトモード
  });

  // ダークモードの状態が変更されたらlocalStorageに保存し、<html>タグにクラスを適用
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

  // ヘルプボタンの機能 (例: モーダル表示など)
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
          {/* 修正点: md:size={28} を削除し、size={28} に統一 (または size={26} を使用) */}
          <HelpCircle size={28} className="text-blue-600 dark:text-blue-400" />
        </button>
        <h1 className="text-xl md:text-2xl font-bold">旅行経路アニメーション</h1>
      </div>
      <div className="flex items-center">
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
