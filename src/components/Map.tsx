// src/components/Map.tsx
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css'; // LeafletのCSSをインポート
import L from 'leaflet'; // Leafletライブラリをインポート

// Leafletのデフォルトアイコンパスの問題を修正 (Next.js環境でよく発生)
// これがないとマーカーアイコンが表示されない場合がある
if (typeof window !== 'undefined') { // windowオブジェクトが存在する場合のみ実行 (SSR対策)
  // @ts-expect-error  <-- ここを修正しました
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
}

const Map: React.FC<MapProps> = ({ center = [35.6809591, 139.7673068], zoom = 13 }) => {
  const mapRef = useRef<HTMLDivElement>(null); // 地図コンテナへの参照
  const mapInstanceRef = useRef<L.Map | null>(null); // 地図インスタンスへの参照

  useEffect(() => {
    // マウント時に一度だけ地図を初期化
    if (mapRef.current && !mapInstanceRef.current) {
      // 地図インスタンスを作成
      mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom);

      // OpenStreetMapのタイルレイヤーを追加
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);

      // (オプション) マーカーの追加例
      // L.marker(center).addTo(mapInstanceRef.current)
      //   .bindPopup('東京駅')
      //   .openPopup();
    }

    // コンポーネントのアンマウント時に地図インスタンスをクリーンアップ
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom]); // centerやzoomが変更されたら再描画 (今回は初回のみを想定)

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100vh', borderRadius: '0px' }} id="map-container">
      {/* スタイルは必要に応じて調整してください。
          Next.jsではグローバルCSSやCSS Modulesを使うのが一般的です。
          ここではインラインスタイルで高さを指定しています。 */}
    </div>
  );
};

export default Map;
