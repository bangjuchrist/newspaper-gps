"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { useWakeLock } from "@/hooks/useWakeLock";
import { MapPin, Navigation } from "lucide-react";

const KakaoMap = dynamic(() => import("@/components/map/KakaoMap"), { ssr: false });

interface ActiveDeliveryClientProps {
  routeId: string;
  distributorId: string;
  distributorName: string;
  initialStatus: "active" | "paused";
  initialDelivered: number;
  initialRemaining: number;
  lastEvent: { type: string } | null;
}

export default function ActiveDeliveryClient({
  routeId,
  distributorId,
  distributorName,
  initialStatus,
  initialDelivered,
  initialRemaining,
  lastEvent,
}: ActiveDeliveryClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [delivered, setDelivered] = useState(initialDelivered);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [lastEventType, setLastEventType] = useState(lastEvent?.type ?? "");
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const isActive = status === "active";

  const { position } = useGpsTracking({ routeId, enabled: isActive });
  useWakeLock(isActive);

  const addEvent = useCallback(
    async (count: number, type: "delivered" | "undo") => {
      const { error } = await supabase.from("distribution_events").insert({
        route_id: routeId,
        distributor_id: distributorId,
        type,
        count,
      });
      if (!error) {
        if (type === "delivered") {
          setDelivered((d) => d + count);
          setRemaining((r) => r - count);
        } else {
          setDelivered((d) => d - count);
          setRemaining((r) => r + count);
        }
        setLastEventType(type);
      }
    },
    [routeId, distributorId, supabase]
  );

  async function handleDelivery(count: number) {
    await addEvent(count, "delivered");
  }

  async function handleUndo() {
    if (lastEventType === "undo") return;
    await addEvent(1, "undo");
  }

  async function handlePauseResume() {
    const newStatus = isActive ? "paused" : "active";
    const updateData = isActive
      ? { status: "paused" as const, paused_at: new Date().toISOString() }
      : { status: "active" as const, paused_at: null as string | null };

    await supabase.from("routes").update(updateData).eq("id", routeId);
    setStatus(newStatus);
  }

  async function handleComplete() {
    setLoading(true);
    await supabase
      .from("routes")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", routeId);
    router.push(`/distributor/complete?route=${routeId}`);
  }

  const mapCenter = position
    ? { lat: position.lat, lng: position.lng }
    : { lat: 37.5665, lng: 126.978 };

  const mapMarkers = position
    ? [{ lat: position.lat, lng: position.lng, label: "현재 위치" }]
    : [];

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      {/* 상단 헤더 */}
      <header className="px-4 py-4 flex items-center justify-between bg-slate-800">
        <div>
          <p className="text-slate-400 text-xs">배포 중</p>
          <h1 className="text-white font-bold">{distributorName}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* 지도 토글 버튼 */}
          <button
            onClick={() => setShowMap((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              showMap
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <MapPin size={13} />
            지도
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}
            />
            <span className="text-slate-300 text-sm">
              {isActive ? "추적 중" : "일시정지"}
            </span>
          </div>
        </div>
      </header>

      {/* 지도 패널 */}
      {showMap && (
        <div className="relative">
          <KakaoMap
            center={mapCenter}
            markers={mapMarkers}
            className="w-full h-52"
            zoom={16}
          />
          {/* GPS 상태 오버레이 */}
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Navigation
              size={12}
              className={position ? "text-green-400" : "text-slate-400"}
            />
            {position ? (
              <span className="text-white text-xs">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                <span className="text-slate-400 ml-1">±{Math.round(position.accuracy)}m</span>
              </span>
            ) : (
              <span className="text-slate-400 text-xs">위치 확인 중...</span>
            )}
          </div>
        </div>
      )}

      {/* 카운터 — 스테퍼 */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {/* 신문부수 (배포 완료) */}
        <div className="bg-slate-800 rounded-2xl px-3 py-5 flex flex-col items-center gap-3">
          <p className="text-slate-400 text-xs">신문부수</p>
          <div className="flex items-center justify-between w-full gap-2">
            <button
              onClick={() => addEvent(1, "undo")}
              disabled={!isActive || delivered === 0}
              className="flex-shrink-0 w-16 h-16 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-30 text-white text-4xl font-bold rounded-2xl transition-colors flex items-center justify-center"
            >
              −
            </button>
            <p className="text-white text-6xl font-bold tabular-nums leading-none">{delivered}</p>
            <button
              onClick={() => handleDelivery(1)}
              disabled={!isActive}
              className="flex-shrink-0 w-16 h-16 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-30 text-white text-4xl font-bold rounded-2xl transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>
          <p className="text-slate-500 text-xs">부</p>
        </div>

        {/* 잔류부수 */}
        <div className="bg-slate-800 rounded-2xl px-3 py-5 flex flex-col items-center gap-3">
          <p className="text-slate-400 text-xs">잔류부수</p>
          <div className="flex items-center justify-between w-full gap-2">
            <button
              onClick={() => setRemaining((r) => Math.max(0, r - 1))}
              disabled={!isActive || remaining === 0}
              className="flex-shrink-0 w-16 h-16 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-30 text-white text-4xl font-bold rounded-2xl transition-colors flex items-center justify-center"
            >
              −
            </button>
            <p className="text-blue-400 text-6xl font-bold tabular-nums leading-none">{remaining}</p>
            <button
              onClick={() => setRemaining((r) => r + 1)}
              disabled={!isActive}
              className="flex-shrink-0 w-16 h-16 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-30 text-white text-4xl font-bold rounded-2xl transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>
          <p className="text-slate-500 text-xs">부</p>
        </div>
      </div>

      <div className="px-4 flex-1 flex flex-col gap-4">
        {/* 되돌리기 */}
        <button
          onClick={handleUndo}
          disabled={!isActive || lastEventType === "undo" || delivered === 0}
          className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 font-medium py-4 rounded-xl text-sm transition-colors"
        >
          되돌리기 (-1){lastEventType === "undo" ? " — 연속 2회 불가" : ""}
        </button>

        {/* 일시정지 / 재개 */}
        <button
          onClick={handlePauseResume}
          className={`w-full font-medium py-4 rounded-xl text-sm transition-colors ${
            isActive
              ? "bg-yellow-600 hover:bg-yellow-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isActive ? "일시정지" : "배포 재개"}
        </button>

        {/* 배포 완료 */}
        <button
          onClick={handleComplete}
          disabled={loading}
          className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-semibold py-5 rounded-2xl text-lg transition-colors mt-2"
        >
          {loading ? "처리 중..." : "배포 완료"}
        </button>
      </div>

      <div className="h-8" />
    </main>
  );
}
