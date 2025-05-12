// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import L from 'leaflet';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas'; // html2canvas をインポート

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

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameIdForRecordingRef = useRef<number | null>(null);
  const canvasForRecordingRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
  }, [locations]);

  // --- Location and Transport Handlers ---
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
      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=jsonv2&limit=1`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteAnimationApp/1.0 (user@example.com)' } });
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

  const handleReverseGeocodeLocation = useCallback(async (locationId: string, latlng: L.LatLng) => {
    setGeocodingState(prev => ({...prev, [locationId]: 'loading'}));
    setMapError(null);
    try {
      const apiUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=jsonv2`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelRouteAnimationApp/1.0 (user@example.com)' } });
      if (!response.ok) throw new Error(`逆ジオコーディングサーバーエラー: ${response.statusText} (${response.status})`);
      const data = await response.json();
      if (data && data.display_name) {
        const display_name = data.display_name;
        setLocations(prevLocations =>
          prevLocations.map(loc =>
            loc.id === locationId ? { ...loc, lat: latlng.lat, lng: latlng.lng, name: display_name, error: undefined } : loc
          )
        );
        setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      } else {
        setLocations(prevLocations =>
          prevLocations.map(loc =>
            loc.id === locationId ? { ...loc, lat: latlng.lat, lng: latlng.lng, name: `地点 (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`, error: undefined } : loc
          )
        );
         setGeocodingState(prev => ({...prev, [locationId]: 'idle'}));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '逆ジオコーディング中に不明なエラーが発生しました。';
       setLocations(prevLocations =>
          prevLocations.map(loc => (loc.id === locationId ? { ...loc, lat: latlng.lat, lng: latlng.lng, name: `地点 (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`, error: `逆ジオコーディングエラー: ${errorMessage}` } : loc))
        );
      setGeocodingState(prev => ({...prev, [locationId]: 'error'}));
    } finally {
        setPickingLocationId(null); // 地点選択モードを終了
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
      const projectData = JSON.stringify({ locations, segmentDurationSeconds });
      localStorage.setItem('travelRouteProject', projectData);
      alert("プロジェクトを保存しました。");
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("プロジェクトの保存に失敗しました。");
      setMapError("プロジェクトの保存に失敗しました。");
    }
  }, [locations, segmentDurationSeconds, pickingLocationId]);

  const handleLoadProject = useCallback(() => {
    if (pickingLocationId !== null) {
        setMapError("地点選択モード中はプロジェクトを読み込めません。地点を選択するかキャンセルしてください。");
        return;
    }
    try {
      const savedData = localStorage.getItem('travelRouteProject');
      if (savedData) {
        const projectData = JSON.parse(savedData);
        if (projectData.locations) setLocations(projectData.locations);
        if (typeof projectData.segmentDurationSeconds === 'number') {
            const duration = Math.max(1, Math.min(600, Math.round(projectData.segmentDurationSeconds)));
            setSegmentDurationSeconds(duration);
        } else {
            setSegmentDurationSeconds(5); // デフォルト値
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

  // --- Recording Handlers ---
  const stopRecording = useCallback(() => {
    console.log("Attempting to stop recording. MediaRecorder state:", mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // This will trigger the 'onstop' event
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
        console.log("MediaRecorder already inactive, cleaning up animation frame.");
    }

    // Stop the animation frame loop for recording
    if (animationFrameIdForRecordingRef.current) {
      cancelAnimationFrame(animationFrameIdForRecordingRef.current);
      animationFrameIdForRecordingRef.current = null;
      console.log("Recording animation frame cancelled.");
    }

    // Clean up canvas if it exists
    if (canvasForRecordingRef.current) {
        const ctx = canvasForRecordingRef.current.getContext('2d');
        if (ctx) {
            // Clear the canvas
            ctx.clearRect(0, 0, canvasForRecordingRef.current.width, canvasForRecordingRef.current.height);
        }
        // If the canvas was appended for debugging, remove it
        if (canvasForRecordingRef.current.parentNode === document.body) {
          document.body.removeChild(canvasForRecordingRef.current);
          console.log("Debug canvas removed from body.");
        }
    }
    setIsRecording(false);
    console.log("Stop recording requested and processed.");
  }, []);


  const startRecording = useCallback(async () => {
    if (!window.MediaRecorder) {
      setMapError('お使いのブラウザは録画機能に対応していません。');
      return;
    }

    const mapElement = document.getElementById('map-container');
    if (!mapElement) {
      setMapError('地図要素が見つかりません。録画を開始できません。');
      return;
    }
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2) {
      setMapError("録画を開始するには、まず有効な経路を生成してください。");
      return;
    }

    try {
      // Ensure canvas exists or create it
      if (!canvasForRecordingRef.current) {
        canvasForRecordingRef.current = document.createElement('canvas');
        // Optional: Append for debugging (ensure it's removed on stop)
        // canvasForRecordingRef.current.style.position = 'fixed'; // ... etc.
        // document.body.appendChild(canvasForRecordingRef.current);
        // console.log("Recording canvas created.");
      }
      const targetCanvas = canvasForRecordingRef.current;
      // Match map element's dimensions
      targetCanvas.width = mapElement.offsetWidth;
      targetCanvas.height = mapElement.offsetHeight;
      console.log(`Recording canvas size set to: ${targetCanvas.width}x${targetCanvas.height}`);

      // Get stream from the target canvas
      streamRef.current = targetCanvas.captureStream(10); // 10 FPS
      console.log("Canvas stream captured at 10fps.");

      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                      ? { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1000000 } // 1 Mbps
                      : MediaRecorder.isTypeSupported('video/webm')
                      ? { mimeType: 'video/webm', videoBitsPerSecond: 1000000 }
                      : { videoBitsPerSecond: 1000000 }; // Fallback, browser might choose codec
      console.log("MediaRecorder options:", options);

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      recordedChunksRef.current = []; // Clear previous chunks

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          console.log(`ondataavailable: chunk size=${event.data.size}, type=${event.data.type}`);
          recordedChunksRef.current.push(event.data);
        } else {
          console.log("ondataavailable: empty chunk received at", Date.now());
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log("onstop triggered. Recorded chunks length:", recordedChunksRef.current.length);
        // Log details of each chunk for debugging
        if (recordedChunksRef.current.length > 0) {
            recordedChunksRef.current.forEach((chunk, index) => {
                console.log(`Chunk ${index}: size=${chunk.size}, type=${chunk.type}`);
            });
        }

        // Clean up resources
        if (animationFrameIdForRecordingRef.current) {
          cancelAnimationFrame(animationFrameIdForRecordingRef.current);
          animationFrameIdForRecordingRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            console.log("Stream tracks stopped in onstop.");
        }
        // If canvas was appended for debugging, remove it
        if (targetCanvas && targetCanvas.parentNode === document.body) {
             document.body.removeChild(targetCanvas);
             console.log("Debug canvas removed from body.");
        }

        if (recordedChunksRef.current.length === 0) {
          setMapError("録画データが空です。");
          // setIsRecording(false); // Already set in stopRecording
          return;
        }
        // Save the recording
        try {
            const blob = new Blob(recordedChunksRef.current, { type: options.mimeType || 'video/webm' });
            const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
            const filename = `travel-animation-${timestamp}.webm`;
            saveAs(blob, filename);
            console.log("Video saved as:", filename, "size:", blob.size);
        } catch(saveError) {
             console.error("Failed to save video:", saveError);
             setMapError("動画ファイルの保存に失敗しました。");
        } finally {
            recordedChunksRef.current = []; // Clear chunks after saving
        }
        // setIsRecording(false); // Already set in stopRecording
      };

      mediaRecorderRef.current.onerror = (event: Event) => {
        console.error("MediaRecorder error:", event);
        if (animationFrameIdForRecordingRef.current) {
            cancelAnimationFrame(animationFrameIdForRecordingRef.current);
            animationFrameIdForRecordingRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }
        if (targetCanvas && targetCanvas.parentNode === document.body) { // デバッグ用に追加した場合のみ削除
             document.body.removeChild(targetCanvas);
        }
        let errorMessage = '録画中に不明なエラーが発生しました。';
        // Try to get more specific error message
        if (event instanceof DOMException) {
          errorMessage = event.message;
        } else if ('error' in event && event.error instanceof Error) {
           errorMessage = event.error.message;
        }
        setMapError(`録画エラー: ${errorMessage}`);
        setIsRecording(false); // Ensure recording state is reset
      };

      // Ensure animation is playing if it's not already
      if (!isPlaying) {
          setIsPlaying(true); // Start animation
          setCurrentSegmentIndex(0); // Reset to start if needed
      }

      mediaRecorderRef.current.start(200); // Start recording, gather data every 200ms
      setIsRecording(true);
      setMapError(null); // Clear any previous errors
      console.log("Recording started with MediaRecorder.start(200) at", Date.now());

      // Start drawing map to canvas
      let frameCount = 0;
      const drawMapToCanvas = async () => {
        // Check if we should continue recording
        if (!isRecording || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording' || !mapElement || !targetCanvas) {
          if (animationFrameIdForRecordingRef.current) {
            cancelAnimationFrame(animationFrameIdForRecordingRef.current);
            animationFrameIdForRecordingRef.current = null;
          }
          return;
        }
        try {
          // Capture the map element using html2canvas
          const canvas = await html2canvas(mapElement, {
            useCORS: true, // Important for external images like map tiles
            logging: false, // Disable html2canvas console logs
            width: mapElement.offsetWidth, // Explicitly set width
            height: mapElement.offsetHeight, // Explicitly set height
          });
          // Draw the captured image onto our target recording canvas
          const ctx = targetCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height); // Clear previous frame
            ctx.drawImage(canvas, 0, 0, targetCanvas.width, targetCanvas.height);
            // Optional: Log a small part of the canvas data for debugging
            frameCount++;
            if (frameCount % 30 === 0) { // Log every 30 frames (approx every 3 seconds at 10fps stream)
                console.log(`Recording canvas content (frame ${frameCount}):`, targetCanvas.toDataURL('image/png').substring(0, 100) + "...");
            }
          }
        } catch (captureError) {
          console.error("Error capturing map with html2canvas:", captureError);
          // Consider stopping recording or notifying user if capture fails repeatedly
        }
        // Request next frame
        animationFrameIdForRecordingRef.current = requestAnimationFrame(drawMapToCanvas);
      };
      drawMapToCanvas(); // Start the drawing loop

    } catch (err) {
      console.error('録画の開始に失敗しました:', err);
      setMapError(`録画の開始に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
      setIsRecording(false); // Reset recording state
      // Clean up animation frame if it was started
      if (animationFrameIdForRecordingRef.current) {
        cancelAnimationFrame(animationFrameIdForRecordingRef.current);
        animationFrameIdForRecordingRef.current = null;
      }
       // Clean up canvas if it was appended for debugging
       if (canvasForRecordingRef.current && canvasForRecordingRef.current.parentNode === document.body) {
           document.body.removeChild(canvasForRecordingRef.current);
       }
    }
  }, [isPlaying, locations]); // isPlaying と locations を依存配列に追加


  // --- Animation Handlers ---
  const handleStopAnimation = useCallback(() => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーションを操作できません。地点を選択するかキャンセルしてください。");
        return;
    }
    if (isRecording) {
      stopRecording(); // Stop recording if it's active
    }
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
    setMapError(null);
  }, [pickingLocationId, isRecording, stopRecording]);

  const handlePlayPauseToggle = useCallback(() => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーションを操作できません。地点を選択するかキャンセルしてください。");
        return;
    }
    if (isRecording) {
        setMapError("録画中は再生/一時停止できません。"); // Prevent play/pause during recording
        return;
    }
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2 && !isPlaying) { // Only block if trying to start without valid route
        setMapError("アニメーションを開始するには、まず有効な経路を生成してください。");
        return;
    }
    setMapError(null);
    setIsPlaying(prev => !prev);
    // If starting from a completed state, reset to beginning
    if (!isPlaying && currentSegmentIndex >= validLocations.length - 1 && validLocations.length > 1) {
        setCurrentSegmentIndex(0);
    }
  }, [isPlaying, locations, currentSegmentIndex, pickingLocationId, isRecording]);

  const handleDurationChange = useCallback((newDuration: number) => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーション速度を変更できません。地点を選択するかキャンセルしてください。");
        return;
    }
    if (isRecording) {
        setMapError("録画中はアニメーション速度を変更できません。");
        return;
    }
    // Validate and set duration
    const validatedDuration = Math.max(1, Math.min(600, Math.round(newDuration))); // e.g., 1 to 600 seconds
    setSegmentDurationSeconds(validatedDuration);
  }, [pickingLocationId, isRecording]);

   const handleSegmentComplete = useCallback(() => {
    setCurrentSegmentIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      const validLocationsCount = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined).length;

      if (nextIndex >= validLocationsCount - 1) { // Last segment completed or no more segments
        setIsPlaying(false); // Stop animation
        if (isRecording) {
            stopRecording(); // If recording, stop it as animation ended
        }
        return 0; // Reset to the beginning for next play
      }
      return nextIndex; // Move to the next segment
    });
  }, [locations, isRecording, stopRecording]);

  // Map Interaction Handlers
  const handleMapRoutingError = useCallback((message: string) => {
    // Display routing errors from the Map component, unless in picking mode
    if (!pickingLocationId) { // Don't show map routing errors while user is picking a location
        setMapError(message);
    }
  }, [pickingLocationId]);

  // Helper to get a user-friendly label for the location being picked
  const getPickingLocationLabel = useCallback((id: string | null, locs: LocationPoint[]): string => {
    if (!id) return '';
    const loc = locs.find(l => l.id === id);
    if (loc && loc.name) return loc.name; // Use existing name if available

    if (id === 'start') return '出発地';
    if (id === 'end') return '目的地';
    if (id.startsWith('waypoint')) {
      // Try to find its index among waypoints (excluding start/end)
      const waypoints = locs.filter(l => l.id.startsWith('waypoint'));
      const waypointIndex = waypoints.findIndex(w => w.id === id);
      return `中継地点 ${waypointIndex + 1}`; // 1-based index
    }
    return id; // Fallback to id
  }, []);


  const handleSelectLocationFromMap = useCallback((locationId: string) => {
    if (isPlaying) {
        setMapError("アニメーション再生中は地点を選択できません。アニメーションを停止してください。");
        return;
    }
    if (isRecording) {
        setMapError("録画中は地点を選択できません。録画を停止してください。");
        return;
    }
    if (pickingLocationId !== null && pickingLocationId !== locationId) {
         // Already picking another location
         setMapError(`現在、別の地点 (${getPickingLocationLabel(pickingLocationId, locations)}) を選択中です。まずそちらを完了またはキャンセルしてください。`);
        return;
    }
    if (pickingLocationId === locationId) { // Clicking the same "select from map" button again cancels it
        setPickingLocationId(null);
        setMapError(null);
    } else {
        setPickingLocationId(locationId);
        setMapError(null); // Clear other errors when entering picking mode
    }
  }, [isPlaying, isRecording, pickingLocationId, locations, getPickingLocationLabel]);


  const handleMapClickForPicking = useCallback((latlng: L.LatLng) => {
    if (pickingLocationId !== null) {
      // We are in picking mode, and map was clicked.
      // Call reverse geocoding for the clicked latlng and update the pickingLocationId's data.
      handleReverseGeocodeLocation(pickingLocationId, latlng);
      // setPickingLocationId(null); // Moved to handleReverseGeocodeLocation's finally block
    }
  }, [pickingLocationId, handleReverseGeocodeLocation]);

  const handleCancelPicking = useCallback(() => {
    const cancelledPickingId = pickingLocationId; // Store ID before clearing
    setPickingLocationId(null);
    setMapError(null);
    // If the geocoding was in 'loading' state for this ID, reset it to 'idle'
    if (cancelledPickingId && geocodingState[cancelledPickingId] === 'loading') {
        setGeocodingState(prev => ({
            ...prev,
            [cancelledPickingId]: 'idle'
        }));
    }
  }, [pickingLocationId, geocodingState]);


  // --- UI Rendering ---
  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-900 antialiased">
      <Header />
      <div className="flex flex-col md:flex-row flex-1 p-2 md:p-4 gap-2 md:gap-4">
        <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0">
          <ControlPanel
            className="h-full"
            locations={locations}
            transportOptions={initialTransportOptions}
            geocodingState={geocodingState}
            pickingLocationId={pickingLocationId} // Pass pickingLocationId to ControlPanel
            onLocationNameChange={handleLocationNameChange}
            onTransportChange={handleTransportChange}
            onAddWaypoint={addWaypoint}
            onRemoveWaypoint={removeWaypoint}
            onGeocodeLocation={handleGeocodeLocation}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
            onSelectFromMap={handleSelectLocationFromMap} // This should now be correctly found
            onGenerateRoute={handleGenerateRoute}
          />
        </div>
        <div className="flex-1 flex flex-col gap-2 md:gap-4">
           {pickingLocationId !== null && ( // Display picking mode status
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
          {mapError && !pickingLocationId && ( // Display general map errors only if not in picking mode
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
              isPlaying={isPlaying}
              currentSegmentIndex={currentSegmentIndex}
              segmentDurationSeconds={segmentDurationSeconds}
              onSegmentComplete={handleSegmentComplete}
              onRoutingError={handleMapRoutingError}
              isPickingLocation={pickingLocationId !== null} // Pass picking mode status to Map
              onMapClickForPicking={handleMapClickForPicking} // Handler for map clicks in picking mode
            />
          </main>
          <AnimationControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPauseToggle}
            onStop={handleStopAnimation}
            durationSeconds={segmentDurationSeconds}
            onDurationChange={handleDurationChange}
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
        </div>
      </div>
    </div>
  );
}