"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

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
  const [, setReady] = useState(false);

  // 지도 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      // 기본 마커 아이콘 경로 수정 (Next.js 환경)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (onMapClick) {
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          onMapClick(e.latlng.lat, e.latlng.lng);
        });
      }

      mapRef.current = map;
      setReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마커 업데이트
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = markers.map((m) => {
        const icon = L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="8" fill="${m.color ?? "#3b82f6"}" stroke="white" stroke-width="2.5"/></svg>`,
          className: "",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([m.lat, m.lng], { icon, title: m.label ?? "" });
        marker.addTo(mapRef.current);
        if (m.label) marker.bindTooltip(m.label, { permanent: false });
        return marker;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  // 폴리라인 업데이트
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      polylinesRef.current.forEach((p) => p.remove());
      polylinesRef.current = polylines.map((pl) => {
        const line = L.polyline(
          pl.points.map((p) => [p.lat, p.lng] as [number, number]),
          { color: pl.color ?? "#3b82f6", weight: 3, opacity: 0.8 }
        );
        line.addTo(mapRef.current);
        return line;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polylines]);

  // 중심 이동
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng]);
  }, [center.lat, center.lng]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: "none", zIndex: 0 }}
    />
  );
}
