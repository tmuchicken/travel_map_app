// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
// import PreviewOutput from '@/components/PreviewOutput';

export interface LocationPoint {
  id: string;
  name: string;
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
  loading: () => <div className="flex justify-center items-center h-full bg-gray-200"><p>地図を読み込み中です...</p></div>,
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
    { id: 'start', name: '東京タワー', transport: initialTransportOptions[0].name, lat: 35.6585805, lng: 139.7454329 },
    { id: 'end', name: '大阪城', transport: initialTransportOptions[0].name, lat: 34.6873153, lng: 135.5259603 },
  ]);

  const [geocodingState, setGeocodingState] = useState<Record<string, 'idle' | 'loading' | 'error'>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  // ★ 新しい速度設定: 各区間の移動時間 (秒)
  const [segmentDurationSeconds, setSegmentDurationSeconds] = useState(5); // デフォルト5秒
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
    setMapError(null);
  }, [locations]);

  const handleLocationNameChange = useCallback((id: string, newName: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, name: newName, lat: undefined, lng: undefined, error: undefined } : loc))
    );
    setGeocodingState(prev => ({...prev, [id]: 'idle'}));
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

  const handleGeocodeLocation = useCallback(async (locationId: string, locationName: string) => {
    if (!locationName.trim()) {
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: "地点名を入力してください。" } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      return;
    }
    setGeocodingState(prev => ({...prev, [locationId]: 'loading'}));
    setMapError(null);
    try {
      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=jsonv2&limit=1&countrycodes=jp`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteAnimationApp/1.0 (user@example.com)' } }); // 適切なUser-Agentを設定
      if (!response.ok) throw new Error(`ジオコーディングサーバーエラー: ${response.statusText} (${response.status})`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setLocations(prevLocations =>
          prevLocations.map(loc =>
            loc.id === locationId ? { ...loc, lat: parseFloat(lat), lng: parseFloat(lon), name: display_name, error: undefined } : loc
          )
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      } else {
        setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: '地点が見つかりません。検索ワードを変えてみてください。' } : loc))
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ジオコーディング中に不明なエラーが発生しました。';
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: errorMessage } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
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
  }, [locations]);

  const handleSaveProject = useCallback(() => {
    try {
      // ★ 保存するデータに segmentDurationSeconds を含める
      const projectData = JSON.stringify({ locations, segmentDurationSeconds });
      localStorage.setItem('travelRouteProject', projectData);
      alert("プロジェクトを保存しました。");
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("プロジェクトの保存に失敗しました。");
      setMapError("プロジェクトの保存に失敗しました。");
    }
  }, [locations, segmentDurationSeconds]); // ★ 依存配列に segmentDurationSeconds を追加

  const handleLoadProject = useCallback(() => {
    try {
      const savedData = localStorage.getItem('travelRouteProject');
      if (savedData) {
        const projectData = JSON.parse(savedData);
        if (projectData.locations) setLocations(projectData.locations);
        // ★ 読み込むデータに segmentDurationSeconds があれば設定
        if (typeof projectData.segmentDurationSeconds === 'number') {
            const duration = Math.max(1, Math.min(600, Math.round(projectData.segmentDurationSeconds))); // 例: 1秒～600秒(10分)の範囲
            setSegmentDurationSeconds(duration);
        } else {
            setSegmentDurationSeconds(5); // 保存データになければデフォルト5秒
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
  }, []);


  const handlePlayPauseToggle = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2 && !isPlaying) {
        setMapError("アニメーションを開始するには、まず有効な経路を生成してください。");
        return;
    }
    setMapError(null);
    setIsPlaying(prev => !prev);
    if (!isPlaying && currentSegmentIndex >= validLocations.length - 1 && validLocations.length > 1) {
        setCurrentSegmentIndex(0);
    }
  }, [isPlaying, locations, currentSegmentIndex]);

  const handleStopAnimation = useCallback(() => {
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
    setMapError(null);
  }, []);

  // ★ 速度設定ハンドラを区間移動時間用に変更
  const handleDurationChange = useCallback((newDuration: number) => {
    // 例: 1秒から600秒(10分)の範囲に丸める。必要に応じて調整。
    const validatedDuration = Math.max(1, Math.min(600, Math.round(newDuration)));
    setSegmentDurationSeconds(validatedDuration);
  }, []);

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
    setMapError(message);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-50 antialiased">
      <Header />
      <div className="flex flex-col md:flex-row flex-1 p-2 md:p-4 gap-2 md:gap-4">
        <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0">
          <ControlPanel
            className="h-full"
            locations={locations}
            transportOptions={initialTransportOptions}
            geocodingState={geocodingState}
            onLocationNameChange={handleLocationNameChange}
            onTransportChange={handleTransportChange}
            onAddWaypoint={addWaypoint}
            onRemoveWaypoint={removeWaypoint}
            onGeocodeLocation={handleGeocodeLocation}
            onGenerateRoute={handleGenerateRoute}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
          />
        </div>
        <div className="flex-1 flex flex-col gap-2 md:gap-4">
          {mapError && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-sm relative" role="alert">
              <strong className="font-bold">情報: </strong>
              <span className="block sm:inline">{mapError}</span>
              <button
                onClick={() => setMapError(null)}
                className="absolute top-0 bottom-0 right-0 px-3 py-2 text-red-500 hover:text-red-700"
                aria-label="閉じる"
              >
                <svg className="fill-current h-5 w-5" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>閉じる</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
              </button>
            </div>
          )}
          <main className="bg-white dark:bg-slate-800 rounded-md shadow-md flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px] relative overflow-hidden">
            <MapWithNoSSR
              locations={locations}
              transportOptions={initialTransportOptions}
              isPlaying={isPlaying}
              currentSegmentIndex={currentSegmentIndex}
              // ★ props名を segmentDurationSeconds に変更
              segmentDurationSeconds={segmentDurationSeconds}
              onSegmentComplete={handleSegmentComplete}
              onRoutingError={handleMapRoutingError}
            />
          </main>
          <AnimationControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPauseToggle}
            onStop={handleStopAnimation}
            // ★ props名を durationSeconds に変更
            durationSeconds={segmentDurationSeconds}
            // ★ props名を onDurationChange に変更
            onDurationChange={handleDurationChange}
          />
        </div>
      </div>
      {/*
      <div className="p-2 md:p-4">
        <PreviewOutput />
      </div>
      */}
    </div>
  );
}
