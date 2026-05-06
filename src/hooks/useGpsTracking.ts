"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const GPS_INTERVAL_MS = 15_000;

interface UseGpsTrackingOptions {
  routeId: string;
  enabled: boolean;
}

export function useGpsTracking({ routeId, enabled }: UseGpsTrackingOptions) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const supabase = createClient();

  const insertGpsPoint = useCallback(
    async (position: GeolocationPosition) => {
      await supabase.from("route_gps_points").insert({
        route_id: routeId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    [routeId, supabase]
  );

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    // 최신 위치를 15초마다 INSERT
    intervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        insertGpsPoint(lastPositionRef.current);
      }
    }, GPS_INTERVAL_MS);

    // watchPosition으로 실시간 위치 추적
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        lastPositionRef.current = position;
      },
      (err) => {
        console.error("GPS error:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, insertGpsPoint]);
}
