// src/components/Map.tsx
import { useEffect, useRef, useCallback, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import type { LocationPoint, TransportOption } from '@/app/page';

// アイコンパス修正 (変更なし)
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
    className: 'leaflet-animated-marker-icon', // CSSでスタイル定義推奨
    iconSize: [30, 30],
    iconAnchor: [15, 15], // アイコンの中心が座標点になるように調整
  });
};

interface MapProps {
  center?: L.LatLngExpression;
  zoom?: number;
  locations: LocationPoint[];
  transportOptions: TransportOption[];
  isPlaying: boolean;
  currentSegmentIndex: number;
  animationSpeedKps: number; // 1kmあたりの秒数
  onSegmentComplete: () => void;
  onRoutingError: (message: string) => void; // エラー通知用のコールバックを追加
}

const Map: React.FC<MapProps> = ({
  center = [35.6809591, 139.7673068], // 東京駅周辺
  zoom = 6, // 初期ズームレベルを調整して広範囲を表示
  locations,
  transportOptions,
  isPlaying,
  currentSegmentIndex,
  animationSpeedKps,
  onSegmentComplete,
  onRoutingError,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<(L.Routing.Control | L.Polyline)[]>([]); // 経路レイヤーやコントロールを保持
  const markerRefs = useRef<L.Marker[]>([]); // 静的マーカーを保持
  const animatedMarkerRef = useRef<L.Marker | null>(null); // アニメーション用マーカー
  const animationFrameIdRef = useRef<number | null>(null); // requestAnimationFrame の ID

  const allSegmentsRouteCoordsRef = useRef<Record<number, L.LatLng[]>>({}); // 全セグメントの経路座標
  const currentAnimationSegmentCoordsRef = useRef<L.LatLng[]>([]); // 現在アニメーション中のセグメントの座標
  const animationStartTimeRef = useRef<number | null>(null); // アニメーション開始時間
  const currentSegmentTotalDurationRef = useRef<number>(0); // 現在のセグメントのアニメーション総時間
  const routeCalculationGenerationRef = useRef(0); // 経路計算の世代管理用

  const [osrmWarningDisplayed, setOsrmWarningDisplayed] = useState(false); // OSRM警告表示済みフラグ

  // アニメーションマーカーを動かす関数
  const animateMarker = useCallback(() => {
    if (!animatedMarkerRef.current || currentAnimationSegmentCoordsRef.current.length < 2 || !mapInstanceRef.current || !animationStartTimeRef.current) {
      if (isPlaying) {
        console.log("animateMarker: Invalid state for animation, completing segment.");
        onSegmentComplete();
      }
      return;
    }

    if (currentSegmentTotalDurationRef.current <= 10) { // 10ms以下は実質0とみなし、即座に完了
      if(animatedMarkerRef.current && currentAnimationSegmentCoordsRef.current.length > 0) {
        animatedMarkerRef.current.setLatLng(currentAnimationSegmentCoordsRef.current[currentAnimationSegmentCoordsRef.current.length - 1]);
      }
      console.log("Animation duration is zero or negative, completing segment immediately:", currentSegmentIndex);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      onSegmentComplete();
      return;
    }

    const marker = animatedMarkerRef.current;
    const routeCoords = currentAnimationSegmentCoordsRef.current;
    const elapsedTime = Date.now() - animationStartTimeRef.current;
    const progress = Math.min(elapsedTime / currentSegmentTotalDurationRef.current, 1);

    if (progress < 1) {
      const targetIndexFloat = progress * (routeCoords.length - 1);
      const baseIndex = Math.floor(targetIndexFloat);
      const nextIndex = Math.min(baseIndex + 1, routeCoords.length - 1);
      const segmentProgress = targetIndexFloat - baseIndex;

      const currentPos = routeCoords[baseIndex];
      const nextPos = routeCoords[nextIndex];

      if (currentPos && nextPos) {
        const lat = currentPos.lat + (nextPos.lat - currentPos.lat) * segmentProgress;
        const lng = currentPos.lng + (nextPos.lng - currentPos.lng) * segmentProgress;
        const interpolatedLatLng = L.latLng(lat, lng);
        marker.setLatLng(interpolatedLatLng);

        if (mapInstanceRef.current && !mapInstanceRef.current.getBounds().contains(interpolatedLatLng)) {
          mapInstanceRef.current.panTo(interpolatedLatLng);
        }
      }
      animationFrameIdRef.current = requestAnimationFrame(animateMarker);
    } else {
      if (routeCoords.length > 0) {
        marker.setLatLng(routeCoords[routeCoords.length - 1]);
      }
      console.log("Animation completed for segment:", currentSegmentIndex);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      onSegmentComplete();
    }
  }, [onSegmentComplete, currentSegmentIndex, isPlaying]);

  // 地図の初期化とアンマウント時のクリーンアップ
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);

      if (!osrmWarningDisplayed) {
        onRoutingError("現在、経路検索にOSRMのデモサーバーを使用しています。このサーバーは本番環境での利用には適しておらず、不安定な場合があります。安定した運用のためには、ご自身でOSRMサーバーを構築するか、商用の経路検索サービスをご利用ください。");
        setOsrmWarningDisplayed(true);
      }
    }

    return () => {
      console.log("Map component unmounting, cleaning up map instance and layers.");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (mapInstanceRef.current) {
        layerRefs.current.forEach(layer => {
          if (mapInstanceRef.current) {
            if (layer instanceof L.Routing.Control) {
              mapInstanceRef.current.removeControl(layer);
            } else if (layer instanceof L.Layer) { // L.Polyline も L.Layer のサブクラス
              mapInstanceRef.current.removeLayer(layer);
            }
          }
        });
        layerRefs.current = [];

        markerRefs.current.forEach(marker => {
          if (mapInstanceRef.current) mapInstanceRef.current.removeLayer(marker);
        });
        markerRefs.current = [];

        if (animatedMarkerRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(animatedMarkerRef.current);
        }
        animatedMarkerRef.current = null;

        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, zoom]); // onRoutingError, osrmWarningDisplayed を依存配列に含めると初回以降もメッセージが出るため注意

  // 経路と静的マーカーの描画/更新 (locations または transportOptions が変更された時)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    routeCalculationGenerationRef.current++; // 新しい経路計算の世代をインクリメント
    const currentGeneration = routeCalculationGenerationRef.current; // このuseEffect実行時の世代をキャプチャ

    // 既存の経路レイヤーと静的マーカーをクリア
    layerRefs.current.forEach(layer => {
      if (mapInstanceRef.current) {
        if (layer instanceof L.Routing.Control) {
          mapInstanceRef.current.removeControl(layer);
        } else if (layer instanceof L.Layer) {
          mapInstanceRef.current.removeLayer(layer);
        }
      }
    });
    layerRefs.current = [];
    markerRefs.current.forEach(marker => {
        if (mapInstanceRef.current) mapInstanceRef.current.removeLayer(marker);
    });
    markerRefs.current = [];
    allSegmentsRouteCoordsRef.current = {}; // 経路座標もクリア

    const validLocations = locations.filter(
      loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );

    // 静的マーカーの設置
    validLocations.forEach(loc => {
      if (mapInstanceRef.current && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current);
        marker.bindPopup(String(loc.name || `地点 ${loc.id}`));
        markerRefs.current.push(marker);
      }
    });

    if (validLocations.length < 2) {
      if (isPlaying) onSegmentComplete(); // 再生中の場合はアニメーションを停止させる
      return; // 経路を生成するのに十分な地点がない
    }

    const routePromises = validLocations.map((startPoint, i) => {
      if (i >= validLocations.length - 1) return Promise.resolve(); // 最後の地点からは経路を引かない

      const endPoint = validLocations[i + 1];
      const transportMode = startPoint.transport; // 各セグメントの始点の移動手段を使用

      if (typeof startPoint.lat !== 'number' || typeof startPoint.lng !== 'number' ||
          typeof endPoint.lat !== 'number' || typeof endPoint.lng !== 'number' || !mapInstanceRef.current) {
        allSegmentsRouteCoordsRef.current[i] = [];
        return Promise.resolve();
      }

      const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
      const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

      // 飛行機と徒歩は直線で結ぶ
      if (transportMode === 'Plane' || transportMode === 'Walk') {
        if (mapInstanceRef.current) {
            const polyline = L.polyline([startLatLng, endLatLng], {
                color: transportMode === 'Plane' ? 'green' : 'purple',
                weight: 3,
                opacity: 0.7,
                dashArray: transportMode === 'Plane' ? '5, 10' : undefined,
            }).addTo(mapInstanceRef.current);
            layerRefs.current.push(polyline);
        }
        allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
        return Promise.resolve();
      } else {
        // OSRMを利用する交通手段
        return new Promise<void>((resolve) => {
          if (!mapInstanceRef.current) {
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            resolve();
            return;
          }

          // L.Routing.Plan のオプションを定義
          const planOptions: L.Routing.PlanOptions = {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            createMarker: (_waypointIndex: number, _waypoint: L.Routing.Waypoint, _numberOfWaypoints: number) => false,
            draggableWaypoints: false,
            addWaypoints: false,
          };

          const routingControl = L.Routing.control({
            router: L.Routing.osrmv1({
              serviceUrl: 'https://router.project-osrm.org/route/v1',
            }),
            plan: L.routing.plan([startLatLng, endLatLng], planOptions),
            routeWhileDragging: false,
            show: false,
            addWaypoints: false,
            fitSelectedRoutes: false,
            lineOptions: {
              styles: [{ color: 'blue', opacity: 0.7, weight: 5 }],
              extendToWaypoints: true,
              missingRouteTolerance: 100,
            },
          })
          .on('routesfound', (e) => {
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              console.log("Stale routesfound callback for segment " + i + ", ignoring.");
              if (routingControl && mapInstanceRef.current?.removeControl) {
                mapInstanceRef.current.removeControl(routingControl);
              }
              resolve(); return;
            }
            if (e.routes && e.routes.length > 0 && e.routes[0].coordinates) {
              allSegmentsRouteCoordsRef.current[i] = e.routes[0].coordinates;
              const routeLine = L.polyline(e.routes[0].coordinates, {
                color: 'blue', opacity: 0.7, weight: 5
              }).addTo(mapInstanceRef.current!);
              layerRefs.current.push(routeLine);

            } else {
              allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
              onRoutingError(`区間 ${i+1} (${startPoint.name} -> ${endPoint.name}) の経路が見つかりませんでした。直線で表示します。`);
              if (mapInstanceRef.current) {
                const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                    color: 'orange', weight: 3, opacity: 0.7, dashArray: '5, 5'
                }).addTo(mapInstanceRef.current);
                layerRefs.current.push(fallbackPolyline);
              }
            }
            if (mapInstanceRef.current?.removeControl) {
                mapInstanceRef.current.removeControl(routingControl);
            }
            resolve();
          })
          .on('routingerror', (errEvent) => {
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              console.log("Stale routingerror callback for segment " + i + ", ignoring.");
              if (routingControl && mapInstanceRef.current?.removeControl) {
                mapInstanceRef.current.removeControl(routingControl);
              }
              resolve(); return;
            }
            console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, errEvent.error);
            onRoutingError(`区間 ${i+1} (${startPoint.name} -> ${endPoint.name}) の経路計算中にエラー: ${errEvent.error?.message || '不明なエラー'}. 直線で表示します。`);
            if (mapInstanceRef.current) {
              const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                  color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5'
              }).addTo(mapInstanceRef.current);
              layerRefs.current.push(fallbackPolyline);
            }
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            if (mapInstanceRef.current?.removeControl) {
                mapInstanceRef.current.removeControl(routingControl);
            }
            resolve();
          });

          if (mapInstanceRef.current) {
            routingControl.addTo(mapInstanceRef.current);
          } else {
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            resolve();
          }
        });
      }
    });

    Promise.allSettled(routePromises).then(() => {
      if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
        console.log("Stale Promise.allSettled, ignoring map updates.");
        return;
      }
      if (validLocations.length > 0) {
          const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
          if (bounds.isValid() && mapInstanceRef.current) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          }
      }
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, transportOptions, onRoutingError]); // ★ 418行目: 不要な eslint-disable コメントを削除

  // アニメーションマーカーの準備と更新
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const validLocations = locations.filter(loc => typeof loc.lat === 'number' && typeof loc.lng === 'number');

    if (isPlaying && currentSegmentIndex < validLocations.length - 1 && validLocations.length > 0) {
        const segmentStartPoint = validLocations[currentSegmentIndex];
        const transportOption = transportOptions.find(opt => opt.name === segmentStartPoint.transport);
        const coordsForCurrentSegment = allSegmentsRouteCoordsRef.current[currentSegmentIndex] || [];
        currentAnimationSegmentCoordsRef.current = coordsForCurrentSegment;

        if (transportOption && typeof segmentStartPoint.lat === 'number' && typeof segmentStartPoint.lng === 'number' &&
            coordsForCurrentSegment.length > 0 && mapInstanceRef.current) {

            const startLatLng = coordsForCurrentSegment[0];

            if (!animatedMarkerRef.current) {
                animatedMarkerRef.current = L.marker(startLatLng, {
                    icon: createAnimatedIcon(transportOption.label), zIndexOffset: 1000
                }).addTo(mapInstanceRef.current);
            } else {
                animatedMarkerRef.current.setLatLng(startLatLng);
                animatedMarkerRef.current.setIcon(createAnimatedIcon(transportOption.label));
            }

            let segmentTotalDistance = 0;
            for (let j = 0; j < coordsForCurrentSegment.length - 1; j++) {
                if (coordsForCurrentSegment[j] && coordsForCurrentSegment[j+1]) {
                    segmentTotalDistance += coordsForCurrentSegment[j].distanceTo(coordsForCurrentSegment[j+1]);
                }
            }
            const distanceKm = segmentTotalDistance / 1000;
            const safeAnimationSpeedKps = (animationSpeedKps && animationSpeedKps > 0) ? animationSpeedKps : 10;
            currentSegmentTotalDurationRef.current = distanceKm * safeAnimationSpeedKps * 1000;

            if (currentSegmentTotalDurationRef.current <= 0) {
                 currentSegmentTotalDurationRef.current = (distanceKm > 0.001) ? 100 : 0;
            }
            console.log(`Segment ${currentSegmentIndex} - Start Coords:`, startLatLng, `Distance: ${distanceKm.toFixed(2)} km, Speed: ${safeAnimationSpeedKps} s/km, Calculated Duration: ${currentSegmentTotalDurationRef.current/1000} s`);

        } else {
             currentAnimationSegmentCoordsRef.current = [];
             if (animatedMarkerRef.current && mapInstanceRef.current) {
                animatedMarkerRef.current.remove();
                animatedMarkerRef.current = null;
             }
             if (isPlaying) {
                console.warn(`Segment ${currentSegmentIndex} animation data incomplete. Attempting to complete segment.`);
                onSegmentComplete();
             }
        }
    } else {
        currentAnimationSegmentCoordsRef.current = [];
        if (animatedMarkerRef.current && mapInstanceRef.current) {
            animatedMarkerRef.current.remove();
            animatedMarkerRef.current = null;
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentSegmentIndex, locations, transportOptions, animationSpeedKps, onSegmentComplete]);

  // アニメーションの実行トリガー
  useEffect(() => {
    if (isPlaying && animatedMarkerRef.current && currentAnimationSegmentCoordsRef.current.length > 0) { // currentAnimationSegmentCoordsRef.current を依存配列から削除するため、ここで直接参照
      animationStartTimeRef.current = Date.now();
      animateMarker();
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  // ★ 432行目: currentAnimationSegmentCoordsRef.current を依存配列から削除
  }, [isPlaying, animateMarker]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md bg-gray-100">
    </div>
  );
};

export default Map;
