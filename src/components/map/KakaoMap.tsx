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
type NaverMaps = any;

declare global {
  interface Window {
    naver: { maps: NaverMaps };
  }
}

let _scriptPromise: Promise<void> | null = null;

function loadNaverScript(clientId: string): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  if (!_scriptPromise) {
    _scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        _scriptPromise = null;
        reject(new Error("Naver Maps 스크립트 로드 실패"));
      };
      document.head.appendChild(script);
    });
  }
  return _scriptPromise;
}

export default function KakaoMap({
  center = { lat: 35.2279, lng: 128.6811 },
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
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_KEY;
    if (!clientId || !containerRef.current) return;

    let cancelled = false;

    loadNaverScript(clientId).then(() => {
      if (cancelled || !containerRef.current) return;
      const { maps } = window.naver;

      const init = () => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(center.lat, center.lng),
          zoom,
        });
        mapRef.current = map;
        if (onMapClick) {
          maps.Event.addListener(map, "click", (e: { coord: { lat(): number; lng(): number } }) => {
            onMapClick(e.coord.lat(), e.coord.lng());
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
        console.error("NaverMap:", err instanceof Error ? err.message : err);
        setLoadError(true);
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.naver?.maps) return;
    const { maps } = window.naver;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = markers.map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: Record<string, any> = {
        position: new maps.LatLng(m.lat, m.lng),
        map: mapRef.current,
        title: m.label,
      };
      if (m.color) {
        const svg = encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="8" fill="${m.color}" stroke="white" stroke-width="2.5"/></svg>`
        );
        opts.icon = {
          url: `data:image/svg+xml;charset=UTF-8,${svg}`,
          size: new maps.Size(22, 22),
          anchor: new maps.Point(11, 11),
        };
      }
      return new maps.Marker(opts);
    });
  }, [markers]);

  useEffect(() => {
    if (!mapRef.current || !window.naver?.maps) return;
    const { maps } = window.naver;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = polylines.map((pl) => {
      return new maps.Polyline({
        map: mapRef.current,
        path: pl.points.map((p) => new maps.LatLng(p.lat, p.lng)),
        strokeColor: pl.color ?? "#3b82f6",
        strokeWeight: 3,
        strokeOpacity: 0.8,
        strokeStyle: "solid",
      });
    });
  }, [polylines]);

  useEffect(() => {
    if (!mapRef.current || !window.naver?.maps) return;
    mapRef.current.setCenter(new window.naver.maps.LatLng(center.lat, center.lng));
  }, [center.lat, center.lng]);

  if (loadError) {
    return (
      <div className={`${className} bg-slate-800 flex items-center justify-center`}>
        <p className="text-slate-500 text-sm text-center px-4">
          지도를 불러올 수 없습니다<br />
          <span className="text-xs text-slate-600">네이버 클라우드 플랫폼 콘솔에서 도메인을 확인해주세요</span>
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
