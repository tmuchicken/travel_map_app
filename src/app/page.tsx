// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import PreviewOutput from '@/components/PreviewOutput';

// 型定義 (前回と同様)
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
    { name: 'Bus', label: '🚌' },
    { name: 'Plane', label: '✈️' },
    { name: 'Train', label: '🚆' },
    { name: 'Car', label: '🚗' },
    { name: 'Ship', label: '⛴' },
    { name: 'Walk', label: '🚶' },
  ], []);

  const [locations, setLocations] = useState<LocationPoint[]>([
    { id: 'start', name: '', transport: initialTransportOptions[0].name },
    { id: 'end', name: '', transport: initialTransportOptions[0].name },
  ]);

  const [geocodingState, setGeocodingState] = useState<Record<string, 'idle' | 'loading' | 'error'>>({});

  // 各ハンドラ関数は前回と同様なので省略 (handleLocationNameChange, handleTransportChange, etc.)
  // ... (前回のコードからハンドラ関数をコピーしてください) ...
  const handleLocationNameChange = useCallback((id: string, newName: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, name: newName, lat: undefined, lng: undefined, error: undefined } : loc))
    );
    setGeocodingState(prev => ({...prev, [id]: 'idle'}));
  }, []);

  const handleTransportChange = useCallback((id: string, newTransport: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, transport: newTransport } : loc))
    );
  }, []);

  const addWaypoint = useCallback(() => {
    const newWaypointId = `waypoint-${locations.filter(loc => loc.id.startsWith('waypoint')).length + 1}`;
    setLocations(prevLocations => {
      const endIndex = prevLocations.findIndex(loc => loc.id === 'end');
      const newLocations = [...prevLocations];
      newLocations.splice(endIndex, 0, { id: newWaypointId, name: '', transport: initialTransportOptions[0].name });
      return newLocations;
    });
  }, [locations, initialTransportOptions]);

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
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: undefined } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      return;
    }
    setGeocodingState(prev => ({...prev, [locationId]: 'loading'}));
    try {
      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=jsonv2&limit=1`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteApp/1.0 (contact@example.com)' } }); // User-Agent を設定
      if (!response.ok) throw new Error(`Nominatim API error: ${response.statusText}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setLocations(prevLocations =>
          prevLocations.map(loc =>
            loc.id === locationId ? { ...loc, lat: parseFloat(lat), lng: parseFloat(lon), error: undefined } : loc
          )
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      } else {
        setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: '地点が見つかりません' } : loc))
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ジオコーディングエラー';
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: errorMessage } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
    }
  }, []);

  const handleGenerateRoute = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2) {
      alert("ルートを生成するには、少なくとも2つの有効な地点（出発地と目的地）が必要です。");
      return;
    }
    console.log("Route generation requested with valid locations:", validLocations);
  }, [locations]);

  const handleSaveProject = useCallback(() => console.log("Save project clicked", locations), [locations]);
  const handleLoadProject = useCallback(() => console.log("Load project clicked"), []);


  return (
    // 全体の高さを min-h-screen にして、コンテンツが画面より大きい場合はスクロールできるようにする
    <div className="flex flex-col min-h-screen bg-slate-100 antialiased">
      <Header />
      {/* メインコンテンツエリア: 左右2カラム構成 */}
      <div className="flex flex-col md:flex-row flex-1 p-2 md:p-4 gap-2 md:gap-4">
        {/* 左パネル: コントロールパネル */}
        <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0">
          <ControlPanel
            // className="h-full" // 高さを親に合わせる (ControlPanel内部でスクロール)
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

        {/* 右パネル: 地図とアニメーション操作 */}
        <div className="flex-1 flex flex-col gap-2 md:gap-4">
          {/* 地図エリア: 高さを指定 (例: 画面の半分程度、または固定値) */}
          <main className="bg-white rounded-md shadow-md flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px]">
            <MapWithNoSSR
              locations={locations}
            />
          </main>
          {/* アニメーション操作エリア */}
          <AnimationControls />
        </div>
      </div>

      {/* プレビュー・出力設定エリア */}
      <div className="p-2 md:p-4">
        <PreviewOutput />
      </div>
    </div>
  );
}
