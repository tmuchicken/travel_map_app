// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import PreviewOutput from '@/components/PreviewOutput';

// 型定義
export interface LocationPoint {
  id: string;
  name: string;
  transport: string;
  lat?: number;
  lng?: number;
  error?: string; // ジオコーディングエラーメッセージ用
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


  const handleLocationNameChange = useCallback((id: string, newName: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, name: newName, lat: undefined, lng: undefined, error: undefined } : loc))
    );
    // 地点名が変更されたら、その地点のジオコーディング状態をリセット
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

  // Nominatim API を使用したジオコーディング処理
  const handleGeocodeLocation = useCallback(async (locationId: string, locationName: string) => {
    if (!locationName.trim()) {
      console.log(`Geocoding skipped for ${locationId}: name is empty.`);
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: undefined } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      return;
    }

    console.log(`Geocoding for ${locationId}: ${locationName}`);
    setGeocodingState(prev => ({...prev, [locationId]: 'loading'})); // ローディング状態に設定

    try {
      // Nominatim APIエンドポイント (User-Agentヘッダーの指定を推奨)
      // 注意: Nominatim APIには利用規約があり、大量リクエストには向きません。
      // 個人利用の範囲で、1秒に1リクエスト程度の頻度を守るようにしてください。
      // アプリケーション名をUser-Agentに含めることが推奨されています。
      // 例: const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteApp/1.0 (your-email@example.com)' } });
      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=jsonv2&limit=1`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Nominatim API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0]; // Nominatimのレスポンスは lon
        console.log(`Geocoded ${locationId} (${locationName}) to: lat=${parseFloat(lat)}, lng=${parseFloat(lon)}`);
        setLocations(prevLocations =>
          prevLocations.map(loc =>
            loc.id === locationId ? { ...loc, lat: parseFloat(lat), lng: parseFloat(lon), error: undefined } : loc
          )
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      } else {
        console.warn(`No results found for ${locationId}: ${locationName}`);
        setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: '地点が見つかりません' } : loc))
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
      }
    } catch (error) {
      console.error(`Geocoding error for ${locationId} (${locationName}):`, error);
      const errorMessage = error instanceof Error ? error.message : 'ジオコーディング中にエラーが発生しました';
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined, error: errorMessage } : loc))
      );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
    }
  }, []); // 依存配列は空でOK (内部で最新のステートを参照しないため)

  const handleGenerateRoute = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2) {
      alert("ルートを生成するには、少なくとも2つの有効な地点（出発地と目的地）が必要です。");
      return;
    }
    console.log("Route generation requested with valid locations:", validLocations);
    // ここで Map.tsx に経路探索を指示する処理を実装
  }, [locations]);

  const handleSaveProject = useCallback(() => console.log("Save project clicked", locations), [locations]);
  const handleLoadProject = useCallback(() => console.log("Load project clicked"), []);


  return (
    <div className="flex flex-col h-screen bg-gray-100 antialiased">
      <Header />
      <div className="flex flex-1 overflow-hidden pt-2 px-2 pb-2 space-x-2">
        <div className="w-[380px] flex-shrink-0 flex flex-col space-y-2 overflow-hidden">
          <ControlPanel
            className="flex-1 min-h-0"
            locations={locations}
            transportOptions={initialTransportOptions}
            geocodingState={geocodingState} // ジオコーディングの状態を渡す
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
        <div className="flex-1 flex flex-col space-y-2">
          <main className="flex-1 bg-white rounded-md shadow">
            <MapWithNoSSR
              locations={locations} // Mapコンポーネントにlocationsを渡す
            />
          </main>
          <AnimationControls />
        </div>
      </div>
      <PreviewOutput />
    </div>
  );
}
