// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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

  // Animation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0); // 最初は0番目の区間から
  const [animationSpeed, setAnimationSpeed] = useState(1); // 1倍速

  // 経路情報が変更されたらアニメーションをリセット
  useEffect(() => {
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
  }, [locations]);


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
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteApp/1.0 (your-contact-email@example.com)' } });
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
      alert("ルートを生成するには、出発地と目的地の両方に有効な座標が必要です。各地点の「検索」ボタンを押して座標を取得してください。");
      return;
    }
    console.log("Route generation triggered. Map component will update with new locations:", validLocations);
    // アニメーションを初期状態に戻す
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
    alert("経路情報を更新しました。地図上で経路が再描画されます。「再生」ボタンでアニメーションを開始できます。");
  }, [locations]);

  const handleSaveProject = useCallback(() => console.log("Save project clicked", locations), [locations]);
  const handleLoadProject = useCallback(() => console.log("Load project clicked"), []);

  // Animation Control Handlers
  const handlePlayPauseToggle = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2 && !isPlaying) {
        alert("アニメーションを開始するには、まず有効な経路を生成してください。");
        return;
    }
    setIsPlaying(prev => !prev);
    // もし停止状態から再生を開始し、かつ最後の区間まで再生済みだったら最初に戻す
    if (!isPlaying && currentSegmentIndex >= validLocations.length - 1) {
        setCurrentSegmentIndex(0);
    }
  }, [isPlaying, locations, currentSegmentIndex]);

  const handleStopAnimation = useCallback(() => {
    setIsPlaying(false);
    setCurrentSegmentIndex(0); // アニメーションを最初からにする
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setAnimationSpeed(speed);
  }, []);

  const handleSegmentComplete = useCallback(() => {
    setCurrentSegmentIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
      if (nextIndex >= validLocations.length - 1) { // 全区間アニメーション完了
        setIsPlaying(false);
        return 0; // 次回再生時は最初から
      }
      return nextIndex;
    });
  }, [locations]);


  return (
    <div className="flex flex-col min-h-screen bg-slate-100 antialiased">
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
          <main className="bg-white rounded-md shadow-md flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px]">
            <MapWithNoSSR
              locations={locations}
              transportOptions={initialTransportOptions}
              isPlaying={isPlaying}
              currentSegmentIndex={currentSegmentIndex}
              animationSpeed={animationSpeed}
              onSegmentComplete={handleSegmentComplete}
            />
          </main>
          <AnimationControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPauseToggle}
            onStop={handleStopAnimation}
            speed={animationSpeed}
            onSpeedChange={handleSpeedChange}
          />
        </div>
      </div>
      <div className="p-2 md:p-4">
        <PreviewOutput />
      </div>
    </div>
  );
}
