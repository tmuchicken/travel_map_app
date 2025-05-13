// src/config/mapLayers.ts

// TileLayerData 型定義
export interface TileLayerData {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string | string[];
}

// 利用可能なタイルレイヤーのリスト
export const availableTileLayers: TileLayerData[] = [
  {
    id: 'openstreetmap',
    name: 'OpenStreetMap (標準)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  // ▼▼▼ 修正箇所 ▼▼▼
  /*
   {
     // NOTE: Stamenのタイルサービスは移行され、従来のURLは安定動作しません。
     // 利用するには Stadia Maps (旧Stamen) に登録し、APIキーを含むURLを使用する必要があります。
     // そのため、この定義は一旦コメントアウトします。
     id: 'stamenTonerLite',
     name: 'Stamen Toner Lite (シンプル)',
     url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.png',
     attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
     maxZoom: 19,
   },
  */
   // ▲▲▲ 修正箇所 ▲▲▲
  {
    id: 'cartoPositronNoLabels',
    name: 'Carto Positron (ラベルなし)',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  {
    id: 'cartoDarkMatterNoLabels',
    name: 'Carto Dark Matter (ラベルなし)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
];