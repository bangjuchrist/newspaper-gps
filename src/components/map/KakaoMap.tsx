"use client";

import { useEffect, useRef, useState } from "react";

interface Marker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface Polyline {
  points: { lat: number; lng: number }[];
  color?: string;
}

interface KakaoMapProps {
  center?: { lat: number; lng: number };
  markers?: Marker[];
  polylines?: Polyline[];
  className?: string;
  zoom?: number;
  onMapClick?: (lat: number, lng: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KakaoMaps = any;

declare global {
  interface Window {
    kakao: { maps: KakaoMaps };
  }
}

// Module-level singleton — prevents duplicate <script> tags in React StrictMode
let _scriptPromise: Promise<void> | null = null;

function loadKakaoScript(appKey: string): Promise<void> {
  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(resolve));
  }
  if (!_scriptPromise) {
    _scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
      script.async = true;
      script.onload = () => window.kakao.maps.load(resolve);
      script.onerror = () => {
        _scriptPromise = null; // allow retry on next mount
        reject(new Error("Kakao Maps 스크립트 로드 실패 — 카카오 개발자콘솔에서 이 도메인을 등록했는지 확인하세요"));
      };
      document.head.appendChild(script);
    });
  }
  return _scriptPromise;
}

export default function KakaoMap({
  center = { lat: 37.5665, lng: 126.9780 },
  markers = [],
  polylines = [],
  className = "w-full h-64",
  zoom = 14,
  onMapClick,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylinesRef = useRef<any[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!appKey || !containerRef.current) return;

    let cancelled = false;

    loadKakaoScript(appKey).then(() => {
      if (cancelled || !containerRef.current) return;
      const { maps } = window.kakao;

      const init = () => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(center.lat, center.lng),
          level: zoom,
        });
        mapRef.current = map;
        if (onMapClick) {
          maps.event.addListener(map, "click", (mouseEvent: { latLng: { getLat(): number; getLng(): number } }) => {
            onMapClick(mouseEvent.latLng.getLat(), mouseEvent.latLng.getLng());
          });
        }
      };

      if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
        requestAnimationFrame(init);
      } else {
        init();
      }
    }).catch((err: unknown) => {
      if (!cancelled) {
        console.error("KakaoMap:", err instanceof Error ? err.message : err);
        setLoadError(true);
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const { maps } = window.kakao;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = markers.map((m) => {
      const markerOptions: Record<string, unknown> = {
        map: mapRef.current,
        position: new maps.LatLng(m.lat, m.lng),
        title: m.label,
      };
      if (m.color) {
        const svg = encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="8" fill="${m.color}" stroke="white" stroke-width="2.5"/></svg>`
        );
        markerOptions.image = new maps.MarkerImage(
          `data:image/svg+xml;charset=UTF-8,${svg}`,
          new maps.Size(22, 22),
          { offset: new maps.Point(11, 11) }
        );
      }
      return new maps.Marker(markerOptions);
    });
  }, [markers]);

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const { maps } = window.kakao;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = polylines.map((pl) => {
      const path = pl.points.map((p) => new maps.LatLng(p.lat, p.lng));
      return new maps.Polyline({
        map: mapRef.current,
        path,
        strokeWeight: 3,
        strokeColor: pl.color ?? "#3b82f6",
        strokeOpacity: 0.8,
        strokeStyle: "solid",
      });
    });
  }, [polylines]);

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    mapRef.current.setCenter(
      new window.kakao.maps.LatLng(center.lat, center.lng)
    );
  }, [center.lat, center.lng]);

  if (loadError) {
    return (
      <div className={`${className} bg-slate-800 flex items-center justify-center`}>
        <p className="text-slate-500 text-sm text-center px-4">
          지도를 불러올 수 없습니다<br />
          <span className="text-xs text-slate-600">카카오 개발자콘솔에서 도메인을 등록해주세요</span>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: "none" }}
    />
  );
}
