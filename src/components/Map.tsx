// src/components/Map.tsx
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'; // Routing Machine の CSS
import 'leaflet-routing-machine'; // Routing Machine の JavaScript
import type { LocationPoint } from '@/app/page';

// アイコンパス修正 (前回と同様)
if (typeof window !== 'undefined') {
  // @ts-expect-error: LeafletのデフォルトアイコンURL解決はNext.js/webpack環境で問題を起こすことがあるため
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

interface MapProps {
  center?: L.LatLngExpression;
  zoom?: number;
  locations: LocationPoint[];
}

const Map: React.FC<MapProps> = ({ center = [35.6809591, 139.7673068], zoom = 13, locations }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<(L.Routing.Control | L.Polyline)[]>([]);
  const markerRefs = useRef<L.Marker[]>([]);


  useEffect(() => {
    // 地図の初期化 (初回のみ)
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    // locations が変更されたら経路とマーカーを更新
    if (mapInstanceRef.current) {
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

      const validLocations = locations.filter(
        loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
      );

      validLocations.forEach(loc => {
        if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current!);
          marker.bindPopup(String(loc.name || loc.id));
          markerRefs.current.push(marker);
        }
      });

      for (let i = 0; i < validLocations.length - 1; i++) {
        const startPoint = validLocations[i];
        const endPoint = validLocations[i+1];
        const transportMode = startPoint.transport;

        if (typeof startPoint.lat === 'number' && typeof startPoint.lng === 'number' &&
            typeof endPoint.lat === 'number' && typeof endPoint.lng === 'number') {

          const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
          const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

          if (transportMode === 'Plane') {
            const polyline = L.polyline([startLatLng, endLatLng], {
              color: 'green',
              weight: 3,
              opacity: 0.7,
              dashArray: '5, 10'
            }).addTo(mapInstanceRef.current!);
            layerRefs.current.push(polyline);
          } else {
            const routingControl = L.Routing.control({
              waypoints: [startLatLng, endLatLng],
              routeWhileDragging: false,
              show: false,
              addWaypoints: false,
              // createMarker: () => null, // 型エラーのため一時的にコメントアウトまたは削除
              fitSelectedRoutes: false,
              lineOptions: {
                styles: [{ color: 'blue', opacity: 0.7, weight: 5 }],
                extendToWaypoints: true,
                missingRouteTolerance: 50,
              },
            }).addTo(mapInstanceRef.current!);

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            routingControl.on('routesfound', function(_e) {
              // console.log('Routes found for segment:', _e.routes);
            });
            routingControl.on('routingerror', function(e) {
              console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, e.error);
              const fallbackPolyline = L.polyline([startLatLng, endLatLng], {
                color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5'
              }).addTo(mapInstanceRef.current!);
              layerRefs.current.push(fallbackPolyline);
              alert(`区間「${startPoint.name}」から「${endPoint.name}」の経路取得に失敗しました。直線で表示します。\nエラー: ${e.error.message}`);
            });
            layerRefs.current.push(routingControl);
          }
        }
      }

      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (validLocations.length === 1 && typeof validLocations[0].lat === 'number' && typeof validLocations[0].lng === 'number') {
        mapInstanceRef.current.setView([validLocations[0].lat, validLocations[0].lng], 13);
      }
    }
  }, [locations, center, zoom]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md">
    </div>
  );
};

export default Map;
