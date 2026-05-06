"use client";

import { useEffect, useRef } from "react";

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

function loadKakaoScript(appKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(resolve);
      return;
    }
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(resolve);
    script.onerror = reject;
    document.head.appendChild(script);
  });
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

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!appKey || !containerRef.current) return;

    loadKakaoScript(appKey).then(() => {
      if (!containerRef.current) return;
      const { maps } = window.kakao;

      // 컨테이너 크기가 0이면 다음 프레임까지 대기
      const init = () => {
        if (!containerRef.current) return;
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

    });
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

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: "none" }}
    />
  );
}
