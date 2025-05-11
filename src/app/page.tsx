// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo } from 'react'; // useMemo をインポート
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import PreviewOutput from '@/components/PreviewOutput';

// 型定義 (ControlPanelから移動、または共有型ファイルに定義)
export interface LocationPoint {
  id: string;
  name: string;
  transport: string;
  lat?: number; // 緯度 (オプショナル)
  lng?: number; // 経度 (オプショナル)
}

export interface TransportOption { // ControlPanelでも使うのでエクスポート
  name: string;
  // icon: React.JSX.Element; // アイコンの型。ControlPanelで定義されているものを参照
  label: string;
}

// Mapコンポーネントをクライアントサイドでのみレンダリング
const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full bg-gray-200"><p>地図を読み込み中です...</p></div>,
});

export default function HomePage() {
  // ControlPanelで定義されていたtransportIconsの主要な部分（名前とラベル）
  // useMemo を使って initialTransportOptions が再レンダリングのたびに再生成されるのを防ぐ
  const initialTransportOptions: TransportOption[] = useMemo(() => [
    { name: 'Bus', label: '🚌' },
    { name: 'Plane', label: '✈️' },
    { name: 'Train', label: '🚆' },
    { name: 'Car', label: '🚗' },
    { name: 'Ship', label: '⛴' },
    { name: 'Walk', label: '🚶' },
  ], []); // 依存配列は空なので、初回レンダリング時のみ生成

  const [locations, setLocations] = useState<LocationPoint[]>([
    { id: 'start', name: '', transport: initialTransportOptions[0].name },
    { id: 'end', name: '', transport: initialTransportOptions[0].name },
  ]);

  const handleLocationNameChange = useCallback((id: string, newName: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, name: newName, lat: undefined, lng: undefined } : loc)) // 名前変更時は座標をリセット
    );
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
  }, [locations, initialTransportOptions]); // initialTransportOptionsも依存配列に追加

  const removeWaypoint = useCallback((idToRemove: string) => {
    setLocations(prevLocations => prevLocations.filter(loc => loc.id !== idToRemove));
  }, []);

  // ジオコーディング処理 (現時点ではダミー)
  const handleGeocodeLocation = useCallback(async (locationId: string, locationName: string) => {
    if (!locationName.trim()) {
      console.log(`Geocoding skipped for ${locationId}: name is empty.`);
      // 名前が空の場合は座標をクリア
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined } : loc))
      );
      return;
    }

    console.log(`Geocoding for ${locationId}: ${locationName}`);
    // --- ここから実際のジオコーディングAPI呼び出しの代わり (ダミー) ---
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機をシミュレート
    const mockLat = 35.0 + Math.random() * 2; // ダミーの緯度
    const mockLng = 139.0 + Math.random() * 2; // ダミーの経度
    console.log(`Mock geocoded ${locationId} (${locationName}) to: lat=${mockLat}, lng=${mockLng}`);
    // --- ダミー処理ここまで ---

    setLocations(prevLocations =>
      prevLocations.map(loc =>
        loc.id === locationId ? { ...loc, lat: mockLat, lng: mockLng } : loc
      )
    );
  }, []);

  const handleGenerateRoute = useCallback(() => {
    console.log("Route generation requested with locations:", locations);
    // 経路探索API呼び出し処理
  }, [locations]);

  const handleSaveProject = useCallback(() => console.log("Save project clicked", locations), [locations]);
  const handleLoadProject = useCallback(() => console.log("Load project clicked"), []);


  return (
    <div className="flex flex-col h-screen bg-gray-100 antialiased">
      <Header />
      <div className="flex flex-1 overflow-hidden pt-2 px-2 pb-2 space-x-2">
        <div className="w-[380px] flex-shrink-0 flex flex-col space-y-2">
          <ControlPanel
            className="flex-grow"
            locations={locations}
            transportOptions={initialTransportOptions} // ControlPanelに渡す
            onLocationNameChange={handleLocationNameChange}
            onTransportChange={handleTransportChange}
            onAddWaypoint={addWaypoint}
            onRemoveWaypoint={removeWaypoint}
            onGeocodeLocation={handleGeocodeLocation} // ジオコーディング関数を渡す
            onGenerateRoute={handleGenerateRoute}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
          />
        </div>
        <div className="flex-1 flex flex-col space-y-2">
          <main className="flex-1 bg-white rounded-md shadow">
            <MapWithNoSSR 
              // locations={locations} // 将来的にMapコンポーネントにlocationsを渡す
            />
          </main>
          <AnimationControls />
        </div>
      </div>
      <PreviewOutput />
    </div>
  );
}
