// src/components/Map.tsx
import { useEffect, useRef, useCallback, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import type { LocationPoint, TransportOption } from '@/app/page';

// LeafletのデフォルトアイコンURL解決のための修正 (Next.js環境での問題回避)
if (typeof window !== 'undefined') {
  // @ts-expect-error: LeafletのデフォルトアイコンURL解決はNext.js/webpack環境で問題を起こすことがあるため
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// アニメーション用アイコンを作成するヘルパー関数
const createAnimatedIcon = (transportLabel: string) => {
  return L.divIcon({
    html: `<span style="font-size: 24px;">${transportLabel}</span>`,
    className: 'leaflet-animated-marker-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15], // アイコンの中心を座標に合わせる
  });
};

// シンプルなベジェ曲線の座標を生成する関数
// 始点、終点、制御点から曲線を構成する点の配列を生成
const getBezierCurveCoordinates = (start: L.LatLng, end: L.LatLng, control: L.LatLng, numPoints: number = 50): L.LatLng[] => {
    const points: L.LatLng[] = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        // Quadratic Bezier curve formula: B(t) = (1-t)^2 * P0 + 2 * (1-t) * t * P1 + t^2 * P2
        const lat = Math.pow(1 - t, 2) * start.lat + 2 * (1 - t) * t * control.lat + Math.pow(t, 2) * end.lat;
        const lng = Math.pow(1 - t, 2) * start.lng + 2 * (1 - t) * t * control.lng + Math.pow(t, 2) * end.lng;
        points.push(L.latLng(lat, lng));
    }
    return points;
};

// 制御点を計算するシンプルな関数 (中点から垂直方向にオフセット)
const calculateControlPoint = (start: L.LatLng, end: L.LatLng): L.LatLng => {
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;

    // 始点から終点へのベクトル
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;

    // ベクトルに垂直な方向 (90度回転)
    // 経度差と緯度差はスケールが異なるため、単純な回転は不正確ですが、シンプルな曲線には十分です。
    // より正確には、地球上の大円コースなどを考慮する必要がありますが、ここでは簡易的に。
    const perpendicularDx = -dy;
    const perpendicularDy = dx;

    // オフセットの距離 (適当な調整係数)
    const offsetFactor = 0.2; // この値を調整して曲線の膨らみ具合を変える

    const controlLat = midLat + perpendicularDy * offsetFactor;
    const controlLng = midLng + perpendicularDx * offsetFactor;

    return L.latLng(controlLat, controlLng);
};


interface MapProps {
  center?: L.LatLngExpression;
  zoom?: number;
  locations: LocationPoint[];
  transportOptions: TransportOption[];
  isPlaying: boolean;
  currentSegmentIndex: number;
  segmentDurationSeconds: number; // 各区間の移動時間 (秒)
  onSegmentComplete: () => void;
  onRoutingError: (message: string) => void;
}

const Map: React.FC<MapProps> = ({
  center = [35.6809591, 139.7673068],
  zoom = 6,
  locations,
  transportOptions,
  isPlaying,
  currentSegmentIndex,
  segmentDurationSeconds,
  onSegmentComplete,
  onRoutingError,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<L.Layer[]>([]); // 地図上に描画された経路やポリラインなどのレイヤーを管理
  const markerRefs = useRef<L.Marker[]>([]); // 地点マーカーを管理
  const animatedMarkerRef = useRef<L.Marker | null>(null); // アニメーションするアイコンマーカー
  const animationFrameIdRef = useRef<number | null>(null); // アニメーションフレームIDを保持

  const allSegmentsRouteCoordsRef = useRef<Record<number, L.LatLng[]>>({}); // 各区間の経路座標を保存
  const currentAnimationSegmentCoordsRef = useRef<L.LatLng[]>([]); // 現在アニメーション中の区間の座標
  const animationStartTimeRef = useRef<number | null>(null); // 現在の区間のアニメーション開始時間
  const currentSegmentTotalDurationRef = useRef<number>(0); // 現在の区間のアニメーション合計時間 (ミリ秒)
  const routeCalculationGenerationRef = useRef(0); // 経路計算の世代管理 (古い計算結果を無視するため)
  const activeRoutingControls = useRef<L.Routing.Control[]>([]); // 現在有効なL.Routing.Controlインスタンスを管理

  const [osrmWarningDisplayed, setOsrmWarningDisplayed] = useState(false); // OSRM警告表示フラグ

  // アニメーションフレームごとにアイコンの位置を更新する関数
  const animateMarker = useCallback(() => {
    // アニメーションに必要な情報が揃っているか確認
    if (!animatedMarkerRef.current || currentAnimationSegmentCoordsRef.current.length < 2 || !mapInstanceRef.current || !animationStartTimeRef.current) {
      // 情報が不足している場合は、アニメーションを停止し、区間完了を通知
      if (isPlaying) {
        onSegmentComplete();
      }
      return;
    }

    const marker = animatedMarkerRef.current; // アニメーション対象のマーカー
    const routeCoords = currentAnimationSegmentCoordsRef.current; // 現在の区間の経路座標
    const elapsedTime = Date.now() - animationStartTimeRef.current; // 経過時間
    const totalDuration = currentSegmentTotalDurationRef.current; // 区間の合計時間
    const progress = Math.min(elapsedTime / totalDuration, 1); // アニメーションの進捗度 (0から1)

    // アニメーションが完了していない場合
    if (progress < 1) {
      // 経路座標配列上の目標インデックスを計算 (小数値になりうる)
      const targetIndexFloat = progress * (routeCoords.length - 1);
      // 目標インデックスの整数部分と次の点のインデックス
      const baseIndex = Math.floor(targetIndexFloat);
      const nextIndex = Math.min(baseIndex + 1, routeCoords.length - 1);
      // baseIndexからnextIndexへの区間内での進捗度
      const segmentProgress = targetIndexFloat - baseIndex;

      const currentPos = routeCoords[baseIndex]; // 現在位置の座標
      const nextPos = routeCoords[nextIndex]; // 次の位置の座標

      // 座標が存在する場合、線形補間してマーカー位置を更新
      if (currentPos && nextPos) {
        const lat = currentPos.lat + (nextPos.lat - currentPos.lat) * segmentProgress;
        const lng = currentPos.lng + (nextPos.lng - currentPos.lng) * segmentProgress;
        const interpolatedLatLng = L.latLng(lat, lng);
        marker.setLatLng(interpolatedLatLng);

        // マーカーが地図の表示範囲外に出た場合、地図をパンして追従
        if (mapInstanceRef.current && !mapInstanceRef.current.getBounds().contains(interpolatedLatLng)) {
          mapInstanceRef.current.panTo(interpolatedLatLng);
        }
      }
      // 次のアニメーションフレームを要求
      animationFrameIdRef.current = requestAnimationFrame(animateMarker);
    } else {
      // アニメーションが完了した場合
      if (routeCoords.length > 0) {
        // マーカーを区間の終点に移動
        marker.setLatLng(routeCoords[routeCoords.length - 1]);
      }
      // アニメーションフレームのリクエストをキャンセル
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // 区間完了を通知
      onSegmentComplete();
    }
  }, [onSegmentComplete, isPlaying]); // isPlaying を依存配列に追加

  // マップインスタンスの初期化とタイルレイヤーの追加
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // マップインスタンスを作成
      mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom);
      // OpenStreetMapのタイルレイヤーを追加
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);

      // OSRMデモサーバーの利用に関する警告を表示 (初回のみ)
      if (!osrmWarningDisplayed) {
        onRoutingError("現在、経路検索にOSRMのデモサーバーを使用しています。このサーバーは本番環境での利用には適しておらず、不安定な場合があります。安定した運用のためには、ご自身でOSRMサーバーを構築するか、商用の経路検索サービスをご利用ください。");
        setOsrmWarningDisplayed(true);
      }
    }

    // コンポーネントのクリーンアップ処理
    return () => {
      // アニメーションが実行中の場合はキャンセル
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // マップインスタンスが存在する場合、関連するレイヤーやコントロールを削除し、マップを破棄
      if (mapInstanceRef.current) {
        activeRoutingControls.current.forEach(control => {
          if (mapInstanceRef.current) {
            try { mapInstanceRef.current.removeControl(control); } catch (e) { console.warn("Error removing active routing control during cleanup:", e); }
          }
        });
        activeRoutingControls.current = [];
        layerRefs.current.forEach(layer => {
          if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(layer)) {
            try { mapInstanceRef.current.removeLayer(layer); } catch (e) { console.warn("Error removing layer during cleanup:", e); }
          }
        });
        layerRefs.current = [];
        markerRefs.current.forEach(marker => {
          if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(marker)) {
             try { mapInstanceRef.current.removeLayer(marker); } catch (e) { console.warn("Error removing marker during cleanup:", e); }
          }
        });
        markerRefs.current = [];
        if (animatedMarkerRef.current && mapInstanceRef.current && mapInstanceRef.current.hasLayer(animatedMarkerRef.current)) {
          try { mapInstanceRef.current.removeLayer(animatedMarkerRef.current); } catch (e) { console.warn("Error removing animated marker during cleanup:", e); }
        }
        animatedMarkerRef.current = null;
        try { mapInstanceRef.current.remove(); } catch (e) { console.warn("Error removing map instance during cleanup:", e); }
        mapInstanceRef.current = null;
      }
    };
  // 依存配列は空で、マウント時に一度だけ実行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // locations または transportOptions が変更されたときに経路を再計算・描画
  useEffect(() => {
    if (!mapInstanceRef.current) return; // マップインスタンスがない場合は何もしない

    routeCalculationGenerationRef.current++; // 経路計算世代をインクリメント
    const currentGeneration = routeCalculationGenerationRef.current; // 現在の世代を保持

    // 既存の経路コントロール、レイヤー、マーカーをすべて削除
    activeRoutingControls.current.forEach(control => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.removeControl(control); } catch(e) { console.warn("Error removing old active routing control:", e); }
      }
    });
    activeRoutingControls.current = [];
    layerRefs.current.forEach(layer => {
      if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(layer)) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    layerRefs.current = [];
    markerRefs.current.forEach(marker => {
      if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(marker)) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markerRefs.current = [];
    allSegmentsRouteCoordsRef.current = {}; // 保存していた経路座標をクリア

    // 緯度・経度が有効な地点のみを抽出
    const validLocations = locations.filter(
      loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );

    // 各地点にマーカーを追加
    validLocations.forEach(loc => {
      if (mapInstanceRef.current && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current);
        marker.bindPopup(String(loc.name || `地点 ${loc.id}`)); // ポップアップに地名を表示
        markerRefs.current.push(marker);
      }
    });

    // 経路を生成するには2地点以上が必要
    if (validLocations.length < 2) {
      return;
    }

    // 各区間の経路計算または描画を行うPromiseの配列を作成
    const routePromises = validLocations.map((startPoint, i) => {
      // 最後の地点からは次の区間がないためスキップ
      if (i >= validLocations.length - 1) return Promise.resolve();

      const endPoint = validLocations[i + 1]; // 次の地点
      const transportMode = startPoint.transport; // 現在の区間の移動手段

      // 始点または終点の座標が無効な場合は、空の座標配列で解決
      if (typeof startPoint.lat !== 'number' || typeof startPoint.lng !== 'number' ||
          typeof endPoint.lat !== 'number' || typeof endPoint.lng !== 'number' || !mapInstanceRef.current) {
        allSegmentsRouteCoordsRef.current[i] = [];
        return Promise.resolve();
      }
      const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
      const endLatLng = L.latLng(endPoint.lat, endPoint.lng);

      // 飛行機または船の場合は直線または曲線を描画
      if (transportMode === 'Plane' || transportMode === 'Ship') {
          if (mapInstanceRef.current) {
              let coordsToDraw: L.LatLng[];
              let polylineColor: string;
              let dashArray: string | undefined = undefined;

              if (transportMode === 'Plane') {
                  // 飛行機は直線
                  coordsToDraw = [startLatLng, endLatLng];
                  polylineColor = 'green';
                  dashArray = '5, 10'; // 点線
              } else { // transportMode === 'Ship'
                  // 船はシンプルな曲線
                  const controlPoint = calculateControlPoint(startLatLng, endLatLng);
                  coordsToDraw = getBezierCurveCoordinates(startLatLng, endLatLng, controlPoint);
                  polylineColor = 'blue'; // 船の線の色
              }

              // ポリラインを地図に追加
              const polyline = L.polyline(coordsToDraw, {
                  color: polylineColor,
                  weight: 3,
                  opacity: 0.7,
                  dashArray: dashArray,
              }).addTo(mapInstanceRef.current);
              layerRefs.current.push(polyline); // 後で削除するために参照を保存
          }
          // アニメーションのために座標を保存
          if (transportMode === 'Ship') {
              const controlPoint = calculateControlPoint(startLatLng, endLatLng);
              allSegmentsRouteCoordsRef.current[i] = getBezierCurveCoordinates(startLatLng, endLatLng, controlPoint);
          } else {
              // 飛行機の場合は直線の座標を保存
              allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
          }


          return Promise.resolve(); // 非同期処理ではないため即時解決
      } else {
        // 陸上交通（車、バス、電車、徒歩）の場合はOSRMで経路検索
        return new Promise<void>((resolveRoutePromise) => {
          if (!mapInstanceRef.current) {
            // マップインスタンスがない場合は直線でフォールバックし解決
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            resolveRoutePromise(); return;
          }

          // Leaflet Routing Machineのプラン設定
          const planOptions: L.Routing.PlanOptions = {
            // ウェイポイントマーカーは表示しない
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            createMarker: (_waypointIndex: number, _waypoint: L.Routing.Waypoint, _numberOfWaypoints: number) => false,
            draggableWaypoints: false, // ウェイポイントのドラッグ無効
            addWaypoints: false, // ウェイポイントの追加無効
          };

          // Leaflet Routing Machineコントロールを作成
          const routingControl = L.Routing.control({
            router: L.Routing.osrmv1({
              serviceUrl: 'https://router.project-osrm.org/route/v1', // OSRMデモサーバーを指定
              profile: transportMode === 'Walk' ? 'foot' : 'car', // 移動手段に応じてプロファイルを変更
            }),
            plan: L.routing.plan([startLatLng, endLatLng], planOptions), // 始点と終点を設定
            routeWhileDragging: false,
            show: false,
            addWaypoints: false,
            fitSelectedRoutes: false,
            lineOptions: { styles: [{ color: 'blue', opacity: 0.7, weight: 5 }], extendToWaypoints: true, missingRouteTolerance: 100 },
          });

          // 経路が見つかったときのイベントハンドラを設定
          routingControl.on('routesfound', function(this: L.Routing.Control, e: L.Routing.RoutingResultEvent) {
            // 現在の経路計算世代と一致しない場合は処理をスキップ (古い計算結果を無視)
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              // 古いコントロールがアクティブなリストに残っている場合は削除
              if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) {
                try { mapInstanceRef.current.removeControl(this); } catch(err){ console.warn("Error removing control in stale routesfound", err); }
                activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this);
              }
              resolveRoutePromise(); return;
            }
            // 経路が見つかり、座標が存在する場合
            if (e.routes && e.routes.length > 0 && e.routes[0].coordinates) {
              allSegmentsRouteCoordsRef.current[i] = e.routes[0].coordinates; // 経路座標を保存
              if (mapInstanceRef.current) {
                // 経路線を地図に追加
                const routeLine = L.polyline(e.routes[0].coordinates, { color: 'blue', opacity: 0.7, weight: 5 }).addTo(mapInstanceRef.current);
                layerRefs.current.push(routeLine); // 後で削除するために参照を保存
              }
            } else {
              // 経路が見つからなかった場合、直線でフォールバック
              allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
              onRoutingError(`区間 ${i+1} (${startPoint.name} -> ${endPoint.name}) の経路が見つかりませんでした。直線で表示します。`);
              if (mapInstanceRef.current) {
                // フォールバック用の点線を描画
                const fallbackPolyline = L.polyline([startLatLng, endLatLng], { color: 'orange', weight: 3, opacity: 0.7, dashArray: '5, 5' }).addTo(mapInstanceRef.current);
                layerRefs.current.push(fallbackPolyline); // 後で削除するために参照を保存
              }
            }
            // 経路計算が完了したコントロールをアクティブなリストから削除し、地図からも削除
            if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) {
              try { mapInstanceRef.current.removeControl(this); } catch(err){ console.warn("Error removing control in routesfound", err); }
              activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this);
            }
            resolveRoutePromise(); // Promiseを解決
          });

          // 経路計算中にエラーが発生したときのイベントハンドラを設定
          routingControl.on('routingerror', function(this: L.Routing.Control, errEvent: L.Routing.RoutingErrorEvent) {
            // 現在の経路計算世代と一致しない場合は処理をスキップ
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              // 古いコントロールがアクティブなリストに残っている場合は削除
              if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) {
                 try { mapInstanceRef.current.removeControl(this); } catch(err){ console.warn("Error removing control in stale routingerror", err); }
                activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this);
              }
              resolveRoutePromise(); return;
            }
            // エラーメッセージを表示し、直線でフォールバック
            onRoutingError(`区間 ${i+1} (${startPoint.name} -> ${endPoint.name}) の経路計算中にエラー: ${errEvent.error?.message || '不明なエラー'}. 直線で表示します。`);
            if (mapInstanceRef.current) {
              // フォールバック用の点線を描画
              const fallbackPolyline = L.polyline([startLatLng, endLatLng], { color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5' }).addTo(mapInstanceRef.current);
              layerRefs.current.push(fallbackPolyline); // 後で削除するために参照を保存
            }
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng]; // 直線の座標を保存
            // エラーが発生したコントロールをアクティブなリストから削除し、地図からも削除
            if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) {
              try { mapInstanceRef.current.removeControl(this); } catch(err){ console.warn("Error removing control in routingerror", err); }
              activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this);
            }
            resolveRoutePromise(); // Promiseを解決
          });


          // マップインスタンスが存在する場合、ルーティングコントロールを地図に追加し、activeRoutingControls に格納
          if (mapInstanceRef.current) {
            // addTo() は追加したコントロール自身を返す
            const addedControl = routingControl.addTo(mapInstanceRef.current);
            activeRoutingControls.current.push(addedControl);
          } else {
            // マップインスタンスがない場合は直線でフォールバックし解決
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            resolveRoutePromise();
          }
        });
      }
    });

    // 全ての経路計算Promiseが完了した後に実行
    Promise.allSettled(routePromises).then(() => {
      // 現在の経路計算世代と一致しない場合は処理をスキップ
      if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) return;

      // 全ての地点を含むように地図の表示範囲を調整
      if (validLocations.length > 0) {
          const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
          if (bounds.isValid() && mapInstanceRef.current) {
              // 適切なパディングと最大ズームレベルでフィット
              mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          }
      }
    });
  }, [locations, transportOptions, onRoutingError]); // locations または transportOptions が変更されたときにこのEffectを再実行

  // アニメーションの状態 (isPlaying, currentSegmentIndex, segmentDurationSeconds) が変更されたときに実行
  useEffect(() => {
    if (!mapInstanceRef.current) return; // マップインスタンスがない場合は何もしない

    const validLocations = locations.filter(loc => typeof loc.lat === 'number' && typeof loc.lng === 'number');

    // アニメーションが再生中で、かつ次の区間が存在する場合
    if (isPlaying && currentSegmentIndex < validLocations.length - 1 && validLocations.length > 0) {
        const segmentStartPoint = validLocations[currentSegmentIndex]; // 現在の区間の始点
        const transportOption = transportOptions.find(opt => opt.name === segmentStartPoint.transport); // 移動手段オプション
        const coordsForCurrentSegment = allSegmentsRouteCoordsRef.current[currentSegmentIndex] || []; // 現在の区間の経路座標
        currentAnimationSegmentCoordsRef.current = coordsForCurrentSegment; // アニメーション用の座標として設定

        // 移動手段オプションが存在し、始点の座標が有効で、経路座標が存在する場合
        if (transportOption && typeof segmentStartPoint.lat === 'number' && typeof segmentStartPoint.lng === 'number' &&
            coordsForCurrentSegment.length > 0 && mapInstanceRef.current) {
            const startLatLng = coordsForCurrentSegment[0]; // 区間の開始座標

            // アニメーションマーカーがまだない場合は作成し、地図に追加
            if (!animatedMarkerRef.current) {
                animatedMarkerRef.current = L.marker(startLatLng, {
                    icon: createAnimatedIcon(transportOption.label), // 移動手段に応じたアイコン
                    zIndexOffset: 1000 // 他のマーカーより前面に表示
                }).addTo(mapInstanceRef.current);
            } else {
                // 既存のマーカーの位置とアイコンを更新
                animatedMarkerRef.current.setLatLng(startLatLng);
                animatedMarkerRef.current.setIcon(createAnimatedIcon(transportOption.label));
            }

            // 区間の合計アニメーション時間を計算 (秒数 * 1000ミリ秒)
            const durationMs = (segmentDurationSeconds && segmentDurationSeconds > 0) ? segmentDurationSeconds * 1000 : 5000; // デフォルト5秒
            currentSegmentTotalDurationRef.current = durationMs;

            console.log(`Segment ${currentSegmentIndex} - Animation Duration: ${durationMs / 1000} s`);

            // アニメーションを開始
            animationStartTimeRef.current = Date.now(); // アニメーション開始時刻を記録
            animateMarker(); // アニメーション関数を呼び出し

        } else {
             // アニメーションに必要な情報が不足している場合
             currentAnimationSegmentCoordsRef.current = []; // アニメーション座標をクリア
             // アニメーションマーカーが存在する場合は削除
             if (animatedMarkerRef.current && mapInstanceRef.current && mapInstanceRef.current.hasLayer(animatedMarkerRef.current)) {
                mapInstanceRef.current.removeLayer(animatedMarkerRef.current);
                animatedMarkerRef.current = null;
             }
             // 再生中であれば区間完了を通知 (次の区間に進むか、アニメーションを停止させる)
             if (isPlaying) {
                onSegmentComplete();
             }
        }
    } else {
        // アニメーションが停止している、または最終区間が完了した場合
        currentAnimationSegmentCoordsRef.current = []; // アニメーション座標をクリア
        // アニメーションマーカーが存在する場合は削除
        if (animatedMarkerRef.current && mapInstanceRef.current && mapInstanceRef.current.hasLayer(animatedMarkerRef.current)) {
            mapInstanceRef.current.removeLayer(animatedMarkerRef.current);
            animatedMarkerRef.current = null;
        }
        // アニメーションフレームのリクエストが残っていればキャンセル
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
    }
  }, [isPlaying, currentSegmentIndex, locations, transportOptions, segmentDurationSeconds, onSegmentComplete, animateMarker]); // 依存配列にanimateMarkerを追加

  // マップコンテナ要素
  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md bg-gray-100 dark:bg-slate-900">
      {/* 地図はここに描画されます */}
    </div>
  );
};

export default Map;