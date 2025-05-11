// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import PreviewOutput from '@/components/PreviewOutput';

export interface LocationPoint {
  id: string;
  name: string;
  transport: string;
  lat?: number;
  lng?: number;
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

  const handleLocationNameChange = useCallback((id: string, newName: string) => {
    setLocations(prevLocations =>
      prevLocations.map(loc => (loc.id === id ? { ...loc, name: newName, lat: undefined, lng: undefined } : loc))
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
  }, [locations, initialTransportOptions]);

  const removeWaypoint = useCallback((idToRemove: string) => {
    setLocations(prevLocations => prevLocations.filter(loc => loc.id !== idToRemove));
  }, []);

  const handleGeocodeLocation = useCallback(async (locationId: string, locationName: string) => {
    if (!locationName.trim()) {
      console.log(`Geocoding skipped for ${locationId}: name is empty.`);
      setLocations(prevLocations =>
        prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: undefined, lng: undefined } : loc))
      );
      return;
    }
    console.log(`Geocoding for ${locationId}: ${locationName}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const mockLat = 35.0 + Math.random() * 2;
    const mockLng = 139.0 + Math.random() * 2;
    console.log(`Mock geocoded ${locationId} (${locationName}) to: lat=${mockLat}, lng=${mockLng}`);
    setLocations(prevLocations =>
      prevLocations.map(loc =>
        loc.id === locationId ? { ...loc, lat: mockLat, lng: mockLng } : loc
      )
    );
  }, []);

  const handleGenerateRoute = useCallback(() => {
    console.log("Route generation requested with locations:", locations);
  }, [locations]);

  const handleSaveProject = useCallback(() => console.log("Save project clicked", locations), [locations]);
  const handleLoadProject = useCallback(() => console.log("Load project clicked"), []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 antialiased">
      <Header />
      {/* メインコンテンツエリアの高さを指定し、overflow-hidden を追加 */}
      <div className="flex flex-1 overflow-hidden pt-2 px-2 pb-2 space-x-2">
        {/* 左パネル：高さを指定し、内部でスクロールできるようにする */}
        <div className="w-[380px] flex-shrink-0 flex flex-col space-y-2 overflow-hidden"> {/* overflow-hidden を追加 */}
          <ControlPanel
            className="flex-1 min-h-0" // flex-1 と min-h-0 を追加して高さを柔軟にし、スクロールを有効にする
            locations={locations}
            transportOptions={initialTransportOptions}
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
            <MapWithNoSSR />
          </main>
          <AnimationControls />
        </div>
      </div>
      <PreviewOutput />
    </div>
  );
}
