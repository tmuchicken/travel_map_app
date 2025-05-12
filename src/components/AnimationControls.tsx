// src/components/AnimationControls.tsx
import React from 'react';
import { Play, Pause, Square, Film, Image as ImageIcon, Gift, Share2 } from 'lucide-react';

interface AnimationControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  durationSeconds: number; // 各区間の移動時間 (秒)
  onDurationChange: (newDurationSeconds: number) => void;
}

const AnimationControls: React.FC<AnimationControlsProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  durationSeconds,
  onDurationChange
}) => {

  const handleDurationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // ★ 修正点: 'let' から 'const' に変更
    const newDuration = parseInt(rawValue, 10);

    if (isNaN(newDuration)) {
      if (rawValue === "") {
         onDurationChange(1); // 空なら1秒にするなど (この値は親コンポーネントでさらにバリデーションされる想定)
      }
      // isNaN で true の場合、newDuration は数値ではないので onDurationChange に渡さない、またはエラー処理
      return;
    }
    // ここで newDuration を直接 onDurationChange に渡しているため、再代入がない。
    // もしこの関数内で範囲チェックや丸め処理を行う場合は let のまま再代入が必要。
    // 現在のESLintエラーは「再代入がない」ことに対するものなので const に変更。
    // 親コンポーネント (page.tsx の handleDurationChange) でバリデーションは行われている。
    onDurationChange(newDuration);
  };

  const handleDurationInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let newDuration = parseInt(rawValue, 10); // ここは再代入の可能性があるため let のまま
    // 親コンポーネントのバリデーションに任せるか、ここでも範囲を強制する
    if (isNaN(newDuration) || newDuration < 1) {
      newDuration = 1;
    } else if (newDuration > 600) { // 例: 最大10分 (page.tsxのバリデーションと合わせる)
      newDuration = 600;
    }
    onDurationChange(newDuration);
  };


  return (
    <div className="bg-slate-200 dark:bg-slate-700 p-3 rounded-md shadow-lg h-auto flex flex-col justify-center">
      <h3 className="text-md font-semibold mb-2 text-center text-slate-700 dark:text-slate-200">アニメーション操作</h3>
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
            <label htmlFor="duration-seconds-input" className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">区間移動時間(秒):</label>
            <input
              type="number"
              id="duration-seconds-input"
              min="1"
              max="600" // page.tsxのバリデーションと合わせる
              step="1"
              value={durationSeconds}
              onChange={handleDurationInputChange}
              onBlur={handleDurationInputBlur}
              className="w-20 p-1 border border-gray-300 dark:border-slate-500 rounded-md text-sm bg-white dark:bg-slate-600 dark:text-slate-50 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center space-x-1 flex-wrap justify-center gap-1 mt-2 sm:mt-0">
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
