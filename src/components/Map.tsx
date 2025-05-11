// src/components/Map.tsx
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import type { LocationPoint } from '@/app/page';

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
  locations: LocationPoint[];
}

const Map: React.FC<MapProps> = ({ center = [35.6809591, 139.7673068], zoom = 13, locations }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  // 複数のルーティングコントロールやポリラインを管理するための参照
  const layerRefs = useRef<(L.Routing.Control | L.Polyline)[]>([]);
  const markerRefs = useRef<L.Marker[]>([]);


  useEffect(() => {
    // 地図の初期化 (初回のみ)
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true, // Leafletのデフォルトズームコントロールを表示
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    // locations が変更されたら経路とマーカーを更新
    if (mapInstanceRef.current) {
      // 既存の経路レイヤーとマーカーを全て削除
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

      // まず全地点にマーカーを設置
      validLocations.forEach(loc => {
        if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current!);
          marker.bindPopup(String(loc.name || loc.id));
          markerRefs.current.push(marker);
        }
      });

      // 区間ごとに経路を描画
      for (let i = 0; i < validLocations.length - 1; i++) {
        const startPoint = validLocations[i];
        const endPoint = validLocations[i+1];

        // startPoint.transport は、その地点から次の地点への移動手段を指す
        const transportMode = startPoint.transport;

        if (typeof startPoint.lat === 'number' && typeof startPoint.lng === 'number' &&
            typeof endPoint.lat === 'number' && typeof endPoint.lng === 'number') {

          const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
          const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

          if (transportMode === 'Plane') { // 飛行機の場合は直線を描画
            const polyline = L.polyline([startLatLng, endLatLng], {
              color: 'green', // 飛行機の経路の色
              weight: 3,
              opacity: 0.7,
              dashArray: '5, 10' // 点線にする
            }).addTo(mapInstanceRef.current!);
            layerRefs.current.push(polyline);
          } else { // その他の移動手段 (バス, 電車, 車, 徒歩) はルーティングマシンを使用
            const routingControl = L.Routing.control({
              waypoints: [startLatLng, endLatLng],
              routeWhileDragging: false, // 各セグメントではドラッグを無効化
              show: false,             // 経路指示は非表示 (全体で表示する場合は別途検討)
              addWaypoints: false,
              createMarker: () => null, // マーカーは別途描画するため、ここでは無効化
              fitSelectedRoutes: false,  // 自動ズームは最後にまとめて行う
              lineOptions: {
                styles: [{ color: 'blue', opacity: 0.7, weight: 5 }],
                extendToWaypoints: true,
                missingRouteTolerance: 50,
              },
            }).addTo(mapInstanceRef.current!);

            routingControl.on('routingerror', function(e) {
              console.error(`Routing error for segment ${startPoint.name} to ${endPoint.name}:`, e.error);
              // エラー発生区間を直線で結ぶなどのフォールバックも検討可能
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

      // 全ての有効な地点が表示されるように地図の表示範囲を調整
      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (validLocations.length === 1 && typeof validLocations[0].lat === 'number' && typeof validLocations[0].lng === 'number') {
        mapInstanceRef.current.setView([validLocations[0].lat, validLocations[0].lng], 13);
      }
    }
  }, [locations, center, zoom]); // locations が変更されたら再実行

  useEffect(() => {
    // アンマウント時に地図インスタンスをクリーンアップ
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
