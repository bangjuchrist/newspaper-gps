"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type RouteRecord = {
  id: string;
  status: string;
  date: string;
  last_lat: number | null;
  last_lng: number | null;
  distributors: { name: string; phone: string } | null;
  teams: { name: string; region: string } | null;
};

interface AdminDashboardClientProps {
  routes: RouteRecord[];
  countByRoute: Record<string, number>;
}

export default function AdminDashboardClient({
  routes: initialRoutes,
  countByRoute: initialCount,
}: AdminDashboardClientProps) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [countByRoute, setCountByRoute] = useState(initialCount);
  const supabase = createClient();

  // Realtime: distribution_events INSERT 감지 → 카운터 갱신
  const refreshCount = useCallback(
    async (routeId: string) => {
      const { data } = await supabase
        .from("distribution_events")
        .select("type, count")
        .eq("route_id", routeId);

      if (!data) return;
      const total = data.reduce((sum, e) => {
        if (e.type === "delivered") return sum + e.count;
        if (e.type === "undo") return sum - e.count;
        return sum;
      }, 0);

      setCountByRoute((prev) => ({ ...prev, [routeId]: total }));
    },
    [supabase]
  );

  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "distribution_events" },
        (payload) => {
          refreshCount(payload.new.route_id as string);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "routes" },
        (payload) => {
          setRoutes((prev) =>
            prev.map((r) =>
              r.id === payload.new.id ? { ...r, ...payload.new as RouteRecord } : r
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshCount]);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: "대기",
      active: "배포 중",
      paused: "일시정지",
      done: "완료",
    };
    return map[status] ?? status;
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      active: "text-green-400",
      paused: "text-yellow-400",
      done: "text-slate-400",
      pending: "text-slate-500",
    };
    return map[status] ?? "text-slate-400";
  };

  const totalDelivered = Object.values(countByRoute).reduce((a, b) => a + b, 0);
  const activeCount = routes.filter((r) => r.status === "active").length;

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      <header className="mb-6">
        <h1 className="text-white font-bold text-xl">관리자 대시보드</h1>
        <p className="text-slate-400 text-sm">
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </header>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">배포 중</p>
          <p className="text-green-400 text-3xl font-bold">{activeCount}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">총 팀</p>
          <p className="text-white text-3xl font-bold">{routes.length}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">총 배포</p>
          <p className="text-blue-400 text-3xl font-bold">{totalDelivered}</p>
        </div>
      </div>

      {/* 배포자별 현황 */}
      <div className="space-y-3">
        {routes.map((route) => (
          <div key={route.id} className="bg-slate-800 rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${statusColor(route.status)}`}>
                    {statusLabel(route.status)}
                  </span>
                  {route.status === "active" && (
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-white font-semibold">
                  {route.distributors?.name}
                </p>
                <p className="text-slate-400 text-xs">
                  {route.teams?.region} · {route.teams?.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white text-2xl font-bold">
                  {countByRoute[route.id] ?? 0}
                </p>
                <p className="text-slate-500 text-xs">부 배포</p>
              </div>
            </div>
            {route.last_lat && (
              <p className="text-slate-500 text-xs mt-2">
                최근 위치: {route.last_lat.toFixed(4)}, {route.last_lng?.toFixed(4)}
              </p>
            )}
          </div>
        ))}

        {routes.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            오늘 배포 시작한 팀이 없습니다
          </div>
        )}
      </div>
    </main>
  );
}
