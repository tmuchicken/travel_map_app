// src/components/AnimationControls.tsx
import React from 'react';
import { Play, Pause, Square, Film, Image as ImageIcon, Gift, Share2 } from 'lucide-react';

interface AnimationControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  speedKps: number; // 1kmあたりの秒数 (1-60の範囲を想定)
  onSpeedKpsChange: (newSpeedKps: number) => void;
}

const AnimationControls: React.FC<AnimationControlsProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  speedKps,
  onSpeedKpsChange
}) => {

  const handleSpeedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let newSpeed = parseInt(rawValue, 10);

    if (isNaN(newSpeed)) {
      // 空文字などの場合は、親コンポーネントに最小値を渡すなどして処理
      // ここでは、 onSpeedKpsChange を呼ばないか、またはデフォルト値で呼ぶ
      if (rawValue === "") {
         onSpeedKpsChange(1); // 例: 空なら1にする
      }
      return;
    }
    // 最小値1、最大値60に丸める (親コンポーネントでもバリデーション推奨)
    newSpeed = Math.max(1, Math.min(60, newSpeed));
    onSpeedKpsChange(newSpeed);
  };

  // 速度入力フィールドからフォーカスが外れた時の処理
  const handleSpeedInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let newSpeed = parseInt(rawValue, 10);

    if (isNaN(newSpeed) || newSpeed < 1) {
      newSpeed = 1; // 不正な値なら最小値1に
    } else if (newSpeed > 60) {
      newSpeed = 60; // 最大値超過なら60に
    }
    onSpeedKpsChange(newSpeed); // 親コンポーネントに最終的な値を通知
  };


  return (
    <div className="bg-slate-200 p-3 rounded-md shadow-lg h-auto flex flex-col justify-center">
      <h3 className="text-md font-semibold mb-2 text-center text-slate-700">アニメーション操作</h3>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={onPlayPause}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            title={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={onStop}
            className="p-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-50"
            title="停止"
          >
            <Square size={20} />
          </button>
          <div className="flex items-center space-x-1">
            <label htmlFor="speed-kps-input" className="text-xs text-slate-700 whitespace-nowrap">速度(秒/km):</label>
            <input
              type="number"
              id="speed-kps-input"
              min="1"
              max="60"
              step="1"
              value={speedKps} // 親から渡された値を表示
              onChange={handleSpeedInputChange}
              onBlur={handleSpeedInputBlur} // フォーカスが外れた時にもバリデーション
              className="w-16 p-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center space-x-1 flex-wrap justify-center gap-1 mt-2 sm:mt-0">
          {/* 他のボタン (現状ダミー機能) */}
          <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center" title="画像保存 (未実装)">
            <ImageIcon size={14} className="mr-1"/>画像保存
          </button>
          <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center" title="動画出力 (未実装)">
            <Film size={14} className="mr-1"/>動画出力
          </button>
           <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center" title="GIF出力 (未実装)">
            <Gift size={14} className="mr-1"/>GIF出力
          </button>
          <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center" title="SNS共有 (未実装)">
            <Share2 size={14} className="mr-1"/>SNS共有
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
