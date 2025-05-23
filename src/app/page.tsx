// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'; // useRef を追加
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import L from 'leaflet';
import { availableTileLayers } from '@/config/mapLayers';

export interface LocationPoint {
  id: string;
  name: string;
  transport: string;
  lat?: number;
  lng?: number;
  error?: string;
  showLabel?: boolean;
  photoDataUrl?: string | null;
}

export interface TransportOption {
  name: string;
  label: string;
}

// ★ 新しいアニメーション状態の型
type AnimationPhase = 'stopped' | 'preDelay' | 'animating' | 'postDelay';

const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full bg-gray-200 dark:bg-gray-700"><p className="text-slate-700 dark:text-slate-200">地図を読み込み中です...</p></div>,
});

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
    { id: 'start', name: '東京タワー', transport: initialTransportOptions[0].name, lat: 35.6585805, lng: 139.7454329, showLabel: true, photoDataUrl: null },
    { id: 'end', name: '大阪城', transport: initialTransportOptions[0].name, lat: 34.6873153, lng: 135.5259603, showLabel: true, photoDataUrl: null },
  ]);

  const [geocodingState, setGeocodingState] = useState<Record<string, 'idle' | 'loading' | 'error'>>({});
  const [isPlayingUi, setIsPlayingUi] = useState(false); // UIの再生/一時停止ボタンの状態
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('stopped'); // アニメーションの実際のフェーズ
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [segmentDurationSeconds, setSegmentDurationSeconds] = useState(5);
  const [mapError, setMapError] = useState<string | null>(null);
  const [pickingLocationId, setPickingLocationId] = useState<string | null>(null);
  const [selectedTileLayerId, setSelectedTileLayerId] = useState<string>(availableTileLayers[0].id);

  // animationPhase の最新値を setTimeout/Interval 内で参照するためのRef
  const animationPhaseRef = useRef(animationPhase);
  useEffect(() => {
    animationPhaseRef.current = animationPhase;
  }, [animationPhase]);

  // locationsが変更されたらアニメーションを停止状態にする
  useEffect(() => {
    setAnimationPhase('stopped');
    setIsPlayingUi(false);
    setCurrentSegmentIndex(0);
  }, [locations]);

  const handleLocationNameChange = useCallback((id: string, newName: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, name: newName, error: undefined } : loc))
    );
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
      newLocations.splice(endIndex, 0, { id: newWaypointId, name: '', transport: initialTransportOptions[0].name, showLabel: true, photoDataUrl: null });
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

  const handleGeocodeLocation = useCallback(async (locationId: string, locationNameFromInput: string) => {
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
            loc.id === locationId ? { ...loc, lat: parseFloat(lat), lng: parseFloat(lon), name: display_name, error: undefined, showLabel: loc.showLabel === undefined ? true : loc.showLabel } : loc
          )
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      } else {
        setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: '地点が見つかりません。検索ワードを変えてみてください。', name: locationNameFromInput } : loc))
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ジオコーディング中に不明なエラーが発生しました。';
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: errorMessage, name: locationNameFromInput } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
    }
  }, []);

  const handleReverseGeocodeLocation = useCallback(async (locationId: string, latlng: L.LatLng) => {
    setGeocodingState(prev => ({...prev, [locationId]: 'loading'}));
    setMapError(null);
    try {
      const apiUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=jsonv2`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteAnimationApp/1.0 (user@example.com)' } });
      if (!response.ok) throw new Error(`逆ジオコーディングサーバーエラー: ${response.statusText} (${response.status})`);
      const data = await response.json();
      let newName: string;
      if (data && data.display_name) {
        newName = data.display_name;
      } else {
        newName = `地点 (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
      }
      setLocations(prevLocations =>
        prevLocations.map(loc =>
          loc.id === locationId ? { ...loc, lat: latlng.lat, lng: latlng.lng, name: newName, error: undefined, showLabel: loc.showLabel === undefined ? true : loc.showLabel } : loc
        )
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '逆ジオコーディング中に不明なエラーが発生しました。';
      const fallbackName = `地点 (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
       setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: latlng.lat, lng: latlng.lng, name: fallbackName, error: `逆ジオコーディングエラー: ${errorMessage}` } : loc))
        );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
    } finally {
        setPickingLocationId(null);
    }
  }, []);

  const handleGenerateRoute = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2) {
      setMapError("ルートを生成するには、出発地と目的地の両方に有効な座標が必要です。各地点の「検索」ボタンを押して座標を取得してください。");
      return;
    }
    setAnimationPhase('stopped'); // ルート再生成時はアニメーション停止
    setIsPlayingUi(false);
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
      const locationsToSave = locations.map(loc => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { photoDataUrl, ...rest } = loc;
        return rest;
      });
      const projectData = JSON.stringify({ locations: locationsToSave, segmentDurationSeconds, selectedTileLayerId });
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
        if (projectData.locations) {
            const loadedLocations = projectData.locations.map((loc: Omit<LocationPoint, 'photoDataUrl'>) => ({
                ...loc,
                showLabel: loc.showLabel === undefined ? true : loc.showLabel,
                photoDataUrl: null,
            }));
            setLocations(loadedLocations);
        }
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
        setAnimationPhase('stopped');
        setIsPlayingUi(false);
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
    setAnimationPhase('stopped');
    setIsPlayingUi(false);
    setCurrentSegmentIndex(0);
    setMapError(null);
  }, [pickingLocationId]);

  const handlePlayPauseToggle = useCallback(() => {
    if (pickingLocationId !== null) {
       setMapError("地点選択モード中はアニメーションを操作できません。地点を選択するかキャンセルしてください。");
       return;
   }
   const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
   if (validLocations.length < 2 && animationPhaseRef.current === 'stopped') {
       setMapError("アニメーションを開始するには、まず有効な経路を生成してください。");
       return;
   }
   setMapError(null);

   if (animationPhaseRef.current === 'stopped') {
     setCurrentSegmentIndex(0);
     setAnimationPhase('preDelay');
     setIsPlayingUi(true);
     setTimeout(() => {
       if (animationPhaseRef.current === 'preDelay') { // ディレイ中に停止されていないか確認
         setAnimationPhase('animating');
       }
     }, 1000);
   } else if (animationPhaseRef.current === 'animating') {
     setAnimationPhase('stopped'); // アニメーション中に押されたら即停止
     setIsPlayingUi(false);
   } else if (animationPhaseRef.current === 'preDelay' || animationPhaseRef.current === 'postDelay') {
     setAnimationPhase('stopped'); // ディレイ中に押されたら即停止
     setIsPlayingUi(false);
   }
 }, [locations, pickingLocationId]); // animationPhaseRefは常に最新なので依存配列に含めない

  const handleDurationChange = useCallback((newDuration: number) => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーション速度を変更できません。地点を選択するかキャンセルしてください。");
        return;
    }
    const validatedDuration = Math.max(1, Math.min(600, Math.round(newDuration)));
    setSegmentDurationSeconds(validatedDuration);
  }, [pickingLocationId]);

  const handleSegmentComplete = useCallback(() => {
    const validLocationsCount = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined).length;
    // setCurrentSegmentIndex のコールバック内で animationPhaseRef.current を参照
    setCurrentSegmentIndex(prevIndex => {
      if (animationPhaseRef.current !== 'animating') return prevIndex; // animating 中でなければ何もしない

      const nextIndex = prevIndex + 1;
      if (nextIndex >= validLocationsCount - 1) {
        setAnimationPhase('postDelay');
        setTimeout(() => {
          if (animationPhaseRef.current === 'postDelay') { // ディレイ中に停止されていないか確認
            setAnimationPhase('stopped');
            setIsPlayingUi(false);
            // setCurrentSegmentIndex(0); // ここで0に戻すと最後の地点にアイコンが残らないので、再生開始時に0にする
          }
        }, 1000);
        return prevIndex; // インデックスは最終地点のものを維持
      }
      return nextIndex; // 次のセグメントへ
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
    if (loc && loc.name && loc.name.trim() !== '' ) return loc.name;
    if (id === 'start') return '出発地';
    if (id === 'end') return '目的地';
    if (id.startsWith('waypoint')) {
      const waypoints = locs.filter(l => l.id.startsWith('waypoint'));
      const waypointIndex = waypoints.findIndex(w => w.id === id);
      return `中継地点 ${waypointIndex >= 0 ? waypointIndex + 1 : '?'}`;
    }
    return loc?.name || id;
  }, []);

  const handleSelectLocationFromMap = useCallback((locationId: string) => {
    if (animationPhaseRef.current !== 'stopped') { // アニメーション関連の操作中は地点選択不可
        setMapError("アニメーション中は地点を選択できません。アニメーションを停止してください。");
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
  }, [pickingLocationId, locations, getPickingLocationLabel]); // animationPhaseRefは依存配列に含めない

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

  const handleToggleLocationLabel = useCallback((id: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc =>
        loc.id === id ? { ...loc, showLabel: !(loc.showLabel ?? true) } : loc
      )
    );
  }, []);

  const handlePhotoChange = useCallback((locationId: string, file: File | null) => {
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMapError(`画像ファイルサイズが大きすぎます (最大2MB)。地点「${locations.find(l=>l.id===locationId)?.name || locationId}」`);
        const fileInput = document.getElementById(`photo-input-${locationId}`) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocations(prevLocations =>
          prevLocations.map(loc =>
            loc.id === locationId ? { ...loc, photoDataUrl: reader.result as string } : loc
          )
        );
        setMapError(null);
      };
      reader.onerror = () => {
        setMapError(`写真の読み込みに失敗しました。地点「${locations.find(l=>l.id===locationId)?.name || locationId}」`);
        const fileInput = document.getElementById(`photo-input-${locationId}`) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      };
      reader.readAsDataURL(file);
    } else {
      setLocations(prevLocations =>
        prevLocations.map(loc =>
          loc.id === locationId ? { ...loc, photoDataUrl: null } : loc
        )
      );
    }
  }, [locations]);

  const handleRemovePhoto = useCallback((locationId: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc =>
        loc.id === locationId ? { ...loc, photoDataUrl: null } : loc
      )
    );
    const fileInput = document.getElementById(`photo-input-${locationId}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
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
            onLocationNameChange={handleLocationNameChange}
            onTransportChange={handleTransportChange}
            onAddWaypoint={addWaypoint}
            onRemoveWaypoint={removeWaypoint}
            onGeocodeLocation={handleGeocodeLocation}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
            onSelectFromMap={handleSelectLocationFromMap}
            onGenerateRoute={handleGenerateRoute}
            onToggleLocationLabel={handleToggleLocationLabel}
            onPhotoChange={handlePhotoChange}
            onRemovePhoto={handleRemovePhoto}
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
              locations={locations}
              transportOptions={initialTransportOptions}
              animationPhase={animationPhase} // ★ isPlaying の代わりに animationPhase を渡す
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
            isPlaying={isPlayingUi} // UIボタンの表示は isPlayingUi を使う
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