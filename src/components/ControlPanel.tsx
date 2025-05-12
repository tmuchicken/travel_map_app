// src/components/ControlPanel.tsx
import React from 'react';
import { Plus, Save, FolderOpen, Loader2, Trash2, MapPin } from 'lucide-react'; // MapPin アイコンを追加
import type { LocationPoint, TransportOption } from '@/app/page';

interface ControlPanelProps {
  className?: string;
  locations: LocationPoint[];
  transportOptions: TransportOption[];
  geocodingState: Record<string, 'idle' | 'loading' | 'error'>;
  onLocationNameChange: (id: string, newName: string) => void;
  onTransportChange: (id: string, newTransport: string) => void;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
  onGeocodeLocation: (id: string, name: string) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onSelectFromMap: (locationId: string) => void;
  onGenerateRoute: () => void; // ★ 追加: ルート生成関数のためのprops
}

const LocationInputGroup: React.FC<{
  label: string;
  pointType: string; // 'start', 'end', or waypoint id
  value: string;
  error?: string;
  isLoading: boolean;
  onValueChange: (newValue: string) => void;
  onSearchClick: () => void;
  canRemove?: boolean; // 中継地点削除ボタン表示用
  onRemoveClick?: () => void; // 中継地点削除ハンドラ
  onSelectFromMapClick: () => void;
}> = ({ label, pointType, value, error, isLoading, onValueChange, onSearchClick, canRemove, onRemoveClick, onSelectFromMapClick }) => {
  return (
    <div className="mb-2">
      <label htmlFor={`${pointType}-input`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="flex space-x-2 items-start">
        <input
          type="text"
          id={`${pointType}-input`}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={`flex-grow p-2 border rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-700 ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
          }`}
          placeholder="住所または地名を入力"
          disabled={isLoading}
        />
        <button
           onClick={onSelectFromMapClick}
           className="p-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center"
           title="地図からこの地点を選択"
           disabled={isLoading}
        >
            <MapPin size={16} />
        </button>
        <button
          onClick={onSearchClick}
          className="px-3 py-2 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[70px]"
          disabled={isLoading || !value.trim()}
          title="この地点の座標を検索"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : '検索'}
        </button>
        {canRemove && onRemoveClick && (
          <button
            onClick={onRemoveClick}
            className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            title="この中継地点を削除"
          >
            <Trash2 size={16} />
          </button>
        )}
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
    <div className="mb-3 mt-1">
      <p className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">移動手段</p>
      <div className="bg-slate-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md p-1.5 flex flex-wrap justify-around items-center gap-1">
        {options.map((item) => (
          <button
            key={item.name}
            title={item.name}
            data-active={selectedTransport === item.name}
            onClick={() => onTransportChange(item.name)}
            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 data-[active=true]:bg-blue-500 data-[active=true]:text-white text-slate-700 dark:text-slate-200 data-[active=false]:text-slate-700 dark:data-[active=false]:text-slate-200 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
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
  onSaveProject,
  onLoadProject,
  onSelectFromMap,
  onGenerateRoute, // ★ propsとして受け取る
}) => {
  const startPoint = locations.find(loc => loc.id === 'start')!;
  const waypoints = locations.filter(loc => loc.id.startsWith('waypoint'));
  const endPoint = locations.find(loc => loc.id === 'end')!;

  return (
    <div className={`flex flex-col bg-slate-200 dark:bg-slate-800 rounded-md shadow-lg ${className} flex-1 min-h-0 text-slate-900 dark:text-slate-50`}>
      <div className="p-3 md:p-4 border-b border-slate-300 dark:border-slate-700 flex-grow overflow-y-auto space-y-3">
        <h2 className="text-lg font-semibold mb-2 text-center text-slate-800 dark:text-slate-100">経路と移動手段の設定</h2>

        {/* 出発地 */}
        <div className="p-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white/30 dark:bg-slate-700/30">
          <LocationInputGroup
            label="出発地"
            pointType={startPoint.id}
            value={startPoint.name}
            error={startPoint.error}
            isLoading={geocodingState[startPoint.id] === 'loading'}
            onValueChange={(newName) => onLocationNameChange(startPoint.id, newName)}
            onSearchClick={() => onGeocodeLocation(startPoint.id, startPoint.name)}
            onSelectFromMapClick={() => onSelectFromMap(startPoint.id)}
          />
          <TransportSelection
            selectedTransport={startPoint.transport}
            onTransportChange={(newTransport) => onTransportChange(startPoint.id, newTransport)}
            options={transportOptions}
          />
        </div>

        {/* 中継地点 */}
        {waypoints.map((waypoint, index) => (
          <div key={waypoint.id} className="p-2 border border-dashed border-slate-400 dark:border-slate-600 rounded-md bg-white/20 dark:bg-slate-700/20 relative">
            <LocationInputGroup
              label={`中継地点 ${index + 1}`}
              pointType={waypoint.id}
              value={waypoint.name}
              error={waypoint.error}
              isLoading={geocodingState[waypoint.id] === 'loading'}
              onValueChange={(newName) => onLocationNameChange(waypoint.id, newName)}
              onSearchClick={() => onGeocodeLocation(waypoint.id, waypoint.name)}
              canRemove={true}
              onRemoveClick={() => onRemoveWaypoint(waypoint.id)}
              onSelectFromMapClick={() => onSelectFromMap(waypoint.id)}
            />
            <TransportSelection
              selectedTransport={waypoint.transport}
              onTransportChange={(newTransport) => onTransportChange(waypoint.id, newTransport)}
              options={transportOptions}
            />
          </div>
        ))}

        {/* 目的地 */}
         <div className="p-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white/30 dark:bg-slate-700/30">
            <LocationInputGroup
            label="目的地"
            pointType={endPoint.id}
            value={endPoint.name}
            error={endPoint.error}
            isLoading={geocodingState[endPoint.id] === 'loading'}
            onValueChange={(newName) => onLocationNameChange(endPoint.id, newName)}
            onSearchClick={() => onGeocodeLocation(endPoint.id, endPoint.name)}
            onSelectFromMapClick={() => onSelectFromMap(endPoint.id)}
            />
        </div>


        <div className="flex space-x-2 pt-2">
          <button
            onClick={onAddWaypoint}
            className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Plus size={16} className="mr-1" /> 中継地点を追加
          </button>
          <button
            onClick={onGenerateRoute} // ★ 修正: propsから渡された関数を呼び出す
            className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ルートを生成/更新
          </button>
        </div>
      </div>

      <div className="p-3 md:p-4 border-t border-slate-300 dark:border-slate-700">
        <h2 className="text-lg font-semibold mb-2 text-center text-slate-800 dark:text-slate-100">プロジェクト操作</h2>
        <div className="flex space-x-2">
          <button
            onClick={onSaveProject}
            className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Save size={16} className="mr-1" /> 保存
          </button>
          <button
            onClick={onLoadProject}
            className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <FolderOpen size={16} className="mr-1" /> 読み込み
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
