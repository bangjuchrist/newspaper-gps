"use client";

import { useEffect, useRef } from "react";

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      return;
    }

    if (!("wakeLock" in navigator)) return;

    async function acquire() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // iOS 16 이하 또는 권한 거부 — 화면 꺼짐 방지 미지원
      }
    }

    acquire();

    // 탭 전환 후 돌아왔을 때 재획득
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && enabled) {
        acquire();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      wakeLockRef.current?.release();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);
}
