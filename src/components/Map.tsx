// src/components/Map.tsx
import { useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import type { LocationPoint, TransportOption } from '@/app/page';

// アイコンパス修正
if (typeof window !== 'undefined') {
  // @ts-expect-error: LeafletのデフォルトアイコンURL解決はNext.js/webpack環境で問題を起こすことがあるため
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const createAnimatedIcon = (transportLabel: string) => {
  return L.divIcon({
    html: `<span style="font-size: 24px;">${transportLabel}</span>`,
    className: 'leaflet-animated-marker-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

interface MapProps {
  center?: L.LatLngExpression;
  zoom?: number;
  locations: LocationPoint[];
  transportOptions: TransportOption[];
  isPlaying: boolean;
  currentSegmentIndex: number;
  animationSpeed: number;
  onSegmentComplete: () => void;
}

const Map: React.FC<MapProps> = ({
  center = [35.6809591, 139.7673068],
  zoom = 13,
  locations,
  transportOptions,
  isPlaying,
  currentSegmentIndex,
  animationSpeed,
  onSegmentComplete,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<(L.Routing.Control | L.Polyline)[]>([]); // 描画された経路レイヤーを保持
  const markerRefs = useRef<L.Marker[]>([]); // 静的マーカーを保持
  const animatedMarkerRef = useRef<L.Marker | null>(null); // アニメーション用マーカー
  const animationFrameIdRef = useRef<number | null>(null); // requestAnimationFrame のID
  
  // 各区間の経路座標を保存するためのref (キーは区間インデックス)
  const allSegmentsRouteCoordsRef = useRef<Record<number, L.LatLng[]>>({});
  // 現在アニメーション対象の区間の座標を保持するref
  const currentAnimationSegmentCoordsRef = useRef<L.LatLng[]>([]);


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const animateMarker = useCallback((routeCoords: L.LatLng[], speedFactor: number) => {
    if (!animatedMarkerRef.current || routeCoords.length < 2 || !mapInstanceRef.current) {
      onSegmentComplete(); // アニメーションできない場合は即完了通知
      return;
    }

    let currentIndex = 0;
    const marker = animatedMarkerRef.current;
    marker.setLatLng(routeCoords[currentIndex]);
    mapInstanceRef.current.panTo(routeCoords[currentIndex]); // 開始地点にパン

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    const move = () => {
      if (currentIndex < routeCoords.length - 1) {
        currentIndex++;
        const nextLatLng = routeCoords[currentIndex];
        marker.setLatLng(nextLatLng);

        if (mapInstanceRef.current && !mapInstanceRef.current.getBounds().contains(nextLatLng)) {
          mapInstanceRef.current.panTo(nextLatLng);
        }
        animationFrameIdRef.current = requestAnimationFrame(move);
      } else {
        console.log("Animation completed for segment:", currentSegmentIndex);
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        onSegmentComplete();
      }
    };
    animationFrameIdRef.current = requestAnimationFrame(move);
  }, [onSegmentComplete, currentSegmentIndex]);


  // 地図の初期化 (初回のみ)
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }
    return () => { // アンマウント時のクリーンアップ
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom]);


  // 経路と静的マーカーの描画/更新 (locations が変更された時)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // 既存レイヤーとマーカーを全てクリア
    layerRefs.current.forEach(layer => {
      if (mapInstanceRef.current) {
        if (layer instanceof L.Routing.Control) {
          mapInstanceRef.current.removeControl(layer);
        } else {
          mapInstanceRef.current.removeLayer(layer);
        }
      }
    });
    layerRefs.current = [];
    markerRefs.current.forEach(marker => marker.remove());
    markerRefs.current = [];
    allSegmentsRouteCoordsRef.current = {}; // 経路座標もクリア

    const validLocations = locations.filter(
      loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );

    // 静的マーカーの設置
    validLocations.forEach(loc => {
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && mapInstanceRef.current) {
        const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current);
        marker.bindPopup(String(loc.name || loc.id));
        markerRefs.current.push(marker);
      }
    });

    // 区間ごとの経路描画と経路座標の保存
    for (let i = 0; i < validLocations.length - 1; i++) {
      const startPoint = validLocations[i];
      const endPoint = validLocations[i+1];
      const transportMode = startPoint.transport;

      if (typeof startPoint.lat === 'number' && typeof startPoint.lng === 'number' &&
          typeof endPoint.lat === 'number' && typeof endPoint.lng === 'number' && mapInstanceRef.current) {

        const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
        const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

        if (transportMode === 'Plane') {
          const polyline = L.polyline([startLatLng, endLatLng], {
            color: 'green', weight: 3, opacity: 0.7, dashArray: '5, 10'
          }).addTo(mapInstanceRef.current);
          layerRefs.current.push(polyline);
          allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng]; // 飛行機区間の座標を保存
          console.log(`Segment ${i} (Plane) static coords stored:`, allSegmentsRouteCoordsRef.current[i]);
        } else {
          const routingControl = L.Routing.control({
            waypoints: [startLatLng, endLatLng],
            routeWhileDragging: false, show: false, addWaypoints: false, fitSelectedRoutes: false,
            lineOptions: {
              styles: [{ color: 'blue', opacity: 0.7, weight: 5 }],
              extendToWaypoints: true, missingRouteTolerance: 50,
            },
          })
          .on('routesfound', function(e) {
            if (e.routes && e.routes.length > 0) {
              allSegmentsRouteCoordsRef.current[i] = e.routes[0].coordinates; // 道路区間の座標を保存
              console.log(`Segment ${i} (Road) static coords stored:`, allSegmentsRouteCoordsRef.current[i]);
            }
          })
          .on('routingerror', function(e) {
            console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, e.error);
            if(mapInstanceRef.current){
              const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                  color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5'
              }).addTo(mapInstanceRef.current!); // mapInstanceRef.current! を使用
              layerRefs.current.push(fallbackPolyline);
            }
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng]; // エラー時は直線座標を保存
          })
          .addTo(mapInstanceRef.current);
          layerRefs.current.push(routingControl);
        }
      }
    }

    // 地図の表示範囲調整
    if (validLocations.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [locations, transportOptions]); // 依存配列から currentSegmentIndex を削除


  // アニメーションマーカーの初期化/更新 と アニメーション対象座標の準備
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const validLocations = locations.filter(
        loc => typeof loc.lat === 'number' && typeof loc.lng === 'number'
    );

    // アニメーションマーカーの表示/非表示とアイコン設定
    if (isPlaying && currentSegmentIndex < validLocations.length -1 && validLocations.length > 0) {
        const segmentStartPoint = validLocations[currentSegmentIndex];
        const transportOption = transportOptions.find(opt => opt.name === segmentStartPoint.transport);

        if (transportOption && typeof segmentStartPoint.lat === 'number' && typeof segmentStartPoint.lng === 'number') {
            const startLatLng = L.latLng(segmentStartPoint.lat, segmentStartPoint.lng);
            if (!animatedMarkerRef.current) {
                animatedMarkerRef.current = L.marker(startLatLng, {
                    icon: createAnimatedIcon(transportOption.label),
                    zIndexOffset: 1000
                }).addTo(mapInstanceRef.current);
            } else {
                animatedMarkerRef.current.setLatLng(startLatLng);
                animatedMarkerRef.current.setIcon(createAnimatedIcon(transportOption.label));
            }
        }
    } else if (animatedMarkerRef.current) { // 再生中でない、または有効な区間がない場合はマーカーを削除
        animatedMarkerRef.current.remove();
        animatedMarkerRef.current = null;
    }

    // 現在アニメーションすべき区間の座標をセット
    if (isPlaying && currentSegmentIndex < validLocations.length -1) {
        currentAnimationSegmentCoordsRef.current = allSegmentsRouteCoordsRef.current[currentSegmentIndex] || [];
        console.log(`Prepared animation coords for segment ${currentSegmentIndex}:`, currentAnimationSegmentCoordsRef.current);
    } else {
        currentAnimationSegmentCoordsRef.current = []; // 再生中でなければクリア
    }

  }, [isPlaying, currentSegmentIndex, locations, transportOptions]);


  // アニメーションの実行 (isPlaying, currentSegmentIndex, animationSpeed が変更された時)
  useEffect(() => {
    if (isPlaying && currentAnimationSegmentCoordsRef.current.length > 0 && animatedMarkerRef.current) {
      animateMarker(currentAnimationSegmentCoordsRef.current, animationSpeed);
    } else {
      // アニメーションを停止/キャンセル
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  }, [isPlaying, currentSegmentIndex, animationSpeed, animateMarker]); // currentAnimationSegmentCoordsRef.current は ref なので依存配列に含めない

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md">
    </div>
  );
};

export default Map;
