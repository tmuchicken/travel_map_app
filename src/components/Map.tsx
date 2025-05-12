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
  animationSpeedKps: number;
  onSegmentComplete: () => void;
}

const Map: React.FC<MapProps> = ({
  center = [35.6809591, 139.7673068],
  zoom = 13,
  locations,
  transportOptions,
  isPlaying,
  currentSegmentIndex,
  animationSpeedKps,
  onSegmentComplete,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<(L.Routing.Control | L.Polyline)[]>([]);
  const markerRefs = useRef<L.Marker[]>([]);
  const animatedMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  const allSegmentsRouteCoordsRef = useRef<Record<number, L.LatLng[]>>({});
  const currentAnimationSegmentCoordsRef = useRef<L.LatLng[]>([]);
  const animationStartTimeRef = useRef<number | null>(null);
  const currentSegmentTotalDurationRef = useRef<number>(0);
  const routeCalculationGenerationRef = useRef(0);

  const animateMarker = useCallback(() => {
    if (!animatedMarkerRef.current || currentAnimationSegmentCoordsRef.current.length < 2 || !mapInstanceRef.current || !animationStartTimeRef.current ) {
      if (isPlaying) onSegmentComplete();
      return;
    }
    if (currentSegmentTotalDurationRef.current <= 0) {
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
      
      if(currentPos && nextPos) {
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
      marker.setLatLng(routeCoords[routeCoords.length - 1]);
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
    }
    
    // このuseEffectのクリーンアップ関数は、コンポーネントがアンマウントされるときに一度だけ実行される
    return () => {
      if (mapInstanceRef.current) {
        console.log("Map component unmounting, cleaning up map instance and layers.");
        // アニメーションを停止
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        // 描画されたレイヤーとコントロールを削除
        layerRefs.current.forEach(layer => {
          if (mapInstanceRef.current) { // mapInstanceRef.current の存在を再確認
            if (layer instanceof L.Routing.Control) {
              mapInstanceRef.current.removeControl(layer);
            } else if (layer instanceof L.Layer) { // L.Polyline は L.Layer のサブクラス
              mapInstanceRef.current.removeLayer(layer);
            }
          }
        });
        layerRefs.current = [];
        // 静的マーカーを削除
        markerRefs.current.forEach(marker => {
          if (mapInstanceRef.current) { // mapInstanceRef.current の存在を再確認
            mapInstanceRef.current.removeLayer(marker);
          }
        });
        markerRefs.current = [];
        // アニメーションマーカーを削除
        if (animatedMarkerRef.current && mapInstanceRef.current) { // mapInstanceRef.current の存在を再確認
          mapInstanceRef.current.removeLayer(animatedMarkerRef.current);
        }
        animatedMarkerRef.current = null;
        
        // 地図インスタンス自体を削除
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom]); // center, zoom は初期化時のみ影響

  // 経路と静的マーカーの描画/更新 (locations または transportOptions が変更された時)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    routeCalculationGenerationRef.current++;
    const currentGeneration = routeCalculationGenerationRef.current;

    // 既存の経路レイヤーと静的マーカーをクリア (アニメーションマーカーは別で管理)
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
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && mapInstanceRef.current) {
        const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current);
        marker.bindPopup(String(loc.name || loc.id));
        markerRefs.current.push(marker);
      }
    });

    const routePromises = validLocations.map((startPoint, i) => {
      if (i >= validLocations.length - 1) return Promise.resolve();
      const endPoint = validLocations[i+1];
      const transportMode = startPoint.transport;

      if (typeof startPoint.lat !== 'number' || typeof startPoint.lng !== 'number' ||
          typeof endPoint.lat !== 'number' || typeof endPoint.lng !== 'number' || !mapInstanceRef.current) {
        allSegmentsRouteCoordsRef.current[i] = [];
        return Promise.resolve();
      }

      const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
      const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

      if (transportMode === 'Plane') {
        if (mapInstanceRef.current) {
            const polyline = L.polyline([startLatLng, endLatLng], {
                color: 'green', weight: 3, opacity: 0.7, dashArray: '5, 10'
            }).addTo(mapInstanceRef.current);
            layerRefs.current.push(polyline);
        }
        allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
        return Promise.resolve();
      } else {
        return new Promise<void>((resolve) => {
          if (!mapInstanceRef.current) {
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            console.warn("Map instance removed before routing for segment " + i);
            resolve();
            return;
          }
          const routingControl = L.Routing.control({
            waypoints: [startLatLng, endLatLng],
            routeWhileDragging: false, show: true, addWaypoints: false, fitSelectedRoutes: false,
            lineOptions: {
              styles: [{ color: 'blue', opacity: 0.7, weight: 5 }],
              extendToWaypoints: true, missingRouteTolerance: 50,
            },
          })
          .on('routesfound', function(e) {
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              console.log("Stale routesfound callback for segment " + i + ", ignoring.");
              resolve(); return;
            }
            if (e.routes && e.routes.length > 0) {
              allSegmentsRouteCoordsRef.current[i] = e.routes[0].coordinates;
              console.log(`Segment ${i} (Road) static coords stored:`, allSegmentsRouteCoordsRef.current[i]);
            } else {
              allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
              console.warn(`No routes found for segment ${i}, using straight line.`);
            }
            resolve();
          })
          .on('routingerror', function(e) {
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              console.log("Stale routingerror callback for segment " + i + ", ignoring.");
              resolve(); return;
            }
            console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, e.error);
            if(mapInstanceRef.current){
              const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                  color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5'
              }).addTo(mapInstanceRef.current);
              layerRefs.current.push(fallbackPolyline);
            }
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            resolve();
          });

          if (mapInstanceRef.current) {
            routingControl.addTo(mapInstanceRef.current);
            layerRefs.current.push(routingControl);
          } else {
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            console.warn("Map instance removed before routing control could be added for segment " + i);
            resolve();
          }
        });
      }
    });
    
    Promise.allSettled(routePromises).then(() => {
      if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) return;
      if (validLocations.length > 0) {
          const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
          if (bounds.isValid()) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
      }
      // アニメーション対象区間の座標を更新 (isPlaying状態も考慮)
      if (isPlaying && currentSegmentIndex < validLocations.length -1) {
        currentAnimationSegmentCoordsRef.current = allSegmentsRouteCoordsRef.current[currentSegmentIndex] || [];
      } else {
        currentAnimationSegmentCoordsRef.current = []; // 再生中でなければクリア
      }
    });

  }, [locations, transportOptions, isPlaying, currentSegmentIndex]); // isPlaying, currentSegmentIndex を依存配列に追加


  // アニメーションマーカーの更新 と アニメーション対象座標の準備
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const validLocations = locations.filter(loc => typeof loc.lat === 'number' && typeof loc.lng === 'number');

    if (isPlaying && currentSegmentIndex < validLocations.length - 1 && validLocations.length > 0) {
        const segmentStartPoint = validLocations[currentSegmentIndex];
        const transportOption = transportOptions.find(opt => opt.name === segmentStartPoint.transport);
        
        // このuseEffectが実行される時点でallSegmentsRouteCoordsRefが最新である保証がないため、
        // currentAnimationSegmentCoordsRefの更新はlocationsのuseEffectで行う
        const coordsForCurrentSegment = allSegmentsRouteCoordsRef.current[currentSegmentIndex] || [];

        if (transportOption && typeof segmentStartPoint.lat === 'number' && typeof segmentStartPoint.lng === 'number' &&
            coordsForCurrentSegment.length > 0 && mapInstanceRef.current) {
            const startLatLng = L.latLng(segmentStartPoint.lat, segmentStartPoint.lng);
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
            const speed = animationSpeedKps > 0 ? animationSpeedKps : 10;
            currentSegmentTotalDurationRef.current = distanceKm * speed * 1000;
            if (currentSegmentTotalDurationRef.current <= 0) {
                 currentSegmentTotalDurationRef.current = (distanceKm > 0) ? 100 : 0;
            }
            console.log(`Segment ${currentSegmentIndex} - Distance: ${distanceKm.toFixed(2)} km, Duration: ${currentSegmentTotalDurationRef.current/1000} s, Speed: ${speed} s/km`);
        } else {
             currentAnimationSegmentCoordsRef.current = [];
        }
    } else {
        currentAnimationSegmentCoordsRef.current = [];
        if (animatedMarkerRef.current && mapInstanceRef.current) {
            animatedMarkerRef.current.remove();
            animatedMarkerRef.current = null;
        }
    }
  }, [isPlaying, currentSegmentIndex, locations, transportOptions, animationSpeedKps]);

  // アニメーションの実行
  useEffect(() => {
    if (isPlaying && currentAnimationSegmentCoordsRef.current.length > 0 && animatedMarkerRef.current) {
      animationStartTimeRef.current = Date.now();
      animateMarker();
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  }, [isPlaying, currentAnimationSegmentCoordsRef.current, animateMarker]); // animateMarker を依存配列に追加

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md">
    </div>
  );
};

export default Map;
