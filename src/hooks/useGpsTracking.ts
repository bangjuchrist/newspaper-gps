"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const GPS_INTERVAL_MS = 15_000;

interface UseGpsTrackingOptions {
  routeId: string;
  enabled: boolean;
}

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export function useGpsTracking({ routeId, enabled }: UseGpsTrackingOptions) {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const supabase = createClient();

  const insertGpsPoint = useCallback(
    async (pos: GeolocationPosition) => {
      await supabase.from("route_gps_points").insert({
        route_id: routeId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
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

    intervalRef.current = setInterval(() => {
      if (lastPositionRef.current) insertGpsPoint(lastPositionRef.current);
    }, GPS_INTERVAL_MS);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = pos;
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, insertGpsPoint]);

  return { position };
}
