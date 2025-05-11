// src/components/ControlPanel.tsx
import React from 'react';
import { Plus, Save, FolderOpen, Loader2 } from 'lucide-react'; // Loader2 をインポート
import type { LocationPoint, TransportOption } from '@/app/page';

interface ControlPanelProps {
  className?: string;
  locations: LocationPoint[];
  transportOptions: TransportOption[];
  geocodingState: Record<string, 'idle' | 'loading' | 'error'>; // ジオコーディングの状態を受け取る
  onLocationNameChange: (id: string, newName: string) => void;
  onTransportChange: (id: string, newTransport: string) => void;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
  onGeocodeLocation: (id: string, name: string) => void;
  onGenerateRoute: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
}

const LocationInputGroup: React.FC<{
  label: string;
  pointType: string;
  value: string;
  error?: string; // エラーメッセージ表示用
  isLoading: boolean; // ローディング状態表示用
  onValueChange: (newValue: string) => void;
  onSearchClick: () => void;
}> = ({ label, pointType, value, error, isLoading, onValueChange, onSearchClick }) => {
  return (
    <div className="mb-1"> {/* マージンを少し調整 */}
      <label htmlFor={`${pointType}-input`} className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex space-x-2 items-center"> {/* items-center を追加 */}
        <input
          type="text"
          id={`${pointType}-input`}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={`flex-grow p-2 border rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="住所または地名を入力"
          disabled={isLoading} // ローディング中は無効化
        />
        <button
          onClick={onSearchClick}
          className="px-3 py-2 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50"
          disabled={isLoading || !value.trim()} // ローディング中または入力が空の場合は無効化
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : '検索'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

const TransportSelection: React.FC<{
  selectedTransport: string;
  onTransportChange: (transportName: string) => void;
  options: TransportOption[];
}> = ({ selectedTransport, onTransportChange, options }) => {
  return (
    <div className="mb-4 mt-2"> {/* マージンを調整 */}
      <p className="block text-xs font-medium text-gray-700 mb-1">移動手段</p>
      <div className="bg-slate-50 border border-gray-300 rounded-md p-2 flex justify-around items-center">
        {options.map((item) => (
          <button
            key={item.name}
            title={item.name}
            data-active={selectedTransport === item.name}
            onClick={() => onTransportChange(item.name)}
            className="p-2 rounded-full hover:bg-blue-100 data-[active=true]:bg-blue-500 data-[active=true]:text-white text-slate-700 data-[active=false]:text-slate-700 transition-colors"
          >
            <span className="text-xl">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  className,
  locations,
  transportOptions,
  geocodingState,
  onLocationNameChange,
  onTransportChange,
  onAddWaypoint,
  onRemoveWaypoint,
  onGeocodeLocation,
  onGenerateRoute,
  onSaveProject,
  onLoadProject,
}) => {
  const startPoint = locations.find(loc => loc.id === 'start')!;
  const waypoints = locations.filter(loc => loc.id.startsWith('waypoint'));
  const endPoint = locations.find(loc => loc.id === 'end')!;

  return (
    <div className={`flex flex-col bg-slate-200 rounded-md shadow-lg ${className} flex-1 min-h-0`}>
      <div className="p-4 border-b border-slate-300 flex-grow overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3 text-center text-slate-800">経路と移動手段の設定</h2>

        <LocationInputGroup
          label="出発地"
          pointType={startPoint.id}
          value={startPoint.name}
          error={startPoint.error}
          isLoading={geocodingState[startPoint.id] === 'loading'}
          onValueChange={(newName) => onLocationNameChange(startPoint.id, newName)}
          onSearchClick={() => onGeocodeLocation(startPoint.id, startPoint.name)}
        />
        <TransportSelection
          selectedTransport={startPoint.transport}
          onTransportChange={(newTransport) => onTransportChange(startPoint.id, newTransport)}
          options={transportOptions}
        />

        {waypoints.map((waypoint, index) => (
          <div key={waypoint.id} className="relative mb-1 p-3 border border-dashed border-slate-400 rounded-md"> {/* マージン調整 */}
            {waypoints.length > 0 && (
              <button
                onClick={() => onRemoveWaypoint(waypoint.id)}
                className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                title="この中継地点を削除"
              >
                ✕
              </button>
            )}
            <LocationInputGroup
              label={`中継地点 ${index + 1}`}
              pointType={waypoint.id}
              value={waypoint.name}
              error={waypoint.error}
              isLoading={geocodingState[waypoint.id] === 'loading'}
              onValueChange={(newName) => onLocationNameChange(waypoint.id, newName)}
              onSearchClick={() => onGeocodeLocation(waypoint.id, waypoint.name)}
            />
            <TransportSelection
              selectedTransport={waypoint.transport}
              onTransportChange={(newTransport) => onTransportChange(waypoint.id, newTransport)}
              options={transportOptions}
            />
          </div>
        ))}

        <LocationInputGroup
          label="目的地"
          pointType={endPoint.id}
          value={endPoint.name}
          error={endPoint.error}
          isLoading={geocodingState[endPoint.id] === 'loading'}
          onValueChange={(newName) => onLocationNameChange(endPoint.id, newName)}
          onSearchClick={() => onGeocodeLocation(endPoint.id, endPoint.name)}
        />

        <div className="flex space-x-2 mt-4">
          <button
            onClick={onAddWaypoint}
            className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center"
          >
            <Plus size={16} className="mr-1" /> 中継地点を追加
          </button>
          <button
            onClick={onGenerateRoute}
            className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            ルートを生成
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-slate-300">
        <h2 className="text-lg font-semibold mb-3 text-center text-slate-800">プロジェクト操作</h2>
        <div className="flex space-x-2">
          <button
            onClick={onSaveProject}
            className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center"
          >
            <Save size={16} className="mr-1" /> 保存
          </button>
          <button
            onClick={onLoadProject}
            className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center"
          >
            <FolderOpen size={16} className="mr-1" /> 読み込み
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
