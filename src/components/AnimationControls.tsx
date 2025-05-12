// src/components/AnimationControls.tsx
import React from 'react';
// ★ 修正: 未使用の Film アイコンを確実に削除
import { Play, Pause, Square, Image as ImageIcon, Gift, Share2, Video, VideoOff } from 'lucide-react';

interface AnimationControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  durationSeconds: number;
  onDurationChange: (newDurationSeconds: number) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const AnimationControls: React.FC<AnimationControlsProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  durationSeconds,
  onDurationChange,
  isRecording,
  onStartRecording,
  onStopRecording,
}) => {

  const handleDurationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const newDuration = parseInt(rawValue, 10);

    if (isNaN(newDuration)) {
      if (rawValue === "") {
         onDurationChange(1);
      }
      return;
    }
    onDurationChange(newDuration);
  };

  const handleDurationInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let newDuration = parseInt(rawValue, 10);
    if (isNaN(newDuration) || newDuration < 1) {
      newDuration = 1;
    } else if (newDuration > 600) {
      newDuration = 600;
    }
    onDurationChange(newDuration);
  };


  return (
    <div className="bg-slate-200 dark:bg-slate-700 p-3 rounded-md shadow-lg h-auto flex flex-col justify-center">
      <h3 className="text-md font-semibold mb-2 text-center text-slate-700 dark:text-slate-200">アニメーション操作</h3>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* 再生・停止・速度調整 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onPlayPause}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            title={isPlaying ? "一時停止" : "再生"}
            disabled={isRecording}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={onStop}
            className="p-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-50"
            title="停止"
            disabled={isRecording}
          >
            <Square size={20} />
          </button>
          <div className="flex items-center space-x-1">
            <label htmlFor="duration-seconds-input" className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">区間移動時間(秒):</label>
            <input
              type="number"
              id="duration-seconds-input"
              min="1"
              max="600"
              step="1"
              value={durationSeconds}
              onChange={handleDurationInputChange}
              onBlur={handleDurationInputBlur}
              className="w-20 p-1 border border-gray-300 dark:border-slate-500 rounded-md text-sm bg-white dark:bg-slate-600 dark:text-slate-50 focus:ring-blue-500 focus:border-blue-500"
              disabled={isRecording}
            />
          </div>
        </div>
        {/* 出力関連ボタン */}
        <div className="flex items-center space-x-1 flex-wrap justify-center gap-1 mt-2 sm:mt-0">
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`px-2 py-1 text-xs text-white rounded-md transition-colors flex items-center ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isRecording ? "録画停止" : "録画開始"}
            disabled={isRecording} // 録画中は「録画停止」のみ有効、録画中でなければ「録画開始」が有効
          >
            {isRecording ? (
              <>
                <VideoOff size={14} className="mr-1"/>録画停止
                <span className="ml-1.5 w-2 h-2 bg-white rounded-full animate-pulse"></span>
              </>
            ) : (
              <>
                <Video size={14} className="mr-1"/>録画開始
              </>
            )}
          </button>
          <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center opacity-50 cursor-not-allowed" title="画像保存 (未実装)" disabled>
            <ImageIcon size={14} className="mr-1"/>画像保存
          </button>
           <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center opacity-50 cursor-not-allowed" title="GIF出力 (未実装)" disabled>
            <Gift size={14} className="mr-1"/>GIF出力
          </button>
          <button className="px-2 py-1 text-xs bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center opacity-50 cursor-not-allowed" title="SNS共有 (未実装)" disabled>
            <Share2 size={14} className="mr-1"/>SNS共有
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
