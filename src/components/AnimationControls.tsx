// src/components/AnimationControls.tsx
import React from 'react';
import { Play, Pause, Square, Film, Image as ImageIcon, Gift, Share2 } from 'lucide-react';

interface AnimationControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  speedKps: number; // 1kmあたりの秒数
  onSpeedKpsChange: (newSpeedKps: number) => void;
}

const AnimationControls: React.FC<AnimationControlsProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  speedKps,
  onSpeedKpsChange
}) => {
  return (
    <div className="bg-slate-200 p-3 rounded-md shadow-lg h-auto md:h-[120px] flex flex-col justify-center"> {/* 高さをautoに、または調整 */}
      <h3 className="text-md font-semibold mb-2 text-center text-slate-700">アニメーション操作</h3>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2"> {/* レスポンシブ対応 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onPlayPause}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={onStop}
            className="p-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
            title="停止"
          >
            <Square size={20} />
          </button>
          <div className="flex items-center space-x-1">
            <label htmlFor="speed-kps-input" className="text-xs text-slate-700 whitespace-nowrap">速度 (秒/km):</label>
            <input
              type="number"
              id="speed-kps-input"
              min="1" max="60" step="1" // 例: 1kmあたり1秒から60秒
              value={speedKps}
              onChange={(e) => onSpeedKpsChange(parseFloat(e.target.value))}
              className="w-16 p-1 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        <div className="flex items-center space-x-1 flex-wrap justify-center gap-1 mt-2 sm:mt-0"> {/* レスポンシブ対応 */}
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
