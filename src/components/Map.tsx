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
  const routingControlRef = useRef<L.Routing.Control | null>(null); // ルーティングコントロールの参照

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

    // locations が変更されたら経路を更新
    if (mapInstanceRef.current) {
      if (routingControlRef.current) {
        mapInstanceRef.current.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }

      const waypoints = locations
        .filter(loc => typeof loc.lat === 'number' && typeof loc.lng === 'number')
        .map(loc => L.latLng(loc.lat!, loc.lng!));

      if (waypoints.length >= 2) {
        routingControlRef.current = L.Routing.control({
          waypoints: waypoints,
          routeWhileDragging: true,
          show: true,
          addWaypoints: false, 
          fitSelectedRoutes: 'smart', 
          lineOptions: { 
            styles: [{ color: 'blue', opacity: 0.7, weight: 5 }],
            extendToWaypoints: true,
            missingRouteTolerance: 50,
          },
        }).addTo(mapInstanceRef.current);

        // ESLintの未使用変数警告をこの行に対して無効化
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        routingControlRef.current.on('routesfound', function(_e) {
          // console.log('Routes found:', _e.routes); // もし使う場合は _e を e に戻し、上の ESLint disable コメントを削除
        });
        routingControlRef.current.on('routingerror', function(e) { // こちらは e を使用している
          console.error('Routing error:', e.error);
          alert(`経路の取得に失敗しました: ${e.error.message}`);
        });

      } else {
        if (waypoints.length === 1) {
          mapInstanceRef.current.setView(waypoints[0], 13);
        }
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
