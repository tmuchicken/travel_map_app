// src/components/Map.tsx
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { LocationPoint } from '@/app/page'; // 型をインポート

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

      const validLocations = locations.filter(
        loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
      );

      validLocations.forEach(loc => {
        // loc.lat と loc.lng が数値であることを再度確認 (filterで保証されているが念のため)
        if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current!);
          // ポップアップ内容を明示的に文字列に変換
          marker.bindPopup(String(loc.name || loc.id));
          markersRef.current.push(marker);
        }
      });

      // 地図の中心とズームレベルを調整
      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(validLocations.map(loc => [loc.lat!, loc.lng!]));
        if (bounds.isValid()) {
             mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (validLocations.length === 1 && typeof validLocations[0].lat === 'number' && typeof validLocations[0].lng === 'number') {
        mapInstanceRef.current.setView([validLocations[0].lat, validLocations[0].lng], 13);
      }
    }

    // このuseEffect内でのクリーンアップは不要 (マーカーは毎回クリア＆再描画のため)
    // return () => {};
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
