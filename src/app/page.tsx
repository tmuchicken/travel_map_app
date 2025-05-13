// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import L from 'leaflet';
import { availableTileLayers } from '@/config/mapLayers';

export interface LocationPoint {
  id: string;
  name: string; // この name をユーザーが編集できるようにし、ジオコーディング結果で更新する
  transport: string;
  lat?: number;
  lng?: number;
  error?: string;
}

export interface TransportOption {
  name: string;
  label: string;
}

const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full bg-gray-200 dark:bg-gray-700"><p className="text-slate-700 dark:text-slate-200">地図を読み込み中です...</p></div>,
});

// --- HomePage Component ---
export default function HomePage() {
  const initialTransportOptions: TransportOption[] = useMemo(() => [
    { name: 'Car', label: '🚗' },
    { name: 'Bus', label: '🚌' },
    { name: 'Plane', label: '✈️' },
    { name: 'Train', label: '🚆' },
    { name: 'Ship', label: '⛴️' },
    { name: 'Walk', label: '🚶' },
  ], []);

  const [locations, setLocations] = useState<LocationPoint[]>([
    { id: 'start', name: '東京タワー', transport: initialTransportOptions[0].name, lat: 35.6585805, lng: 139.7454329 },
    { id: 'end', name: '大阪城', transport: initialTransportOptions[0].name, lat: 34.6873153, lng: 135.5259603 },
  ]);

  const [geocodingState, setGeocodingState] = useState<Record<string, 'idle' | 'loading' | 'error'>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [segmentDurationSeconds, setSegmentDurationSeconds] = useState(5);
  const [mapError, setMapError] = useState<string | null>(null);
  const [pickingLocationId, setPickingLocationId] = useState<string | null>(null);
  const [selectedTileLayerId, setSelectedTileLayerId] = useState<string>(availableTileLayers[0].id);


  useEffect(() => {
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
  }, [locations]);

  // 地点名変更ハンドラ (ControlPanelから呼ばれる)
  const handleLocationNameChange = useCallback((id: string, newName: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, name: newName, error: undefined } : loc)) // 編集時にエラーをクリアすることが多い
    );
    // 地名変更時はジオコーディング状態をリセットしても良いが、座標は維持されるので必須ではない
    // setGeocodingState(prev => ({...prev, [id]: 'idle'}));
    setMapError(null);
  }, []);

  const handleTransportChange = useCallback((id: string, newTransport: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, transport: newTransport } : loc))
    );
  }, []);

  const addWaypoint = useCallback(() => {
    const newWaypointId = `waypoint-${Date.now()}`;
    setLocations(prevLocations => {
      const endIndex = prevLocations.findIndex(loc => loc.id === 'end');
      const newLocations = [...prevLocations];
      // 新しい地点のnameは空文字で初期化。ユーザーが入力するか、検索/ピン刺しで設定される。
      newLocations.splice(endIndex, 0, { id: newWaypointId, name: '', transport: initialTransportOptions[0].name });
      return newLocations;
    });
  }, [initialTransportOptions]);

  const removeWaypoint = useCallback((idToRemove: string) => {
    setLocations(prevLocations => prevLocations.filter(loc => loc.id !== idToRemove));
    setGeocodingState(prev => {
      const newState = {...prev};
      delete newState[idToRemove];
      return newState;
    });
  }, []);

  // 地名からのジオコーディング (検索ボタン押下時)
  const handleGeocodeLocation = useCallback(async (locationId: string, locationNameFromInput: string) => {
    // locationNameFromInput は ControlPanel の入力フィールドの現在の値
    if (!locationNameFromInput.trim()) {
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: "地点名を入力してください。" } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      return;
    }
    setGeocodingState(prev => ({...prev, [locationId]: 'loading'}));
    setMapError(null);
    try {
      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationNameFromInput)}&format=jsonv2&limit=1`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteAnimationApp/1.0 (user@example.com)' } });
      if (!response.ok) throw new Error(`ジオコーディングサーバーエラー: ${response.statusText} (${response.status})`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setLocations(prevLocations =>
          prevLocations.map(loc =>
            loc.id === locationId ? { ...loc, lat: parseFloat(lat), lng: parseFloat(lon), name: display_name, error: undefined } : loc
            // ▲▲▲ 検索結果の display_name を name として設定。ユーザーはこの後ControlPanelで編集可能 ▲▲▲
          )
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      } else {
        setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: '地点が見つかりません。検索ワードを変えてみてください。', name: locationNameFromInput } : loc))
          // ▲▲▲ 見つからない場合も、入力された名前は維持する ▲▲▲
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ジオコーディング中に不明なエラーが発生しました。';
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: errorMessage, name: locationNameFromInput } : loc))
        // ▲▲▲ エラー時も、入力された名前は維持する ▲▲▲
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
    }
  }, []);

  // 地図クリックによる逆ジオコーディング
  const handleReverseGeocodeLocation = useCallback(async (locationId: string, latlng: L.LatLng) => {
    setGeocodingState(prev => ({...prev, [locationId]: 'loading'}));
    setMapError(null);
    // ピン刺し時は、まずControlPanelの対応する地点のnameを空にするか、「検索中...」などにしても良い
    // setLocations(prevLocations =>
    //   prevLocations.map(loc =>
    //     loc.id === locationId ? { ...loc, name: "座標から検索中...", lat: latlng.lat, lng: latlng.lng, error: undefined } : loc
    //   )
    // );
    try {
      const apiUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=jsonv2`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteAnimationApp/1.0 (user@example.com)' } });
      if (!response.ok) throw new Error(`逆ジオコーディングサーバーエラー: ${response.statusText} (${response.status})`);
      const data = await response.json();
      let newName: string;
      if (data && data.display_name) {
        newName = data.display_name;
      } else {
        newName = `地点 (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`; // 取得失敗時のデフォルト名
      }
      setLocations(prevLocations =>
        prevLocations.map(loc =>
          loc.id === locationId ? { ...loc, lat: latlng.lat, lng: latlng.lng, name: newName, error: undefined } : loc
          // ▲▲▲ 逆ジオコーディング結果の地名を name として設定。ユーザーはこの後ControlPanelで編集可能 ▲▲▲
        )
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '逆ジオコーディング中に不明なエラーが発生しました。';
      const fallbackName = `地点 (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
       setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: latlng.lat, lng: latlng.lng, name: fallbackName, error: `逆ジオコーディングエラー: ${errorMessage}` } : loc))
           // ▲▲▲ エラー時も、座標から生成した名前を設定 ▲▲▲
        );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
    } finally {
        setPickingLocationId(null); // 地点選択モードを解除
    }
  }, []);

  const handleGenerateRoute = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2) {
      setMapError("ルートを生成するには、出発地と目的地の両方に有効な座標が必要です。各地点の「検索」ボタンを押して座標を取得してください。");
      return;
    }
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
    setMapError(null);
    console.log("Route generation triggered. Locations:", locations);
  }, [locations]);

  const handleSaveProject = useCallback(() => {
    if (pickingLocationId !== null) {
        setMapError("地点選択モード中はプロジェクトを保存できません。地点を選択するかキャンセルしてください。");
        return;
    }
    try {
      // locations にはユーザー編集後の name が含まれている
      const projectData = JSON.stringify({ locations, segmentDurationSeconds, selectedTileLayerId });
      localStorage.setItem('travelRouteProject', projectData);
      alert("プロジェクトを保存しました。");
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("プロジェクトの保存に失敗しました。");
      setMapError("プロジェクトの保存に失敗しました。");
    }
  }, [locations, segmentDurationSeconds, pickingLocationId, selectedTileLayerId]);

  const handleLoadProject = useCallback(() => {
    if (pickingLocationId !== null) {
        setMapError("地点選択モード中はプロジェクトを読み込めません。地点を選択するかキャンセルしてください。");
        return;
    }
    try {
      const savedData = localStorage.getItem('travelRouteProject');
      if (savedData) {
        const projectData = JSON.parse(savedData);
        if (projectData.locations) setLocations(projectData.locations); // 保存されたnameが復元される
        if (typeof projectData.segmentDurationSeconds === 'number') {
            const duration = Math.max(1, Math.min(600, Math.round(projectData.segmentDurationSeconds)));
            setSegmentDurationSeconds(duration);
        } else {
            setSegmentDurationSeconds(5);
        }
        if (projectData.selectedTileLayerId && availableTileLayers.find(layer => layer.id === projectData.selectedTileLayerId)) {
          setSelectedTileLayerId(projectData.selectedTileLayerId);
        } else {
          setSelectedTileLayerId(availableTileLayers[0].id);
        }
        alert("プロジェクトを読み込みました。");
        setIsPlaying(false);
        setCurrentSegmentIndex(0);
        setMapError(null);
      } else {
        alert("保存されたプロジェクトが見つかりません。");
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      alert("プロジェクトの読み込みに失敗しました。");
      setMapError("プロジェクトの読み込みに失敗しました。");
    }
  }, [pickingLocationId]);

  const handleStopAnimation = useCallback(() => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーションを操作できません。地点を選択するかキャンセルしてください。");
        return;
    }
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
    setMapError(null);
  }, [pickingLocationId]);

  const handlePlayPauseToggle = useCallback(() => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーションを操作できません。地点を選択するかキャンセルしてください。");
        return;
    }
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2 && !isPlaying) {
        setMapError("アニメーションを開始するには、まず有効な経路を生成してください。");
        return;
    }
    setMapError(null);
    setIsPlaying(prevIsPlaying => {
      const newIsPlaying = !prevIsPlaying;
      if (newIsPlaying && currentSegmentIndex >= validLocations.length - 1 && validLocations.length > 1) {
          setCurrentSegmentIndex(0);
      }
      return newIsPlaying;
    });
  }, [isPlaying, locations, currentSegmentIndex, pickingLocationId]);

  const handleDurationChange = useCallback((newDuration: number) => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーション速度を変更できません。地点を選択するかキャンセルしてください。");
        return;
    }
    const validatedDuration = Math.max(1, Math.min(600, Math.round(newDuration)));
    setSegmentDurationSeconds(validatedDuration);
  }, [pickingLocationId]);

   const handleSegmentComplete = useCallback(() => {
    setCurrentSegmentIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      const validLocationsCount = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined).length;
      if (nextIndex >= validLocationsCount - 1) {
        setIsPlaying(false);
        return 0;
      }
      return nextIndex;
    });
  }, [locations]);

  const handleMapRoutingError = useCallback((message: string) => {
    if (!pickingLocationId) {
        setMapError(message);
    }
    console.warn("Map Routing Error:", message);
  }, [pickingLocationId]);

  const getPickingLocationLabel = useCallback((id: string | null, locs: LocationPoint[]): string => {
    if (!id) return '';
    const loc = locs.find(l => l.id === id);
    // ユーザーが編集した名前があればそれを優先
    if (loc && loc.name && loc.name.trim() !== '' ) return loc.name;

    // デフォルトの表示名生成ロジック
    if (id === 'start') return '出発地';
    if (id === 'end') return '目的地';
    if (id.startsWith('waypoint')) {
      const waypoints = locs.filter(l => l.id.startsWith('waypoint'));
      const waypointIndex = waypoints.findIndex(w => w.id === id);
      return `中継地点 ${waypointIndex >= 0 ? waypointIndex + 1 : '?'}`;
    }
    return loc?.name || id; // フォールバック
  }, []);

  const handleSelectLocationFromMap = useCallback((locationId: string) => {
    if (isPlaying) {
        setMapError("アニメーション再生中は地点を選択できません。アニメーションを停止してください。");
        return;
    }
    if (pickingLocationId !== null && pickingLocationId !== locationId) {
         setMapError(`現在、別の地点 (${getPickingLocationLabel(pickingLocationId, locations)}) を選択中です。まずそちらを完了またはキャンセルしてください。`);
        return;
    }
    if (pickingLocationId === locationId) {
        setPickingLocationId(null);
        setMapError(null);
    } else {
        setPickingLocationId(locationId);
        setMapError(null);
    }
  }, [isPlaying, pickingLocationId, locations, getPickingLocationLabel]);

  const handleMapClickForPicking = useCallback((latlng: L.LatLng) => {
    if (pickingLocationId !== null) {
      handleReverseGeocodeLocation(pickingLocationId, latlng);
    }
  }, [pickingLocationId, handleReverseGeocodeLocation]);

  const handleCancelPicking = useCallback(() => {
    const cancelledPickingId = pickingLocationId;
    setPickingLocationId(null);
    setMapError(null);
    if (cancelledPickingId && geocodingState[cancelledPickingId] === 'loading') {
        setGeocodingState(prev => ({
            ...prev,
            [cancelledPickingId]: 'idle'
        }));
    }
  }, [pickingLocationId, geocodingState]);

  const handleTileLayerChange = useCallback((newTileLayerId: string) => {
    setSelectedTileLayerId(newTileLayerId);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-900 antialiased">
      <Header
        availableTileLayers={availableTileLayers}
        selectedTileLayerId={selectedTileLayerId}
        onTileLayerChange={handleTileLayerChange}
      />
      <div className="flex flex-col md:flex-row flex-1 p-2 md:p-4 gap-2 md:gap-4">
        <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0">
          <ControlPanel
            className="h-full"
            locations={locations}
            transportOptions={initialTransportOptions}
            geocodingState={geocodingState}
            pickingLocationId={pickingLocationId}
            onLocationNameChange={handleLocationNameChange} // これが地点名編集に使われる
            onTransportChange={handleTransportChange}
            onAddWaypoint={addWaypoint}
            onRemoveWaypoint={removeWaypoint}
            onGeocodeLocation={handleGeocodeLocation}     // 地名検索時に呼ばれる
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
            onSelectFromMap={handleSelectLocationFromMap} // 地図から地点選択モード開始
            onGenerateRoute={handleGenerateRoute}
          />
        </div>
        <div className="flex-1 flex flex-col gap-2 md:gap-4">
           {pickingLocationId !== null && (
                <div className="p-3 bg-blue-100 border border-blue-400 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300 rounded-md shadow-sm relative" role="status">
                    <strong className="font-bold">地点選択モード: </strong>
                    <span className="block sm:inline">{`地図上で「${getPickingLocationLabel(pickingLocationId, locations)}」を選択してください。`}</span>
                     <button
                        onClick={handleCancelPicking}
                        className="absolute top-0 bottom-0 right-0 px-3 py-2 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
                        aria-label="キャンセル"
                    >
                        <svg className="fill-current h-5 w-5" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>キャンセル</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                    </button>
                </div>
            )}
          {mapError && !pickingLocationId && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300 rounded-md shadow-sm relative" role="alert">
              <strong className="font-bold">情報: </strong>
              <span className="block sm:inline">{mapError}</span>
              <button
                onClick={() => setMapError(null)}
                className="absolute top-0 bottom-0 right-0 px-3 py-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200"
                aria-label="閉じる"
              >
                <svg className="fill-current h-5 w-5" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>閉じる</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
              </button>
            </div>
          )}
          <main className="bg-white dark:bg-slate-800 rounded-md shadow-md flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px] relative overflow-hidden" id="map-container-wrapper">
            <MapWithNoSSR
              locations={locations} // locations state を渡す (ユーザー編集後の name を含む)
              transportOptions={initialTransportOptions}
              isPlaying={isPlaying}
              currentSegmentIndex={currentSegmentIndex}
              segmentDurationSeconds={segmentDurationSeconds}
              onSegmentComplete={handleSegmentComplete}
              onRoutingError={handleMapRoutingError}
              isPickingLocation={pickingLocationId !== null}
              onMapClickForPicking={handleMapClickForPicking}
              selectedTileLayer={availableTileLayers.find(layer => layer.id === selectedTileLayerId) || availableTileLayers[0]}
            />
          </main>
          <AnimationControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPauseToggle}
            onStop={handleStopAnimation}
            durationSeconds={segmentDurationSeconds}
            onDurationChange={handleDurationChange}
          />
        </div>
      </div>
    </div>
  );
}