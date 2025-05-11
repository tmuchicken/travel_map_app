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
        zoomControl: true, // Leafletのデフォルトズームコントロールを有効にする (ワイヤーフレームのカスタムコントロールは別途実装)
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    // locations が変更されたら経路を更新
    if (mapInstanceRef.current) {
      // 既存のルーティングコントロールを削除
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
          routeWhileDragging: true, // ドラッグ中も経路を再計算 (オプション)
          show: true, // 経路の指示を表示するか (オプション)
          addWaypoints: false, // 地図クリックでウェイポイント追加機能を無効化
          draggableWaypoints: false, // ウェイポイントのドラッグ移動を無効化
          fitSelectedRoutes: 'smart', // ルートに合わせて地図の表示範囲を調整
          lineOptions: { // 経路の線のスタイル
            styles: [{ color: 'blue', opacity: 0.7, weight: 5 }]
          },
          // createMarker: function() { return null; } // デフォルトのマーカーを非表示にする場合
          // OSRMのデモサーバーを使用 (本番利用時は自身のサーバーか有料サービスを検討)
          // router: L.Routing.osrmv1({
          //   serviceUrl: `https://router.project-osrm.org/route/v1`
          // }),
          // Leaflet Routing Machine はデフォルトで OSRM のデモサーバーを使用します
        }).addTo(mapInstanceRef.current);

        // (オプション) 経路が見つからなかった場合などのエラーハンドリング
        routingControlRef.current.on('routesfound', function(e) {
          // const routes = e.routes;
          // console.log('Routes found:', routes);
        });
        routingControlRef.current.on('routingerror', function(e) {
          console.error('Routing error:', e.error);
          // エラーメッセージをユーザーに表示する処理などをここに追加
          alert(`経路の取得に失敗しました: ${e.error.message}`);
        });

      } else {
        // 有効な地点が2つ未満の場合は、地図の中心を最初の有効な地点に合わせる (またはデフォルトのビュー)
        if (waypoints.length === 1) {
          mapInstanceRef.current.setView(waypoints[0], 13);
        } else {
          // 有効な地点がない場合は、初期の中心とズームに戻すか、何もしない
          // mapInstanceRef.current.setView(center, zoom);
        }
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
