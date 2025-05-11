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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const totalDistance = routeCoords.reduce((acc, curr, idx, arr) => {
        if (idx === 0) return acc;
        return acc + arr[idx-1].distanceTo(curr);
    },0);

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


  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    if (mapInstanceRef.current) {
      // 既存レイヤーとマーカーのクリア
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

      validLocations.forEach(loc => {
        if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && mapInstanceRef.current) {
          const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current);
          marker.bindPopup(String(loc.name || loc.id));
          markerRefs.current.push(marker);
        }
      });

      if (validLocations.length > 0 && mapInstanceRef.current) {
        const currentActiveSegmentStart = validLocations[currentSegmentIndex] || validLocations[0];
        const transportOption = transportOptions.find(opt => opt.name === currentActiveSegmentStart.transport);
        if (transportOption && typeof currentActiveSegmentStart.lat === 'number' && typeof currentActiveSegmentStart.lng === 'number') {
          const startLatLng = L.latLng(currentActiveSegmentStart.lat, currentActiveSegmentStart.lng);
          animatedMarkerRef.current = L.marker(startLatLng, {
            icon: createAnimatedIcon(transportOption.label),
            zIndexOffset: 1000
          }).addTo(mapInstanceRef.current);
        }
      }

      currentSegmentCoordsRef.current = [];
      for (let i = 0; i < validLocations.length - 1; i++) {
        const startPoint = validLocations[i];
        const endPoint = validLocations[i+1];
        const transportMode = startPoint.transport;

        if (typeof startPoint.lat === 'number' && typeof startPoint.lng === 'number' &&
            typeof endPoint.lat === 'number' && typeof endPoint.lng === 'number' && mapInstanceRef.current) {

          const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
          const endLatLng = L.latLng(endPoint.lat, endPoint.lng);
          let segmentCoords: L.LatLng[] = [];

          if (transportMode === 'Plane') {
            const polyline = L.polyline([startLatLng, endLatLng], {
              color: 'green', weight: 3, opacity: 0.7, dashArray: '5, 10'
            }).addTo(mapInstanceRef.current);
            layerRefs.current.push(polyline);
            segmentCoords = [startLatLng, endLatLng];
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
                if (i === currentSegmentIndex) {
                    currentSegmentCoordsRef.current = e.routes[0].coordinates;
                    console.log(`Segment ${i} road route coordinates for animation:`, currentSegmentCoordsRef.current);
                }
              }
            })
            .on('routingerror', function(e) {
              console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, e.error);
              if(mapInstanceRef.current){
                const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                    color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5'
                }).addTo(mapInstanceRef.current);
                layerRefs.current.push(fallbackPolyline);
              }
              if (i === currentSegmentIndex) {
                  currentSegmentCoordsRef.current = [startLatLng, endLatLng];
              }
            })
            .addTo(mapInstanceRef.current);
            layerRefs.current.push(routingControl);
          }
          if (transportMode === 'Plane' && i === currentSegmentIndex) {
            currentSegmentCoordsRef.current = segmentCoords;
            console.log(`Segment ${i} plane route coordinates for animation:`, currentSegmentCoordsRef.current);
          }
        }
      }
      if (validLocations.length > 0 && mapInstanceRef.current) {
        const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
  }, [locations, center, zoom, transportOptions, currentSegmentIndex]);


  useEffect(() => {
    if (isPlaying && currentSegmentCoordsRef.current.length > 0 && animatedMarkerRef.current) {
      // const currentStartLocation = locations[currentSegmentIndex]; // この行を削除 (未使用のため)
      const validCurrentStartLocation = locations.filter(loc => typeof loc.lat === 'number' && typeof loc.lng === 'number')[currentSegmentIndex];

      if (validCurrentStartLocation) {
          const transportOption = transportOptions.find(opt => opt.name === validCurrentStartLocation.transport);
          if (transportOption && animatedMarkerRef.current) {
              animatedMarkerRef.current.setIcon(createAnimatedIcon(transportOption.label));
          }
      }
      animateMarker(currentSegmentCoordsRef.current, animationSpeed);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  }, [isPlaying, currentSegmentIndex, animationSpeed, animateMarker, locations, transportOptions]);


  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md">
    </div>
  );
};

export default Map;
