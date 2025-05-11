// src/components/Header.tsx
import React, { useState } from 'react';
import { HelpCircle, Moon, Sun } from 'lucide-react'; // lucide-react からアイコンをインポート

const Header: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false); // ダークモードの状態管理（実際の機能は未実装）

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // ここに実際のダークモード切り替えロジックを実装します
    // 例: document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="bg-slate-200 text-slate-800 p-3 shadow-md flex items-center justify-between h-[80px]">
      <div className="flex items-center">
        <button
          aria-label="ヘルプ"
          className="p-2 rounded-full hover:bg-slate-300 transition-colors mr-3"
        >
          <HelpCircle size={28} className="text-blue-600" />
        </button>
        <h1 className="text-2xl font-bold">旅行経路アニメーション生成</h1>
      </div>
      <div className="flex items-center">
        <span className="text-xs mr-2 text-gray-600">ダークモード</span>
        <button
          onClick={toggleDarkMode}
          aria-label="ダークモード切り替え"
          className={`w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out ${
            darkMode ? 'bg-slate-600' : 'bg-slate-400'
          }`}
        >
          <div
            className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
              darkMode ? 'translate-x-7' : ''
            }`}
          ></div>
        </button>
        {/* アイコン表示の例 (オプション) */}
        {/* <div className="ml-2">
          {darkMode ? <Moon size={20} className="text-yellow-300"/> : <Sun size={20} className="text-yellow-500"/>}
        </div> */}
      </div>
    </header>
  );
};

export default Header;
