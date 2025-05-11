// src/components/Map.tsx
import { useEffect, useRef } from 'react';
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
}

const Map: React.FC<MapProps> = ({ center = [35.6809591, 139.7673068], zoom = 13, locations, transportOptions }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<(L.Routing.Control | L.Polyline)[]>([]);
  const markerRefs = useRef<L.Marker[]>([]);
  const animatedMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
      }).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    if (mapInstanceRef.current) {
      // クリア処理
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

      // 区間ごとの経路描画とアニメーションマーカーの準備
      for (let i = 0; i < validLocations.length - 1; i++) {
        const startPoint = validLocations[i];
        const endPoint = validLocations[i+1];
        const transportMode = startPoint.transport; // この区間の出発地点の移動手段
        const transportOption = transportOptions.find(opt => opt.name === transportMode);

        if (transportOption && typeof startPoint.lat === 'number' && typeof startPoint.lng === 'number' &&
            typeof endPoint.lat === 'number' && typeof endPoint.lng === 'number' && mapInstanceRef.current) {

          const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
          const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

          if (i === 0) { 
            const currentAnimatedMarker = animatedMarkerRef.current;
            if (!currentAnimatedMarker) {
              animatedMarkerRef.current = L.marker(startLatLng, {
                icon: createAnimatedIcon(transportOption.label),
                zIndexOffset: 1000
              }).addTo(mapInstanceRef.current);
            } else {
              currentAnimatedMarker.setLatLng(startLatLng);
              currentAnimatedMarker.setIcon(createAnimatedIcon(transportOption.label));
            }
          }

          let routeCoordinates: L.LatLng[] = [];

          if (transportMode === 'Plane') {
            const polyline = L.polyline([startLatLng, endLatLng], {
              color: 'green', weight: 3, opacity: 0.7, dashArray: '5, 10'
            }).addTo(mapInstanceRef.current);
            layerRefs.current.push(polyline);
            routeCoordinates = [startLatLng, endLatLng];
            if (i === 0) { 
                console.log("Plane route coordinates for animation:", routeCoordinates);
                // animateMarker(routeCoordinates); // あとで有効化
            }
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
                routeCoordinates = e.routes[0].coordinates;
                console.log("Road route coordinates for animation (segment " + i + "):", routeCoordinates);
                if (i === 0) { 
                    // animateMarker(routeCoordinates); // あとで有効化
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
              routeCoordinates = [startLatLng, endLatLng];
              if (i === 0) { 
                // animateMarker(routeCoordinates); // あとで有効化
              }
            })
            .addTo(mapInstanceRef.current);
            layerRefs.current.push(routingControl);
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
  }, [locations, center, zoom, transportOptions]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const animateMarker = (routeCoords: L.LatLng[], speed: number = 1) => {
    if (!animatedMarkerRef.current || routeCoords.length < 2) return;
    let currentIndex = 0;
    const marker = animatedMarkerRef.current;
    marker.setLatLng(routeCoords[currentIndex]);
    
    if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
    }

    const move = () => {
      if (currentIndex < routeCoords.length -1) {
        currentIndex++;
        const nextLatLng = routeCoords[currentIndex];
        marker.setLatLng(nextLatLng);
        if (mapInstanceRef.current && !mapInstanceRef.current.getBounds().contains(nextLatLng)) {
          mapInstanceRef.current.panTo(nextLatLng);
        }
        animationFrameIdRef.current = requestAnimationFrame(move);
      } else {
        console.log("Animation completed for the segment.");
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
      }
    };
    move();
  };

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
