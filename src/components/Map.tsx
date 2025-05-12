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
    if (!animatedMarkerRef.current || currentAnimationSegmentCoordsRef.current.length < 2 || !mapInstanceRef.current || !animationStartTimeRef.current || currentSegmentTotalDurationRef.current <= 0) {
      if (isPlaying) onSegmentComplete();
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

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }
    return () => {
      if (mapInstanceRef.current) {
        // Unmount時に全てのレイヤーとコントロールを確実に削除
        layerRefs.current.forEach(layer => {
            if (layer instanceof L.Routing.Control) {
                mapInstanceRef.current?.removeControl(layer);
            } else {
                mapInstanceRef.current?.removeLayer(layer);
            }
        });
        layerRefs.current = [];
        markerRefs.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker));
        markerRefs.current = [];
        if(animatedMarkerRef.current) mapInstanceRef.current?.removeLayer(animatedMarkerRef.current);
        animatedMarkerRef.current = null;

        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    routeCalculationGenerationRef.current++;
    const currentGeneration = routeCalculationGenerationRef.current;

    // 既存レイヤーとマーカーを全てクリア (animatedMarkerは別で管理)
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
    allSegmentsRouteCoordsRef.current = {};

    const validLocations = locations.filter(
      loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );

    validLocations.forEach(loc => {
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && mapInstanceRef.current) {
        const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current);
        marker.bindPopup(String(loc.name || loc.id));
        markerRefs.current.push(marker);
      }
    });

    const routePromises = validLocations.map((startPoint, i) => {
      if (i >= validLocations.length - 1) return Promise.resolve(); // 最後の地点は次の地点がない

      const endPoint = validLocations[i+1];
      const transportMode = startPoint.transport;

      if (typeof startPoint.lat !== 'number' || typeof startPoint.lng !== 'number' ||
          typeof endPoint.lat !== 'number' || typeof endPoint.lng !== 'number' || !mapInstanceRef.current) {
        return Promise.resolve();
      }

      const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
      const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

      if (transportMode === 'Plane') {
        if (mapInstanceRef.current) { // mapInstanceの存在を再確認
            const polyline = L.polyline([startLatLng, endLatLng], {
                color: 'green', weight: 3, opacity: 0.7, dashArray: '5, 10'
            }).addTo(mapInstanceRef.current);
            layerRefs.current.push(polyline);
        }
        allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
        return Promise.resolve();
      } else {
        return new Promise<void>((resolve, reject) => {
          if (!mapInstanceRef.current) {
            reject(new Error("Map instance removed before routing could complete."));
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
              console.log("Stale routesfound callback, ignoring.");
              resolve(); // 古いコールバックはresolveして握りつぶす
              return;
            }
            if (e.routes && e.routes.length > 0) {
              allSegmentsRouteCoordsRef.current[i] = e.routes[0].coordinates;
              console.log(`Segment ${i} (Road) static coords stored:`, allSegmentsRouteCoordsRef.current[i]);
            } else {
              allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            }
            resolve();
          })
          .on('routingerror', function(e) {
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              console.log("Stale routingerror callback, ignoring.");
              resolve(); // 古いコールバックはresolveして握りつぶす
              return;
            }
            console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, e.error);
            if(mapInstanceRef.current){
              const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                  color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5'
              }).addTo(mapInstanceRef.current); // addToの前にmapInstanceRef.currentを再確認
              layerRefs.current.push(fallbackPolyline);
            }
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            resolve(); // エラーでもPromiseチェーンを止めないためにresolve
          });

          if (mapInstanceRef.current) { // addToの直前にも確認
            routingControl.addTo(mapInstanceRef.current);
            layerRefs.current.push(routingControl);
          } else {
            reject(new Error("Map instance removed before routing control could be added."));
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
    });

  }, [locations, transportOptions]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const validLocations = locations.filter(loc => typeof loc.lat === 'number' && typeof loc.lng === 'number');

    if (isPlaying && currentSegmentIndex < validLocations.length - 1 && validLocations.length > 0) {
        const segmentStartPoint = validLocations[currentSegmentIndex];
        const transportOption = transportOptions.find(opt => opt.name === segmentStartPoint.transport);
        currentAnimationSegmentCoordsRef.current = allSegmentsRouteCoordsRef.current[currentSegmentIndex] || [];

        if (transportOption && typeof segmentStartPoint.lat === 'number' && typeof segmentStartPoint.lng === 'number' &&
            currentAnimationSegmentCoordsRef.current.length > 0 && mapInstanceRef.current) {
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
            const coords = currentAnimationSegmentCoordsRef.current;
            for (let j = 0; j < coords.length - 1; j++) {
                if (coords[j] && coords[j+1]) {
                    segmentTotalDistance += coords[j].distanceTo(coords[j+1]);
                }
            }
            const distanceKm = segmentTotalDistance / 1000;
            // animationSpeedKps が0または未定義の場合のフォールバック
            const speed = animationSpeedKps > 0 ? animationSpeedKps : 10; // 1kmあたり10秒をデフォルトに
            currentSegmentTotalDurationRef.current = distanceKm * speed * 1000;
            if (currentSegmentTotalDurationRef.current <= 0 && distanceKm > 0) {
                 currentSegmentTotalDurationRef.current = 100;
            } else if (currentSegmentTotalDurationRef.current < 0 && distanceKm === 0) { // 距離0ならdurationも0
                 currentSegmentTotalDurationRef.current = 0;
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
  }, [isPlaying, currentAnimationSegmentCoordsRef.current, animateMarker]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md">
    </div>
  );
};

export default Map;
