// src/app/page.tsx
"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ControlPanel from '@/components/ControlPanel';
import AnimationControls from '@/components/AnimationControls';
import L from 'leaflet';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

export interface LocationPoint {
  id: string;
  name: string;
  transport: string;
  lat?: number;
  lng?: number;
  error?: string;
}

export interface TransportOption {
  name:string;
  label: string;
}

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
  const lastFrameTimeRef = useRef<number>(0); // フレーム描画間隔制御用
  const frameCaptureInterval = 100; // 100msごと (10FPS相当) を目指す

  useEffect(() => {
    setIsPlaying(false);
    setCurrentSegmentIndex(0);
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
        setPickingLocationId(null);
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
            setSegmentDurationSeconds(5);
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
  const drawMapToCanvas = useCallback(async (timestamp: number) => {
    if (!isRecording || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording' || !canvasForRecordingRef.current) {
      console.log('[DEBUG] drawMapToCanvas: Recording stopped or essential refs missing. Exiting draw loop.');
      if (animationFrameIdForRecordingRef.current) {
        cancelAnimationFrame(animationFrameIdForRecordingRef.current);
        animationFrameIdForRecordingRef.current = null;
      }
      return;
    }

    const mapElement = document.getElementById('map-container'); // Map.tsx内の地図コンテナID
    const targetCanvas = canvasForRecordingRef.current;

    if (!mapElement) {
      console.error('[DEBUG] drawMapToCanvas: mapElement not found. Stopping draw loop.');
      if (animationFrameIdForRecordingRef.current) {
        cancelAnimationFrame(animationFrameIdForRecordingRef.current);
        animationFrameIdForRecordingRef.current = null;
      }
      // Consider stopping recording here if map element is gone
      // stopRecording(); // Potentially
      return;
    }
    
    // フレームレート制御 (目標FPSに合わせて調整)
    if (timestamp - lastFrameTimeRef.current < frameCaptureInterval) {
        animationFrameIdForRecordingRef.current = requestAnimationFrame(drawMapToCanvas);
        return;
    }
    lastFrameTimeRef.current = timestamp;

    console.log(`[DEBUG] drawMapToCanvas: Attempting to capture frame at ${timestamp.toFixed(2)}`);
    const captureStartTime = performance.now();
    try {
      const canvasFromHtml = await html2canvas(mapElement, {
        useCORS: true,
        logging: false, // trueにするとhtml2canvasの詳細ログが出る
        width: mapElement.offsetWidth,
        height: mapElement.offsetHeight,
        // allowTaint: true, // CORS問題がある場合に試すが、セキュリティリスクあり
        // foreignObjectRendering: true, // SVGなどのレンダリング改善のため、ただしサポート状況に注意
      });
      const captureEndTime = performance.now();
      console.log(`[DEBUG] drawMapToCanvas: html2canvas capture took ${(captureEndTime - captureStartTime).toFixed(2)}ms.`);

      const ctx = targetCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        ctx.drawImage(canvasFromHtml, 0, 0, targetCanvas.width, targetCanvas.height);
        console.log(`[DEBUG] drawMapToCanvas: Frame drawn to targetCanvas. Canvas content (first 100 chars): ${targetCanvas.toDataURL('image/png').substring(0, 100)}...`);
      } else {
        console.error('[DEBUG] drawMapToCanvas: Failed to get 2D context from targetCanvas.');
      }
    } catch (captureError) {
      const captureEndTime = performance.now();
      console.error(`[DEBUG] drawMapToCanvas: Error capturing map with html2canvas after ${(captureEndTime - captureStartTime).toFixed(2)}ms:`, captureError);
      // エラーが続く場合は録画を停止することも検討
    }

    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      animationFrameIdForRecordingRef.current = requestAnimationFrame(drawMapToCanvas);
    } else {
      console.log('[DEBUG] drawMapToCanvas: Recording seems to have stopped. Exiting draw loop.');
    }
  }, [isRecording, frameCaptureInterval]); // isRecording と frameCaptureInterval を依存配列に追加


  const stopRecording = useCallback(() => {
    console.log(`[DEBUG] stopRecording called. Current MediaRecorder state: ${mediaRecorderRef.current?.state}, isRecording state: ${isRecording}`);
    
    if (animationFrameIdForRecordingRef.current) {
      cancelAnimationFrame(animationFrameIdForRecordingRef.current);
      animationFrameIdForRecordingRef.current = null;
      console.log('[DEBUG] stopRecording: Recording animation frame cancelled.');
    }

    if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === "recording") {
            console.log('[DEBUG] stopRecording: Calling mediaRecorder.stop().');
            mediaRecorderRef.current.stop(); // This will trigger 'onstop'
        } else {
            console.log(`[DEBUG] stopRecording: MediaRecorder not in 'recording' state (state: ${mediaRecorderRef.current.state}). Will not call stop().`);
        }
    } else {
        console.log('[DEBUG] stopRecording: mediaRecorderRef.current is null.');
    }
    
    // streamRefのトラック停止はMediaRecorderのonstopで行うのが一般的だが、ここで呼ぶ場合もある
    // if (streamRef.current) {
    //   streamRef.current.getTracks().forEach(track => track.stop());
    //   console.log('[DEBUG] stopRecording: Stream tracks stopped (if streamRef existed).');
    // }

    // Canvasのクリーンアップ (オプション)
    if (canvasForRecordingRef.current) {
        const ctx = canvasForRecordingRef.current.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvasForRecordingRef.current.width, canvasForRecordingRef.current.height);
            console.log('[DEBUG] stopRecording: Target recording canvas cleared.');
        }
        // デバッグ用にbodyに追加した場合の削除処理 (必要に応じて)
        // if (canvasForRecordingRef.current.parentNode === document.body) {
        //   document.body.removeChild(canvasForRecordingRef.current);
        // }
    }
    
    // isRecording状態の更新は、MediaRecorderのonstopイベント後や、ユーザーが明示的に停止操作をした後が適切
    // ここでsetIsRecording(false)を呼ぶと、onstopが呼ばれる前に状態が変わってしまう可能性がある
    //setIsRecording(false); // ★ onstop や onerror で管理するのがより安全な場合が多い
    console.log('[DEBUG] stopRecording: Processing finished.');
  }, [isRecording]); // isRecording を依存配列に追加


  const startRecording = useCallback(async () => {
    console.log('[DEBUG] startRecording called.');
    if (!window.MediaRecorder) {
      setMapError('お使いのブラウザは録画機能に対応していません。');
      console.error('[DEBUG] startRecording: MediaRecorder API not available.');
      return;
    }

    const mapElement = document.getElementById('map-container'); // Map.tsx内の地図コンテナID
    if (!mapElement) {
      setMapError('地図要素が見つかりません。録画を開始できません。');
      console.error('[DEBUG] startRecording: mapElement not found.');
      return;
    }
    const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);
    if (validLocations.length < 2) {
      setMapError("録画を開始するには、まず有効な経路を生成してください。");
      console.warn('[DEBUG] startRecording: Not enough valid locations to start recording.');
      return;
    }
    if (!isPlaying) {
        setMapError('アニメーションを再生してから録画を開始してください。');
        console.warn('[DEBUG] startRecording: Animation is not playing. Recording requires active animation.');
        // setIsPlaying(true); // 強制的に再生開始する場合
        // setCurrentSegmentIndex(0);
        return;
    }

    setIsRecording(true); // 先に状態をtrueにしておくことでdrawMapToCanvasが初回から動くようにする
    setMapError(null);
    recordedChunksRef.current = []; // チャンクをリセット

    try {
      console.log('[DEBUG] startRecording: Initializing canvas for recording...');
      if (!canvasForRecordingRef.current) {
        canvasForRecordingRef.current = document.createElement('canvas');
        // デバッグ用表示 (任意)
        // canvasForRecordingRef.current.style.position = 'fixed'; canvasForRecordingRef.current.style.bottom = '10px'; canvasForRecordingRef.current.style.left = '10px'; canvasForRecordingRef.current.style.zIndex = '10000'; canvasForRecordingRef.current.style.border = '1px solid red'; document.body.appendChild(canvasForRecordingRef.current);
        console.log('[DEBUG] startRecording: Recording canvas element created.');
      }
      const targetCanvas = canvasForRecordingRef.current;
      targetCanvas.width = mapElement.offsetWidth;
      targetCanvas.height = mapElement.offsetHeight;
      console.log(`[DEBUG] startRecording: Recording canvas size set to: ${targetCanvas.width}x${targetCanvas.height}`);

      // 初期フレームを描画試行
      console.log('[DEBUG] startRecording: Attempting to draw initial frame...');
      const initialCaptureStartTime = performance.now();
      try {
        const canvasFromHtml = await html2canvas(mapElement, { useCORS: true, logging: false, width: targetCanvas.width, height: targetCanvas.height });
        const ctx = targetCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0,0, targetCanvas.width, targetCanvas.height);
          ctx.drawImage(canvasFromHtml, 0, 0, targetCanvas.width, targetCanvas.height);
          console.log(`[DEBUG] startRecording: Initial frame drawn successfully in ${(performance.now() - initialCaptureStartTime).toFixed(2)}ms.`);
        } else {
           console.error('[DEBUG] startRecording: Failed to get 2D context for initial frame.');
        }
      } catch (err) {
        console.error(`[DEBUG] startRecording: Error drawing initial frame via html2canvas in ${(performance.now() - initialCaptureStartTime).toFixed(2)}ms:`, err);
        // 初期フレーム失敗でも録画を試みるか、中止するか検討
      }

      console.log('[DEBUG] startRecording: Setting up MediaRecorder...');
      if (streamRef.current) { // 前回のストリームが残っていれば停止
        streamRef.current.getTracks().forEach(track => track.stop());
        console.log('[DEBUG] startRecording: Stopped previous stream tracks.');
      }
      streamRef.current = targetCanvas.captureStream(10); // 10 FPS: この値とframeCaptureIntervalを合わせる
      console.log('[DEBUG] startRecording: Canvas stream captured.');

      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                      ? { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1500000 } // ビットレートを少し上げる
                      : MediaRecorder.isTypeSupported('video/webm;codecs=h264') // h264も試す
                      ? { mimeType: 'video/webm;codecs=h264', videoBitsPerSecond: 1500000 }
                      : MediaRecorder.isTypeSupported('video/webm')
                      ? { mimeType: 'video/webm', videoBitsPerSecond: 1500000 }
                      : { videoBitsPerSecond: 1500000 };
      console.log('[DEBUG] startRecording: MediaRecorder options:', options);
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          console.warn(`[DEBUG] startRecording: MediaRecorder was already in state: ${mediaRecorderRef.current.state}. Attempting to stop before re-creating.`);
          // ここで安全に停止・リセットする処理が必要な場合がある
      }
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          console.log(`[DEBUG] ondataavailable: Chunk received. Size: ${event.data.size}, Type: ${event.data.type}, Timestamp: ${event.timeStamp.toFixed(2)}`);
          recordedChunksRef.current.push(event.data);
        } else {
          console.log(`[DEBUG] ondataavailable: Empty chunk received. Timestamp: ${event.timeStamp.toFixed(2)}`);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log(`[DEBUG] onstop: MediaRecorder stopped. Recorded chunks count: ${recordedChunksRef.current.length}`);
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            console.log('[DEBUG] onstop: Stream tracks stopped.');
            streamRef.current = null;
        }
        // animationFrameIdForRecordingRef は stopRecording でキャンセルされるはず

        if (recordedChunksRef.current.length === 0) {
          setMapError("録画データが空です。動画の保存に失敗しました。");
          console.warn('[DEBUG] onstop: No data recorded.');
          setIsRecording(false);
          return;
        }
        try {
            const blob = new Blob(recordedChunksRef.current, { type: options.mimeType || 'video/webm' });
            const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 14);
            const filename = `travel-animation-${timestamp}.webm`;
            saveAs(blob, filename);
            console.log(`[DEBUG] onstop: Video saved as "${filename}", Size: ${blob.size}`);
            if (blob.size < 1000 && recordedChunksRef.current.length <=1) { // 非常に小さいファイルの場合
                console.warn(`[DEBUG] onstop: Saved video is very small (size: ${blob.size} bytes, chunks: ${recordedChunksRef.current.length}). It might be a 0-second video if content was minimal.`);
                setMapError(`保存された動画のサイズが非常に小さいです (${blob.size} バイト)。内容が正しく録画されていない可能性があります。`);
            }
        } catch(saveError) {
             console.error("[DEBUG] onstop: Failed to save video:", saveError);
             setMapError("動画ファイルの保存に失敗しました。");
        } finally {
            recordedChunksRef.current = []; // チャンクをクリア
            setIsRecording(false); // 録画状態を確実にfalseに
             console.log('[DEBUG] onstop: Recording process finished, state reset.');
        }
      };

      mediaRecorderRef.current.onerror = (event: Event) => {
        let errorDetail = 'Unknown error';
        if (event instanceof ErrorEvent) errorDetail = event.message;
        // @ts-expect-error DOMError is deprecated but might appear
        else if (event.error instanceof DOMException) errorDetail = event.error.message;
        // @ts-expect-error
        else if (event.error && event.error.name) errorDetail = event.error.name;


        console.error("[DEBUG] onerror: MediaRecorder error:", event, "Detail:", errorDetail);
        setMapError(`録画エラー: ${errorDetail}`);
        
        if (animationFrameIdForRecordingRef.current) {
            cancelAnimationFrame(animationFrameIdForRecordingRef.current);
            animationFrameIdForRecordingRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            streamRef.current = null;
        }
        setIsRecording(false);
      };
      
      console.log('[DEBUG] startRecording: Starting MediaRecorder...');
      mediaRecorderRef.current.start(200); // 200msごとに ondataavailable をトリガー
      lastFrameTimeRef.current = performance.now(); // 描画ループの初回実行のために初期化
      animationFrameIdForRecordingRef.current = requestAnimationFrame(drawMapToCanvas);
      console.log('[DEBUG] startRecording: MediaRecorder started and drawMapToCanvas loop initiated.');

    } catch (err) {
      console.error('[DEBUG] startRecording: General error during setup:', err);
      setMapError(`録画の開始に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
      setIsRecording(false);
      if (animationFrameIdForRecordingRef.current) {
        cancelAnimationFrame(animationFrameIdForRecordingRef.current);
        animationFrameIdForRecordingRef.current = null;
      }
       if (canvasForRecordingRef.current && canvasForRecordingRef.current.parentNode === document.body) {
           document.body.removeChild(canvasForRecordingRef.current);
       }
    }
  }, [isPlaying, locations, drawMapToCanvas]); // isPlaying, locations, drawMapToCanvas を依存配列に追加


  // --- Animation Handlers ---
  const handleStopAnimation = useCallback(() => {
     if (pickingLocationId !== null) {
        setMapError("地点選択モード中はアニメーションを操作できません。地点を選択するかキャンセルしてください。");
        return;
    }
    if (isRecording) {
      console.log('[DEBUG] handleStopAnimation: Animation stopped during recording, stopping recording as well.');
      stopRecording();
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
        setMapError("録画中は再生/一時停止できません。");
        console.warn('[DEBUG] handlePlayPauseToggle: Attempted to play/pause during recording.');
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
      console.log(`[DEBUG] handlePlayPauseToggle: isPlaying toggled to ${newIsPlaying}`);
      if (newIsPlaying && currentSegmentIndex >= validLocations.length - 1 && validLocations.length > 1) {
          console.log('[DEBUG] handlePlayPauseToggle: Animation was complete, resetting to start.');
          setCurrentSegmentIndex(0);
      }
      return newIsPlaying;
    });
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
    const validatedDuration = Math.max(1, Math.min(600, Math.round(newDuration)));
    setSegmentDurationSeconds(validatedDuration);
  }, [pickingLocationId, isRecording]);

   const handleSegmentComplete = useCallback(() => {
    console.log(`[DEBUG] handleSegmentComplete: Current segment index ${currentSegmentIndex} completed.`);
    setCurrentSegmentIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      const validLocationsCount = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined).length;
      console.log(`[DEBUG] handleSegmentComplete: Next index will be ${nextIndex}, valid locations: ${validLocationsCount}`);

      if (nextIndex >= validLocationsCount - 1) {
        console.log('[DEBUG] handleSegmentComplete: All segments complete or no more segments.');
        setIsPlaying(false);
        if (isRecording) {
            console.log('[DEBUG] handleSegmentComplete: Animation ended during recording, stopping recording.');
            stopRecording();
        }
        return 0;
      }
      return nextIndex;
    });
  }, [currentSegmentIndex, locations, isRecording, stopRecording]); // currentSegmentIndex を追加

  const handleMapRoutingError = useCallback((message: string) => {
    if (!pickingLocationId) {
        setMapError(message);
    }
  }, [pickingLocationId]);

  const getPickingLocationLabel = useCallback((id: string | null, locs: LocationPoint[]): string => {
    if (!id) return '';
    const loc = locs.find(l => l.id === id);
    if (loc && loc.name) return loc.name;

    if (id === 'start') return '出発地';
    if (id === 'end') return '目的地';
    if (id.startsWith('waypoint')) {
      const waypoints = locs.filter(l => l.id.startsWith('waypoint'));
      const waypointIndex = waypoints.findIndex(w => w.id === id);
      return `中継地点 ${waypointIndex >= 0 ? waypointIndex + 1 : '?'}`;
    }
    return id;
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
  }, [isPlaying, isRecording, pickingLocationId, locations, getPickingLocationLabel]);


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
          <main className="bg-white dark:bg-slate-800 rounded-md shadow-md flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px] relative overflow-hidden" id="map-container-wrapper"> {/* ★ Map.tsx の id と合わせるなら "map-container" */}
            <MapWithNoSSR
              locations={locations}
              transportOptions={initialTransportOptions}
              isPlaying={isPlaying}
              currentSegmentIndex={currentSegmentIndex}
              segmentDurationSeconds={segmentDurationSeconds}
              onSegmentComplete={handleSegmentComplete}
              onRoutingError={handleMapRoutingError}
              isPickingLocation={pickingLocationId !== null}
              onMapClickForPicking={handleMapClickForPicking}
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