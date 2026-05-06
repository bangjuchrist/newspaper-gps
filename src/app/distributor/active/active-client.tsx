"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { useWakeLock } from "@/hooks/useWakeLock";

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
  const router = useRouter();
  const supabase = createClient();

  const isActive = status === "active";

  useGpsTracking({ routeId, enabled: isActive });
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
    // 연속 2회 undo 방지
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

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      {/* 상단 상태 표시 */}
      <header className="px-4 py-4 flex items-center justify-between bg-slate-800">
        <div>
          <p className="text-slate-400 text-xs">배포 중</p>
          <h1 className="text-white font-bold">{distributorName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}
          />
          <span className="text-slate-300 text-sm">
            {isActive ? "추적 중" : "일시정지"}
          </span>
        </div>
      </header>

      {/* 카운터 */}
      <div className="px-4 py-6 grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-2xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">배포 완료</p>
          <p className="text-white text-4xl font-bold">{delivered}</p>
          <p className="text-slate-500 text-xs">부</p>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">잔여</p>
          <p className="text-blue-400 text-4xl font-bold">{remaining}</p>
          <p className="text-slate-500 text-xs">부</p>
        </div>
      </div>

      {/* 배포 건수 입력 버튼 */}
      <div className="px-4 flex-1 flex flex-col gap-4">
        <p className="text-slate-400 text-sm">배포 건수 추가</p>
        <div className="grid grid-cols-3 gap-3">
          {[1, 5, 10].map((count) => (
            <button
              key={count}
              onClick={() => handleDelivery(count)}
              disabled={!isActive}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-8 rounded-2xl text-3xl transition-colors"
            >
              +{count}
            </button>
          ))}
        </div>

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
