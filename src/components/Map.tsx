// src/components/Map.tsx
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { LocationPoint } from '@/app/page'; // 型をインポート

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
  locations: LocationPoint[]; // 経路上の地点情報
}

const Map: React.FC<MapProps> = ({ center = [35.6809591, 139.7673068], zoom = 13, locations }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]); // マーカーの参照を保持

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    // locations が変更されたらマーカーを更新
    if (mapInstanceRef.current) {
      // 既存のマーカーをクリア
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      const validLocations = locations.filter(loc => loc.lat !== undefined && loc.lng !== undefined);

      validLocations.forEach(loc => {
        if (loc.lat && loc.lng) { // 型ガード
          const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current!);
          marker.bindPopup(loc.name || loc.id); // 地点名またはIDをポップアップ表示
          markersRef.current.push(marker);
        }
      });

      // 地図の中心とズームレベルを調整 (オプション)
      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(validLocations.map(loc => [loc.lat!, loc.lng!]));
        if (bounds.isValid()) {
             mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (validLocations.length === 1 && validLocations[0].lat && validLocations[0].lng) {
        mapInstanceRef.current.setView([validLocations[0].lat, validLocations[0].lng], 13);
      }
    }

    return () => {
      // アンマウント時のクリーンアップは初回のみ実行されるようにする
      // mapInstanceRef.current があれば remove するのは初回マウント時の useEffect の return で行う
    };
  }, [locations, center, zoom]); // locations を依存配列に追加

   useEffect(() => {
    // アンマウント時に地図インスタンスをクリーンアップ
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // 初回マウント時のみ実行

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md">
    </div>
  );
};

export default Map;
