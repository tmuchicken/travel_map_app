// src/components/ControlPanel.tsx
import React from 'react';
import { Plus, Save, FolderOpen, Loader2, Trash2, MapPin, Eye, EyeOff } from 'lucide-react';
import type { LocationPoint, TransportOption } from '@/app/page';

interface ControlPanelProps {
  className?: string;
  locations: LocationPoint[];
  transportOptions: TransportOption[];
  geocodingState: Record<string, 'idle' | 'loading' | 'error'>;
  pickingLocationId?: string | null;
  onLocationNameChange: (id: string, newName: string) => void;
  onTransportChange: (id: string, newTransport: string) => void;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
  onGeocodeLocation: (id: string, name: string) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onSelectFromMap: (locationId: string) => void;
  onGenerateRoute: () => void;
  onToggleLocationLabel: (id: string) => void;
}

interface LocationInputGroupProps {
  point: LocationPoint;
  isLoading: boolean;
  isPickingThisLocation: boolean;
  onValueChange: (newValue: string) => void;
  onSearchClick: () => void;
  canRemove?: boolean;
  onRemoveClick?: () => void;
  onSelectFromMapClick: () => void;
  onToggleLabelClick: () => void;
}

const LocationInputGroup: React.FC<LocationInputGroupProps> = ({
  point,
  isLoading,
  isPickingThisLocation,
  onValueChange,
  onSearchClick,
  canRemove,
  onRemoveClick,
  onSelectFromMapClick,
  onToggleLabelClick,
}) => {
  // getPointLabel 関数は削除されました

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        {/* ラベルは ControlPanel 側で別途表示するため、ここでは空にするか、
            もし LocationInputGroup 内部でラベルが必要なら、別途 label prop を渡す */}
        <div className="flex-grow"> {/* ラベルが占めるスペースがなくなるので調整が必要な場合 */}
             {/* <label htmlFor={`${point.id}-input`} className="block text-sm font-semibold text-gray-700 dark:text-gray-300"></label> */}
        </div>
        <button
          onClick={onToggleLabelClick}
          title={(point.showLabel ?? true) ? "この地点の地名を非表示" : "この地点の地名を表示"}
          className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 focus:outline-none"
        >
          {(point.showLabel ?? true) ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      <div className="flex space-x-2 items-start">
        <input
          type="text"
          id={`${point.id}-input`}
          value={point.name}
          onChange={(e) => onValueChange(e.target.value)}
          className={`flex-grow p-2 border rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-700 ${
            point.error ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
          }`}
          placeholder="住所または地名を入力"
          disabled={isLoading}
        />
        <button
           onClick={onSelectFromMapClick}
           className={`p-2 text-white rounded-md transition-colors disabled:opacity-50 flex items-center justify-center ${
            isPickingThisLocation ? 'bg-pink-600 hover:bg-pink-700' : 'bg-teal-600 hover:bg-teal-700'
           }`}
           title={isPickingThisLocation ? "地点選択をキャンセル" : "地図からこの地点を選択"}
           disabled={isLoading}
        >
            <MapPin size={16} />
        </button>
        <button
          onClick={onSearchClick}
          className="px-3 py-2 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[70px]"
          disabled={isLoading || !point.name.trim()}
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
      {point.error && <p className="mt-1 text-xs text-red-600">{point.error}</p>}
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
  pickingLocationId,
  onLocationNameChange,
  onTransportChange,
  onAddWaypoint,
  onRemoveWaypoint,
  onGeocodeLocation,
  onSaveProject,
  onLoadProject,
  onSelectFromMap,
  onGenerateRoute,
  onToggleLocationLabel,
}) => {
  const startPoint = locations.find(loc => loc.id === 'start'); // ! を削除 (存在しない可能性も考慮)
  const waypoints = locations.filter(loc => loc.id.startsWith('waypoint'));
  const endPoint = locations.find(loc => loc.id === 'end'); // ! を削除

  const getPointLabelText = (point: LocationPoint, index?: number): string => {
    if (point.id === 'start') return '出発地';
    if (point.id === 'end') return '目的地';
    if (point.id.startsWith('waypoint') && index !== undefined) {
      return `中継地点 ${index + 1}`;
    }
    return '地点';
  };

  return (
    <div className={`flex flex-col bg-slate-200 dark:bg-slate-800 rounded-md shadow-lg ${className} flex-1 min-h-0 text-slate-900 dark:text-slate-50`}>
      <div className="p-3 md:p-4 border-b border-slate-300 dark:border-slate-700 flex-grow overflow-y-auto space-y-3">
        <h2 className="text-lg font-semibold mb-3 text-center text-slate-800 dark:text-slate-100">経路と移動手段の設定</h2>

        {startPoint && (
          <div className="p-3 border border-slate-300 dark:border-slate-700 rounded-md bg-white/30 dark:bg-slate-700/30 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {getPointLabelText(startPoint)}
            </label>
            <LocationInputGroup
              point={startPoint}
              isLoading={geocodingState[startPoint.id] === 'loading'}
              isPickingThisLocation={pickingLocationId === startPoint.id}
              onValueChange={(newName) => onLocationNameChange(startPoint.id, newName)}
              onSearchClick={() => onGeocodeLocation(startPoint.id, startPoint.name)}
              onSelectFromMapClick={() => onSelectFromMap(startPoint.id)}
              onToggleLabelClick={() => onToggleLocationLabel(startPoint.id)}
            />
            <TransportSelection
              selectedTransport={startPoint.transport}
              onTransportChange={(newTransport) => onTransportChange(startPoint.id, newTransport)}
              options={transportOptions}
            />
          </div>
        )}

        {waypoints.map((waypoint, index) => (
          <div key={waypoint.id} className="p-3 border border-dashed border-slate-400 dark:border-slate-600 rounded-md bg-white/20 dark:bg-slate-700/20 shadow-sm relative">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {getPointLabelText(waypoint, index)}
            </label>
            <LocationInputGroup
              point={waypoint}
              isLoading={geocodingState[waypoint.id] === 'loading'}
              isPickingThisLocation={pickingLocationId === waypoint.id}
              onValueChange={(newName) => onLocationNameChange(waypoint.id, newName)}
              onSearchClick={() => onGeocodeLocation(waypoint.id, waypoint.name)}
              canRemove={true}
              onRemoveClick={() => onRemoveWaypoint(waypoint.id)}
              onSelectFromMapClick={() => onSelectFromMap(waypoint.id)}
              onToggleLabelClick={() => onToggleLocationLabel(waypoint.id)}
            />
            <TransportSelection
              selectedTransport={waypoint.transport}
              onTransportChange={(newTransport) => onTransportChange(waypoint.id, newTransport)}
              options={transportOptions}
            />
          </div>
        ))}

        {endPoint && (
          <div className="p-3 border border-slate-300 dark:border-slate-700 rounded-md bg-white/30 dark:bg-slate-700/30 shadow-sm">
             <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {getPointLabelText(endPoint)}
            </label>
            <LocationInputGroup
              point={endPoint}
              isLoading={geocodingState[endPoint.id] === 'loading'}
              isPickingThisLocation={pickingLocationId === endPoint.id}
              onValueChange={(newName) => onLocationNameChange(endPoint.id, newName)}
              onSearchClick={() => onGeocodeLocation(endPoint.id, endPoint.name)}
              onSelectFromMapClick={() => onSelectFromMap(endPoint.id)}
              onToggleLabelClick={() => onToggleLocationLabel(endPoint.id)}
            />
          </div>
        )}

        <div className="flex space-x-2 pt-3">
          <button
            onClick={onAddWaypoint}
            className="flex-1 py-2 px-3 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Plus size={16} className="mr-1" /> 中継地点を追加
          </button>
          <button
            onClick={onGenerateRoute}
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