// src/components/PreviewOutput.tsx
/*
import React from 'react';

const OutputSettingItem: React.FC<{label: string, placeholder: string}> = ({label, placeholder}) => (
  <div className="mb-2">
    <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}:</label>
    <input type="text" defaultValue={placeholder} className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm text-xs focus:ring-blue-500 focus:border-blue-500" />
  </div>
);


const PreviewOutput: React.FC = () => {
  return (
    <div className="bg-slate-200 p-3 rounded-md shadow-lg mt-2 h-[250px] flex flex-col">
      <h3 className="text-md font-semibold mb-2 text-center text-slate-700">プレビュー・出力設定</h3>
      <div className="flex flex-1 space-x-3 overflow-hidden">
        <div className="w-3/5 flex flex-col space-y-2">
          <div className="flex-1 bg-slate-700 rounded flex justify-center items-center text-slate-400 text-sm">
            動画プレビューエリア
          </div>
          <div>
            <label htmlFor="file-name" className="block text-xs font-medium text-gray-600 mb-0.5">ファイル名:</label>
            <input type="text" id="file-name" defaultValue="旅行_東京_大阪_2025.mp4" className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm text-xs focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">出力進捗:</label>
            <div className="w-full bg-slate-300 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '30%' }}></div>
            </div>
            <p className="text-xs text-right text-slate-500 mt-0.5">30%</p>
          </div>
        </div>
        <div className="w-2/5 bg-slate-100 p-3 rounded border border-slate-300 overflow-y-auto text-xs">
          <h4 className="text-sm font-semibold mb-1.5 text-center text-slate-600">出力設定</h4>
          <OutputSettingItem label="サイズ" placeholder="1920 x 1080" />
          <OutputSettingItem label="品質" placeholder="高品質 (4K)" />
          <OutputSettingItem label="フォーマット" placeholder="MP4" />
          <OutputSettingItem label="フレームレート" placeholder="30fps" />
          <OutputSettingItem label="背景スタイル" placeholder="標準マップ" />
          <OutputSettingItem label="アニメーション効果" placeholder="滑らか" />
          <button className="w-full mt-2 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
            出力実行
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewOutput;
*/

// 録画機能削除のため、コンポーネントを無効化
const PreviewOutput: React.FC = () => null;
export default PreviewOutput; // エラー回避のため、最低限のエクスポートは残す