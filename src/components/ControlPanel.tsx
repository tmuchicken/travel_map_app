// src/components/ControlPanel.tsx
import React from 'react';
import { Bus, Plane, Train, Car, Ship, Footprints, Plus, Save, FolderOpen } from 'lucide-react'; // アイコン

interface ControlPanelProps {
  className?: string;
}

const transportIcons = [
  { name: 'Bus', icon: <Bus size={20} />, label: '🚌' },
  { name: 'Plane', icon: <Plane size={20} />, label: '✈️' },
  { name: 'Train', icon: <Train size={20} />, label: '🚆' },
  { name: 'Car', icon: <Car size={20} />, label: '🚗' },
  { name: 'Ship', icon: <Ship size={20} />, label: '⛴' },
  { name: 'Walk', icon: <Footprints size={20} />, label: '🚶' },
];

const LocationInputGroup: React.FC<{ label: string, pointType: string }> = ({ label, pointType }) => (
  <div className="mb-4">
    <label htmlFor={`${pointType}-input`} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <div className="flex space-x-2">
      <input
        type="text"
        id={`${pointType}-input`}
        className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
        placeholder="住所または地名を入力"
      />
      <button className="px-3 py-2 bg-slate-500 text-white text-sm rounded-md hover:bg-slate-600 transition-colors">
        検索
      </button>
    </div>
  </div>
);

const TransportSelection: React.FC = () => (
  <div className="mb-4">
    <p className="block text-xs font-medium text-gray-600 mb-1">移動手段</p>
    <div className="bg-slate-50 border border-gray-300 rounded-md p-2 flex justify-around items-center">
      {transportIcons.map((item) => (
        <button
          key={item.name}
          title={item.name}
          className="p-2 rounded-full hover:bg-blue-100 data-[active=true]:bg-blue-500 data-[active=true]:text-white text-slate-600 transition-colors"
          // data-active={selectedTransport === item.name} // 実際の選択状態に応じて変更
          // onClick={() => setSelectedTransport(item.name)}
        >
          {/* {item.icon} */} {/* lucide アイコンを使う場合 */}
          <span className="text-xl">{item.label}</span> {/* 絵文字を使う場合 */}
        </button>
      ))}
    </div>
  </div>
);


const ControlPanel: React.FC<ControlPanelProps> = ({ className }) => {
  // 中継地点の状態管理 (例)
  const [waypoints, setWaypoints] = React.useState<number[]>([1]); // 初期は中継地点1つ

  const addWaypoint = () => {
    setWaypoints([...waypoints, waypoints.length + 1]);
  };

  return (
    <div className={`flex flex-col bg-slate-200 rounded-md shadow-lg ${className}`}>
      {/* 経路と移動手段の設定 */}
      <div className="p-4 border-b border-slate-300 flex-grow overflow-y-auto"> {/* スクロール可能に */}
        <h2 className="text-lg font-semibold mb-3 text-center text-slate-700">経路と移動手段の設定</h2>
        
        <LocationInputGroup label="出発地" pointType="start" />
        <TransportSelection />

        {/* '_index' を引数から削除しました */}
        {waypoints.map((id) => (
          <React.Fragment key={`waypoint-group-${id}`}>
            <LocationInputGroup label={`中継地点${id}`} pointType={`waypoint-${id}`} />
            <TransportSelection />
          </React.Fragment>
        ))}
        
        <LocationInputGroup label="目的地" pointType="end" />

        <div className="flex space-x-2 mt-4">
          <button 
            onClick={addWaypoint}
            className="flex-1 py-2 px-3 bg-slate-500 text-white text-sm rounded-md hover:bg-slate-600 transition-colors flex items-center justify-center"
          >
            <Plus size={16} className="mr-1" /> 中継地点を追加
          </button>
          <button className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
            ルートを生成
          </button>
        </div>
      </div>

      {/* プロジェクト操作 */}
      <div className="p-4 border-t border-slate-300">
        <h2 className="text-lg font-semibold mb-3 text-center text-slate-700">プロジェクト操作</h2>
        <div className="flex space-x-2">
          <button className="flex-1 py-2 px-3 bg-slate-500 text-white text-sm rounded-md hover:bg-slate-600 transition-colors flex items-center justify-center">
            <Save size={16} className="mr-1" /> 保存
          </button>
          <button className="flex-1 py-2 px-3 bg-slate-500 text-white text-sm rounded-md hover:bg-slate-600 transition-colors flex items-center justify-center">
            <FolderOpen size={16} className="mr-1" /> 読み込み
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
