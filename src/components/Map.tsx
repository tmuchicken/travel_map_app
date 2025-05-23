// src/components/Map.tsx
import { useEffect, useRef, useCallback, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import type { LocationPoint, TransportOption } from '@/app/page';
import type { TileLayerData } from '@/config/mapLayers';

type AnimationPhase = 'stopped' | 'preDelay' | 'animating' | 'postDelay';

if (typeof window !== 'undefined') {
  // @ts-expect-error: Leaflet
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

const getBezierCurveCoordinates = (start: L.LatLng, end: L.LatLng, control: L.LatLng, numPoints: number = 50): L.LatLng[] => {
    const points: L.LatLng[] = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const lat = Math.pow(1 - t, 2) * start.lat + 2 * (1 - t) * t * control.lat + Math.pow(t, 2) * end.lat;
        const lng = Math.pow(1 - t, 2) * start.lng + 2 * (1 - t) * t * control.lng + Math.pow(t, 2) * end.lng;
        points.push(L.latLng(lat, lng));
    }
    return points;
};

const calculateControlPoint = (start: L.LatLng, end: L.LatLng): L.LatLng => {
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const perpendicularDx = -dy;
    const perpendicularDy = dx;
    const offsetFactor = 0.2;
    const controlLat = midLat + perpendicularDy * offsetFactor;
    const controlLng = midLng + perpendicularDx * offsetFactor;
    return L.latLng(controlLat, controlLng);
};


interface MapProps {
  center?: L.LatLngExpression;
  zoom?: number;
  locations: LocationPoint[];
  transportOptions: TransportOption[];
  animationPhase: AnimationPhase;
  currentSegmentIndex: number;
  segmentDurationSeconds: number;
  onSegmentComplete: () => void;
  onRoutingError: (message: string) => void;
  isPickingLocation: boolean;
  onMapClickForPicking: (latlng: L.LatLng) => void;
  selectedTileLayer: TileLayerData;
}

const Map: React.FC<MapProps> = ({
  center = [35.6809591, 139.7673068], // この props は初期表示に使われる
  zoom = 6,                         // この props は初期表示に使われる
  locations,
  transportOptions,
  animationPhase,
  currentSegmentIndex,
  segmentDurationSeconds,
  onSegmentComplete,
  onRoutingError,
  isPickingLocation,
  onMapClickForPicking,
  selectedTileLayer,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<L.Layer[]>([]);
  const markerRefs = useRef<L.Marker[]>([]);
  const animatedMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const allSegmentsRouteCoordsRef = useRef<Record<number, L.LatLng[]>>({});
  const currentAnimationSegmentCoordsRef = useRef<L.LatLng[]>([]);
  const animationStartTimeRef = useRef<number | null>(null);
  const currentSegmentTotalDurationRef = useRef<number>(0);
  const routeCalculationGenerationRef = useRef(0);
  const activeRoutingControls = useRef<L.Routing.Control[]>([]);
  const [osrmWarningDisplayed, setOsrmWarningDisplayed] = useState(false);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const animationPhaseRef = useRef(animationPhase);

  useEffect(() => {
    animationPhaseRef.current = animationPhase;
  }, [animationPhase]);

  const animateMarker = useCallback(() => {
    if (animationPhaseRef.current !== 'animating' ||
        !animatedMarkerRef.current ||
        currentAnimationSegmentCoordsRef.current.length < 2 ||
        !mapInstanceRef.current ||
        !animationStartTimeRef.current) {
      return;
    }
    const marker = animatedMarkerRef.current;
    const routeCoords = currentAnimationSegmentCoordsRef.current;
    const elapsedTime = Date.now() - animationStartTimeRef.current;
    const totalDuration = currentSegmentTotalDurationRef.current;
    const progress = Math.min(elapsedTime / totalDuration, 1);
    const targetIndexFloat = progress * (routeCoords.length - 1);
    const baseIndex = Math.floor(targetIndexFloat);
    const nextIndex = Math.min(baseIndex + 1, routeCoords.length - 1);
    const segmentProgress = targetIndexFloat - baseIndex;
    const currentPos = routeCoords[baseIndex];
    const nextPos = routeCoords[nextIndex];

    if (currentPos && nextPos) {
      const lat = currentPos.lat + (nextPos.lat - currentPos.lat) * segmentProgress;
      const lng = currentPos.lng + (nextPos.lng - currentPos.lng) * segmentProgress;
      const interpolatedLatLng = L.latLng(lat, lng);
      marker.setLatLng(interpolatedLatLng);
      if (mapInstanceRef.current && !mapInstanceRef.current.getBounds().contains(interpolatedLatLng)) {
        mapInstanceRef.current.panTo(interpolatedLatLng);
      }
    }
    if (progress < 1) {
      animationFrameIdRef.current = requestAnimationFrame(animateMarker);
    } else {
      if (routeCoords.length > 0) {
        marker.setLatLng(routeCoords[routeCoords.length - 1]);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      onSegmentComplete();
    }
  }, [onSegmentComplete]);

  // マップの初期化
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      console.log("Map.tsx: Initializing map instance with center:", center, "zoom:", zoom);
      mapInstanceRef.current = L.map(mapRef.current, {
        center: center, // propsのcenterを使用
        zoom: zoom,     // propsのzoomを使用
        zoomControl: true,
      });
      console.log("Map.tsx: Map instance CREATED:", mapInstanceRef.current);

      if (!osrmWarningDisplayed) {
        onRoutingError("現在、経路検索にOSRMのデモサーバーを使用しています。このサーバーは本番環境での利用には適しておらず、不安定な場合があります。安定した運用のためには、ご自身でOSRMサーバーを構築するか、商用の経路検索サービスをご利用ください。");
        setOsrmWarningDisplayed(true);
      }
    } else {
      if (!mapRef.current) console.log("Map.tsx: Map init skipped, mapRef.current is null.");
      if (mapInstanceRef.current) console.log("Map.tsx: Map init skipped, mapInstanceRef.current already exists.");
    }

    return () => {
      // ... (クリーンアップ処理は変更なし) ...
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (mapInstanceRef.current) {
        activeRoutingControls.current.forEach(control => {
          if (mapInstanceRef.current) try { mapInstanceRef.current.removeControl(control); } catch (_e) { console.warn("Error removing active routing control during cleanup:", _e); }
        });
        activeRoutingControls.current = [];
        layerRefs.current.forEach(layer => {
          if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(layer)) try { mapInstanceRef.current.removeLayer(layer); } catch (_e) { console.warn("Error removing layer during cleanup:", _e); }
        });
        layerRefs.current = [];
        markerRefs.current.forEach(marker => {
          if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(marker)) {
             try {
                if (marker.getTooltip()) marker.unbindTooltip();
                if (marker.getPopup()) marker.unbindPopup();
                mapInstanceRef.current.removeLayer(marker);
             } catch (_e) { console.warn("Error removing marker during cleanup:", _e); }
          }
        });
        markerRefs.current = [];
        if (animatedMarkerRef.current && mapInstanceRef.current && mapInstanceRef.current.hasLayer(animatedMarkerRef.current)) {
          try { mapInstanceRef.current.removeLayer(animatedMarkerRef.current); } catch (_e) { console.warn("Error removing animated marker during cleanup:", _e); }
        }
        animatedMarkerRef.current = null;
        if (currentTileLayerRef.current && mapInstanceRef.current.hasLayer(currentTileLayerRef.current)) {
            try { mapInstanceRef.current.removeLayer(currentTileLayerRef.current); } catch(_e) { console.warn("Error removing tile layer during cleanup:", _e); }
        }
        currentTileLayerRef.current = null;
        console.log("Map.tsx: Removing map instance on unmount."); // ★ クリーンアップ時のログ
        try { mapInstanceRef.current.remove(); } catch (_e) { console.warn("Error removing map instance during cleanup:", _e); }
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ★ 依存配列を空に戻す (初回マウント時のみ実行)

  // タイルレイヤーの設定と更新
  useEffect(() => {
    console.log("Map.tsx: TileLayer useEffect - mapInstance:", mapInstanceRef.current, "selectedTileLayer:", selectedTileLayer); // ★ ログ追加
    if (!mapInstanceRef.current || !selectedTileLayer || !selectedTileLayer.url) { // urlの存在もチェック
      console.log("Map.tsx: TileLayer useEffect - map instance or selectedTileLayer (or its URL) is not ready.");
      return;
    }

    if (currentTileLayerRef.current) {
      console.log("Map.tsx: Removing old tile layer.");
      mapInstanceRef.current.removeLayer(currentTileLayerRef.current);
    }

    console.log("Map.tsx: Adding new tile layer:", selectedTileLayer.name, "URL:", selectedTileLayer.url);
    const newLayer = L.tileLayer(selectedTileLayer.url, {
      attribution: selectedTileLayer.attribution,
      maxZoom: selectedTileLayer.maxZoom || 19, // デフォルトのmaxZoomを設定
      subdomains: selectedTileLayer.subdomains || 'abc',
    });

    newLayer.on('tileerror', function(errorEvent) {
        console.error('TileError for layer:', selectedTileLayer.name, errorEvent);
        onRoutingError(`地図タイル「${selectedTileLayer.name}」の読み込みに失敗しました。別のスタイルを試すか、ネットワーク接続を確認してください。`);
    });
    newLayer.on('load', function() {
        console.log("Map.tsx: Tile layer LOADED:", selectedTileLayer.name); // ★ ログ追加
    });

    newLayer.addTo(mapInstanceRef.current);
    currentTileLayerRef.current = newLayer;
  }, [selectedTileLayer, onRoutingError]); // ★ mapInstanceRef.current の準備は初期化useEffectに任せる

  // 経路描画、静的マーカーとツールチップの表示
  useEffect(() => {
    // ... (このuseEffectのロジックは変更なし) ...
    if (!mapInstanceRef.current) return;
    routeCalculationGenerationRef.current++;
    const currentGeneration = routeCalculationGenerationRef.current;
    activeRoutingControls.current.forEach(control => {
      if (mapInstanceRef.current) try { mapInstanceRef.current.removeControl(control); } catch(_e){ console.warn("Error removing old active routing control:", _e); }
    });
    activeRoutingControls.current = [];
    layerRefs.current.forEach(layer => {
      if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(layer)) mapInstanceRef.current.removeLayer(layer);
    });
    layerRefs.current = [];
    markerRefs.current.forEach(marker => {
      if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(marker)) {
        if (marker.getTooltip()) marker.unbindTooltip();
        if (marker.getPopup()) marker.unbindPopup();
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markerRefs.current = [];
    allSegmentsRouteCoordsRef.current = {};
    const validLocations = locations.filter(
      loc => typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );
    validLocations.forEach(loc => {
      if (mapInstanceRef.current && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstanceRef.current);
        let tooltipContent = `<div style="text-align: center; min-width: 75px;">`;
        if (loc.name && loc.name.trim() !== '') {
          const escapedName = loc.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
          tooltipContent += `<strong>${escapedName}</strong>`;
        }
        if (loc.photoDataUrl) {
          if (loc.name && loc.name.trim() !== '') tooltipContent += `<br style="margin-bottom: 2px;" />`;
          tooltipContent += `<img src="${loc.photoDataUrl}" alt="写真" style="max-width: 90px; max-height: 90px; margin-top: 2px; border-radius: 3px; display: block; margin-left: auto; margin-right: auto;" />`;
        }
        tooltipContent += `</div>`;
        if ((loc.showLabel ?? true) && ((loc.name && loc.name.trim() !== '') || loc.photoDataUrl)) {
          marker.bindTooltip(tooltipContent, {
            permanent: true,
            direction: 'top',
            offset: L.point(0, -15),
            className: 'custom-location-tooltip'
          }).openTooltip();
        }
        markerRefs.current.push(marker);
      }
    });
    if (validLocations.length < 2) {
      layerRefs.current.forEach(layer => {
        if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(layer)) mapInstanceRef.current.removeLayer(layer);
      });
      layerRefs.current = [];
      return;
    }
    const routePromises = validLocations.map((startPoint, i) => {
      if (i >= validLocations.length - 1) return Promise.resolve();
      const endPoint = validLocations[i + 1];
      const transportMode = startPoint.transport;
      if (typeof startPoint.lat !== 'number' || typeof startPoint.lng !== 'number' || typeof endPoint.lat !== 'number' || typeof endPoint.lng !== 'number' || !mapInstanceRef.current) {
        allSegmentsRouteCoordsRef.current[i] = []; return Promise.resolve();
      }
      const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
      const endLatLng = L.latLng(endPoint.lat, endPoint.lng);
      if (transportMode === 'Plane' || transportMode === 'Ship') {
          if (mapInstanceRef.current) {
              let polylineColor: string; let dashArray: string | undefined = undefined;
              const controlPoint = calculateControlPoint(startLatLng, endLatLng);
              const coordsToDraw = getBezierCurveCoordinates(startLatLng, endLatLng, controlPoint);
              if (transportMode === 'Plane') { polylineColor = 'green'; dashArray = '5, 10'; } else { polylineColor = 'blue'; }
              const polyline = L.polyline(coordsToDraw, { color: polylineColor, weight: 3, opacity: 0.7, dashArray: dashArray }).addTo(mapInstanceRef.current);
              layerRefs.current.push(polyline); allSegmentsRouteCoordsRef.current[i] = coordsToDraw;
          } else { allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng]; }
          return Promise.resolve();
      } else {
        return new Promise<void>((resolveRoutePromise) => {
          if (!mapInstanceRef.current) { allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng]; resolveRoutePromise(); return; }
          const planOptions: L.Routing.PlanOptions = { createMarker: () => false, draggableWaypoints: false, addWaypoints: false };
          const routingControl = L.Routing.control({
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: transportMode === 'Walk' ? 'foot' : 'car' }),
            plan: L.routing.plan([startLatLng, endLatLng], planOptions),
            routeWhileDragging: false, show: false, addWaypoints: false, fitSelectedRoutes: false,
            lineOptions: { styles: [{ color: 'blue', opacity: 0.7, weight: 5 }], extendToWaypoints: true, missingRouteTolerance: 100 },
          });
          routingControl.on('routesfound', function(this: L.Routing.Control, e_routes: L.Routing.RoutingResultEvent) {
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) try { mapInstanceRef.current.removeControl(this); } catch(_err){ console.warn("Error removing control in stale routesfound", _err); }
              activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this); resolveRoutePromise(); return;
            }
            if (e_routes.routes && e_routes.routes.length > 0 && e_routes.routes[0].coordinates) {
              allSegmentsRouteCoordsRef.current[i] = e_routes.routes[0].coordinates;
              if (mapInstanceRef.current) { const routeLine = L.polyline(e_routes.routes[0].coordinates, { color: 'blue', opacity: 0.7, weight: 5 }).addTo(mapInstanceRef.current); layerRefs.current.push(routeLine); }
            } else {
              allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng]; onRoutingError(`区間 ${i+1} (${startPoint.name} -> ${endPoint.name}) の経路が見つかりませんでした。直線で表示します。`);
              if (mapInstanceRef.current) { const fallbackPolyline = L.polyline([startLatLng, endLatLng], { color: 'orange', weight: 3, opacity: 0.7, dashArray: '5, 5' }).addTo(mapInstanceRef.current); layerRefs.current.push(fallbackPolyline); }
            }
            if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) try { mapInstanceRef.current.removeControl(this); } catch(_err){ console.warn("Error removing control in routesfound", _err); }
            activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this); resolveRoutePromise();
          });
          routingControl.on('routingerror', function(this: L.Routing.Control, errEvent: L.Routing.RoutingErrorEvent) {
            if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) {
              if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) try { mapInstanceRef.current.removeControl(this); } catch(_err){ console.warn("Error removing control in stale routingerror", _err); }
              activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this); resolveRoutePromise(); return;
            }
            onRoutingError(`区間 ${i+1} (${startPoint.name} -> ${endPoint.name}) の経路計算中にエラー: ${errEvent.error?.message || '不明なエラー'}. 直線で表示します。`);
            if (mapInstanceRef.current) { const fallbackPolyline = L.polyline([startLatLng, endLatLng], { color: 'red', weight: 3, opacity: 0.5, dashArray: '5, 5' }).addTo(mapInstanceRef.current); layerRefs.current.push(fallbackPolyline); }
            allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng];
            if (mapInstanceRef.current && activeRoutingControls.current.includes(this)) try { mapInstanceRef.current.removeControl(this); } catch(_err){ console.warn("Error removing control in routingerror", _err); }
            activeRoutingControls.current = activeRoutingControls.current.filter(c => c !== this); resolveRoutePromise();
          });
          if (mapInstanceRef.current) { const addedControl = routingControl.addTo(mapInstanceRef.current); activeRoutingControls.current.push(addedControl); }
          else { allSegmentsRouteCoordsRef.current[i] = [startLatLng, endLatLng]; resolveRoutePromise(); }
        });
      }
    });
    Promise.allSettled(routePromises).then(() => {
      if (currentGeneration !== routeCalculationGenerationRef.current || !mapInstanceRef.current) return;
      if (validLocations.length > 0) {
          const bounds = L.latLngBounds(validLocations.map(loc => L.latLng(loc.lat!, loc.lng!)));
          if (bounds.isValid() && mapInstanceRef.current) mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    });
  }, [locations, transportOptions, onRoutingError]);

  // アニメーション状態の制御 useEffect (変更なし)
  useEffect(() => {
    // ... (以前提示した animationPhase に基づくアニメーション制御ロジック) ...
    if (!mapInstanceRef.current) return;
    const validLocations = locations.filter(loc => typeof loc.lat === 'number' && typeof loc.lng === 'number');
    if (animationPhase === 'stopped') {
      if (animatedMarkerRef.current && mapInstanceRef.current.hasLayer(animatedMarkerRef.current)) {
        mapInstanceRef.current.removeLayer(animatedMarkerRef.current);
        animatedMarkerRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    } else if (animationPhase === 'preDelay') {
      if (validLocations.length > 0) {
        const firstPoint = validLocations[0];
        const transportOption = transportOptions.find(opt => opt.name === firstPoint.transport);
        if (transportOption && typeof firstPoint.lat === 'number' && typeof firstPoint.lng === 'number') {
          const startLatLng = L.latLng(firstPoint.lat, firstPoint.lng);
          if (!animatedMarkerRef.current) {
            animatedMarkerRef.current = L.marker(startLatLng, {
              icon: createAnimatedIcon(transportOption.label),
              zIndexOffset: 1000
            }).addTo(mapInstanceRef.current);
          } else {
            animatedMarkerRef.current.setLatLng(startLatLng);
            animatedMarkerRef.current.setIcon(createAnimatedIcon(transportOption.label));
          }
           if (mapInstanceRef.current && !mapInstanceRef.current.getBounds().contains(startLatLng)) {
            mapInstanceRef.current.panTo(startLatLng);
          }
        }
      }
    } else if (animationPhase === 'animating') {
      if (currentSegmentIndex < validLocations.length - 1 && validLocations.length > 0) {
        const segmentStartPoint = validLocations[currentSegmentIndex];
        const transportOption = transportOptions.find(opt => opt.name === segmentStartPoint.transport);
        const coordsForCurrentSegment = allSegmentsRouteCoordsRef.current[currentSegmentIndex] || [];
        currentAnimationSegmentCoordsRef.current = coordsForCurrentSegment;
        if (transportOption && typeof segmentStartPoint.lat === 'number' && typeof segmentStartPoint.lng === 'number' &&
            coordsForCurrentSegment.length > 0 && mapInstanceRef.current) {
            const startLatLng = coordsForCurrentSegment[0];
            if (!animatedMarkerRef.current) {
                animatedMarkerRef.current = L.marker(startLatLng, {
                    icon: createAnimatedIcon(transportOption.label),
                    zIndexOffset: 1000
                }).addTo(mapInstanceRef.current);
            } else {
                animatedMarkerRef.current.setLatLng(startLatLng);
                animatedMarkerRef.current.setIcon(createAnimatedIcon(transportOption.label));
            }
            const durationMs = (segmentDurationSeconds > 0) ? segmentDurationSeconds * 1000 : 5000;
            currentSegmentTotalDurationRef.current = durationMs;
            animationStartTimeRef.current = Date.now();
            animateMarker();
        } else {
            onSegmentComplete();
        }
      } else {
        onSegmentComplete();
      }
    } else if (animationPhase === 'postDelay') {
      if (validLocations.length > 1 && animatedMarkerRef.current) {
        const lastSegmentIndex = validLocations.length - 2;
        const lastPointCoords = allSegmentsRouteCoordsRef.current[lastSegmentIndex];
        if (lastPointCoords && lastPointCoords.length > 0) {
          const endLatLng = lastPointCoords[lastPointCoords.length - 1];
          animatedMarkerRef.current.setLatLng(endLatLng);
           if (mapInstanceRef.current && !mapInstanceRef.current.getBounds().contains(endLatLng)) {
            mapInstanceRef.current.panTo(endLatLng);
          }
        }
      }
    }
  }, [animationPhase, currentSegmentIndex, locations, transportOptions, segmentDurationSeconds, onSegmentComplete, animateMarker]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const handleMapClickWithLatLng = (e_click: L.LeafletMouseEvent) => {
      if (isPickingLocation) {
        onMapClickForPicking(e_click.latlng);
      }
    };
    if (isPickingLocation) {
      map.on('click', handleMapClickWithLatLng);
      if(map.getContainer()) map.getContainer().style.cursor = 'crosshair';
    } else {
      map.off('click', handleMapClickWithLatLng);
      if (map.getContainer()) {
        map.getContainer().style.cursor = '';
      }
    }
    return () => {
      map.off('click', handleMapClickWithLatLng);
      if (map.getContainer()) {
        map.getContainer().style.cursor = '';
      }
    };
  }, [isPickingLocation, onMapClickForPicking]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-container" className="rounded-md bg-gray-100 dark:bg-slate-900">
    </div>
  );
};

export default Map;