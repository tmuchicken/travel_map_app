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
  const layerRefs = useRef<(L.Routing.Control | L.Polyline)[]>([]);
  const markerRefs = useRef<L.Marker[]>([]);
  const animatedMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const currentSegmentCoordsRef = useRef<L.LatLng[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const animateMarker = useCallback((routeCoords: L.LatLng[], speedFactor: number) => {
    if (!animatedMarkerRef.current || routeCoords.length < 2 || !mapInstanceRef.current) {
      onSegmentComplete();
      return;
    }

    let currentIndex = 0;
    const marker = animatedMarkerRef.current;
    marker.setLatLng(routeCoords[currentIndex]);
    mapInstanceRef.current.panTo(routeCoords[currentIndex]);

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
    // アンマウント時のクリーンアップ
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom]); // center, zoom は初期化時のみ影響


  // 経路とマーカーの描画/更新 (locations が変更された時)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // 既存レイヤーとマーカーのクリア
    layerRefs.current.forEach(layer => {
      if (layer instanceof L.Routing.Control) {
        mapInstanceRef.current?.removeControl(layer);
      } else {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });
    layerRefs.current = [];
    markerRefs.current.forEach(marker => marker.remove());
    markerRefs.current = [];
    if (animatedMarkerRef.current) {
        animatedMarkerRef.current.remove();
        animatedMarkerRef.current = null;
    }
    if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
    }

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

    // 区間ごとの経路描画
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
        } else {
          const routingControl = L.Routing.control({
            waypoints: [startLatLng, endLatLng],
            routeWhileDragging: false, show: false, addWaypoints: false, fitSelectedRoutes: false,
            lineOptions: {
              styles: [{ color: 'blue', opacity: 0.7, weight: 5 }],
              extendToWaypoints: true, missingRouteTolerance: 50,
            },
          })
          .on('routingerror', function(e) { // routesfound はここでは使わない
            console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, e.error);
            if(mapInstanceRef.current){
              const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                  color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5'
              }).addTo(mapInstanceRef.current);
              layerRefs.current.push(fallbackPolyline);
            }
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


  // アニメーション対象区間の座標を更新 (currentSegmentIndex または locations が変更された時)
  useEffect(() => {
    if (!mapInstanceRef.current || !isPlaying) { // isPlaying が false の時は座標取得不要
        currentSegmentCoordsRef.current = []; // アニメーションが再生中でなければ座標をクリア
        return;
    }

    const validLocations = locations.filter(
        loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );

    if (currentSegmentIndex < 0 || currentSegmentIndex >= validLocations.length - 1) {
        currentSegmentCoordsRef.current = [];
        return; // 有効な区間インデックスでない場合は何もしない
    }

    const startPoint = validLocations[currentSegmentIndex];
    const endPoint = validLocations[currentSegmentIndex + 1];
    const transportMode = startPoint.transport;

    if (typeof startPoint.lat === 'number' && typeof startPoint.lng === 'number' &&
        typeof endPoint.lat === 'number' && typeof endPoint.lng === 'number') {
        const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
        const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

        if (transportMode === 'Plane') {
            currentSegmentCoordsRef.current = [startLatLng, endLatLng];
            console.log(`Segment ${currentSegmentIndex} (Plane) coordinates for animation:`, currentSegmentCoordsRef.current);
        } else {
            // 既存のルーティングコントロールから座標を取得するか、再度計算する
            // ここでは簡易的に、対応する layerRefs の Routing.Control から取得を試みる
            // より堅牢にするには、locations 変更時に各区間の座標を保存しておく構造も検討
            const segmentRoutingLayer = layerRefs.current.find(layer => {
                if (layer instanceof L.Routing.Control) {
                    const waypoints = layer.getWaypoints();
                    return waypoints.length === 2 &&
                           waypoints[0].latLng?.equals(startLatLng) &&
                           waypoints[1].latLng?.equals(endLatLng);
                }
                return false;
            }) as L.Routing.Control | undefined;

            if (segmentRoutingLayer && segmentRoutingLayer.getRouter()) {
                // routesfoundイベントを待つか、直接ルーターに問い合わせる
                // LRMの内部APIに依存するため注意。ここではroutesfoundで取得したものを利用する想定で
                // routesfoundイベントで座標を保存する仕組みがより適切
                // 今回は、routesfound が発火するのを待つのではなく、
                // isPlaying が true になった時に、対応する区間の座標を再取得する試み（ただし非同期になる）
                L.Routing.control({ // この場で一時的に作成して座標を取得
                    waypoints: [startLatLng, endLatLng],
                    router: (segmentRoutingLayer.getRouter && segmentRoutingLayer.getRouter()) ? segmentRoutingLayer.getRouter() : undefined, // 既存ルーターを使用
                    // createMarker: () => null // マーカーは不要
                })
                .on('routesfound', function(e) {
                    if (e.routes && e.routes.length > 0) {
                        currentSegmentCoordsRef.current = e.routes[0].coordinates;
                        console.log(`Segment ${currentSegmentIndex} (Road) coordinates for animation:`, currentSegmentCoordsRef.current);
                    } else {
                        currentSegmentCoordsRef.current = [startLatLng, endLatLng]; // フォールバック
                    }
                })
                .on('routingerror', function() {
                    currentSegmentCoordsRef.current = [startLatLng, endLatLng]; // フォールバック
                })
                .route(); // 手動で経路探索を実行
            } else {
                 currentSegmentCoordsRef.current = [startLatLng, endLatLng]; // フォールバック
                 console.log(`Segment ${currentSegmentIndex} (Road) - No routing control found, using straight line.`);
            }
        }
    } else {
        currentSegmentCoordsRef.current = [];
    }
  }, [currentSegmentIndex, locations, transportOptions, isPlaying]); // isPlayingも依存配列に追加


  // アニメーションマーカーの更新とアニメーションの開始/停止 (isPlaying, currentSegmentIndex, animationSpeed が変更された時)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const validLocations = locations.filter(
        loc => typeof loc.lat === 'number' && typeof loc.lng === 'number'
    );

    if (isPlaying && currentSegmentCoordsRef.current.length > 0 && currentSegmentIndex < validLocations.length -1) {
      const currentActiveSegmentStart = validLocations[currentSegmentIndex];
      const transportOption = transportOptions.find(opt => opt.name === currentActiveSegmentStart.transport);

      if (transportOption && typeof currentActiveSegmentStart.lat === 'number' && typeof currentActiveSegmentStart.lng === 'number') {
        const startLatLng = L.latLng(currentActiveSegmentStart.lat, currentActiveSegmentStart.lng);
        if (!animatedMarkerRef.current) {
          animatedMarkerRef.current = L.marker(startLatLng, {
            icon: createAnimatedIcon(transportOption.label),
            zIndexOffset: 1000
          }).addTo(mapInstanceRef.current);
        } else {
          animatedMarkerRef.current.setLatLng(startLatLng);
          animatedMarkerRef.current.setIcon(createAnimatedIcon(transportOption.label));
        }
        animateMarker(currentSegmentCoordsRef.current, animationSpeed);
      }
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // アニメーションが停止したとき、または有効な座標がないとき、マーカーを非表示または削除
      // if (animatedMarkerRef.current) {
      //   animatedMarkerRef.current.remove();
      //   animatedMarkerRef.current = null;
      // }
    }
  }, [isPlaying, currentSegmentIndex, animationSpeed, animateMarker, locations, transportOptions]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md">
    </div>
  );
};

export default Map;
