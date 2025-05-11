// src/components/AnimationControls.tsx
import React from 'react';
import { Play, Square, Download, Share2, Film, Image as ImageIcon, Gift } from 'lucide-react'; // アイコン

const AnimationControls: React.FC = () => {
  return (
    <div className="bg-slate-200 p-3 rounded-md shadow-lg h-[120px] flex flex-col justify-center">
      <h3 className="text-md font-semibold mb-2 text-center text-slate-700">アニメーション操作</h3>
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-2">
          <button className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors" title="再生">
            <Play size={20} />
          </button>
          <button className="p-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors" title="停止">
            <Square size={20} />
          </button>
          <div className="flex items-center space-x-1">
            <label htmlFor="speed-slider" className="text-xs text-slate-600">速度:</label>
            <input type="range" id="speed-slider" min="0.5" max="2" step="0.1" defaultValue="1" className="w-24 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center">
            <ImageIcon size={14} className="mr-1"/>画像保存
          </button>
          <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center">
            <Film size={14} className="mr-1"/>動画出力
          </button>
           <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center">
            <Gift size={14} className="mr-1"/>GIF出力
          </button>
          <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center">
            <Share2 size={14} className="mr-1"/>SNS共有
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
