"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  Users,
  Package,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
} from "lucide-react";

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
  totalLocations: number;
  totalDistributors: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active:  { label: "배포 중",   color: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20", dot: "bg-emerald-400 animate-pulse" },
  paused:  { label: "일시정지", color: "text-amber-400 bg-amber-400/10 ring-amber-400/20",    dot: "bg-amber-400" },
  done:    { label: "완료",     color: "text-slate-400 bg-slate-400/10 ring-slate-400/20",    dot: "bg-slate-400" },
  pending: { label: "대기",     color: "text-slate-500 bg-slate-500/10 ring-slate-500/20",    dot: "bg-slate-600" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; accent: string;
}) {
  return (
    <div className="bg-[#161b27] rounded-2xl p-5 flex items-start justify-between border border-white/5 hover:border-white/10 transition-colors">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
        <p className={`text-3xl font-bold ${accent}`}>{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent.replace("text-", "bg-").replace("-400", "-400/15")}`}>
        <Icon size={18} className={accent} />
      </div>
    </div>
  );
}

export default function AdminDashboardClient({
  routes: initialRoutes,
  countByRoute: initialCount,
  totalLocations,
  totalDistributors,
}: AdminDashboardClientProps) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [countByRoute, setCountByRoute] = useState(initialCount);
  const supabase = createClient();

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "distribution_events" },
        (payload) => refreshCount(payload.new.route_id as string))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "routes" },
        (payload) => setRoutes((prev) =>
          prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new as RouteRecord } : r)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, refreshCount]);

  const totalDelivered = Object.values(countByRoute).reduce((a, b) => a + b, 0);
  const activeCount = routes.filter((r) => r.status === "active").length;
  const doneCount = routes.filter((r) => r.status === "done").length;

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  return (
    <div className="p-5 lg:p-7 pb-24 lg:pb-7">
      {/* 페이지 헤더 */}
      <div className="mb-7">
        <h1 className="text-white font-bold text-2xl mb-1">대시보드</h1>
        <p className="text-slate-500 text-sm flex items-center gap-1.5">
          <Clock size={13} />
          {today}
        </p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard icon={Activity}  label="배포 중"     value={activeCount}       sub="실시간"            accent="text-emerald-400" />
        <StatCard icon={Package}   label="오늘 총 배포" value={totalDelivered}    sub="부"               accent="text-blue-400" />
        <StatCard icon={CheckCircle2} label="완료"     value={doneCount}         sub={`/ ${routes.length}팀`} accent="text-violet-400" />
        <StatCard icon={TrendingUp} label="배포처"     value={totalLocations}    sub="등록됨"            accent="text-amber-400" />
      </div>

      {/* 배포자 현황 테이블 */}
      <div className="bg-[#161b27] rounded-2xl border border-white/5 overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-slate-400" />
            <h2 className="text-white font-semibold text-sm">오늘 배포 현황</h2>
          </div>
          <span className="text-slate-500 text-xs">{routes.length}명</span>
        </div>

        {routes.length === 0 && (
          <div className="text-center text-slate-600 py-16 text-sm">
            오늘 배포 시작한 팀이 없습니다
          </div>
        )}

        {routes.length > 0 && (
          <div className="divide-y divide-white/5">
            {routes.map((route) => {
              const count = countByRoute[route.id] ?? 0;
              return (
                <div key={route.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  {/* 아바타 */}
                  <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {(route.distributors?.name ?? "?")[0]}
                    </span>
                  </div>

                  {/* 이름·팀 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm leading-none mb-1 truncate">
                      {route.distributors?.name ?? "-"}
                    </p>
                    <p className="text-slate-500 text-xs truncate">
                      {route.teams?.region} · {route.teams?.name}
                    </p>
                  </div>

                  {/* GPS 위치 */}
                  {route.last_lat && (
                    <div className="hidden sm:flex items-center gap-1 text-slate-600 text-xs">
                      <MapPin size={11} />
                      <span>{route.last_lat.toFixed(3)}, {route.last_lng?.toFixed(3)}</span>
                    </div>
                  )}

                  {/* 상태 뱃지 */}
                  <StatusBadge status={route.status} />

                  {/* 배포 수 */}
                  <div className="text-right flex-shrink-0 w-14">
                    <p className="text-white font-bold text-lg leading-none">{count}</p>
                    <p className="text-slate-600 text-xs">부</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 요약 바 */}
      {routes.length > 0 && (
        <div className="mt-4 bg-[#161b27] rounded-2xl border border-white/5 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-slate-500 text-xs">등록 배포자</p>
              <p className="text-white font-bold">{totalDistributors}</p>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="text-center">
              <p className="text-slate-500 text-xs">오늘 참여</p>
              <p className="text-white font-bold">{routes.length}</p>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="text-center">
              <p className="text-slate-500 text-xs">평균 배포</p>
              <p className="text-white font-bold">
                {routes.length > 0 ? Math.round(totalDelivered / routes.length) : 0}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-xs">총 배포</p>
            <p className="text-blue-400 font-bold text-xl">{totalDelivered}</p>
          </div>
        </div>
      )}
    </div>
  );
}
