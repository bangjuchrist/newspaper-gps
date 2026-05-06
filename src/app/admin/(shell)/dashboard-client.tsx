"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  Users,
  Package,
  CheckCircle2,
  MapPin,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import WeatherWidget from "@/components/admin/WeatherWidget";

const KakaoMap = dynamic(() => import("@/components/map/KakaoMap"), { ssr: false });

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

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; mapColor: string }> = {
  active:  { label: "배포 중",   color: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20", dot: "bg-emerald-400 animate-pulse", mapColor: "#34d399" },
  paused:  { label: "일시정지", color: "text-amber-400 bg-amber-400/10 ring-amber-400/20",    dot: "bg-amber-400",                  mapColor: "#fbbf24" },
  done:    { label: "완료",     color: "text-slate-400 bg-slate-400/10 ring-slate-400/20",    dot: "bg-slate-400",                  mapColor: "#64748b" },
  pending: { label: "대기",     color: "text-slate-500 bg-slate-500/10 ring-slate-500/20",    dot: "bg-slate-600",                  mapColor: "#475569" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
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
  const [showPanel, setShowPanel] = useState(true);
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

  // 맵 마커 (GPS 좌표 있는 배포자만)
  const markers = routes
    .filter((r) => r.last_lat && r.last_lng)
    .map((r) => ({
      lat: r.last_lat!,
      lng: r.last_lng!,
      label: r.distributors?.name ?? "",
      color: STATUS_CONFIG[r.status]?.mapColor ?? "#3b82f6",
    }));

  const mapCenter = markers.length > 0
    ? { lat: markers[0].lat, lng: markers[0].lng }
    : { lat: 35.2279, lng: 128.6811 }; // 창원시

  return (
    <div className="relative" style={{ height: "100vh" }}>
      {/* 풀스크린 카카오맵 */}
      <KakaoMap
        center={mapCenter}
        markers={markers}
        className="absolute inset-0 w-full h-full"
        zoom={12}
      />

      {/* 우상단 KPI 오버레이 */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <div className="bg-[#161b27]/90 backdrop-blur-sm rounded-2xl border border-white/10 px-4 py-3 flex gap-4">
          <KpiChip icon={Activity}  value={activeCount}    label="배포 중"  color="text-emerald-400" />
          <KpiChip icon={Package}   value={totalDelivered} label="총 배포"  color="text-blue-400" />
          <KpiChip icon={CheckCircle2} value={doneCount}   label="완료"     color="text-violet-400" />
          <KpiChip icon={TrendingUp} value={totalLocations} label="배포처"  color="text-amber-400" />
        </div>
      </div>

      {/* 하단 슬라이드 패널 */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 transition-transform duration-300 ${showPanel ? "translate-y-0" : "translate-y-[calc(100%-44px)]"}`}>
        {/* 토글 핸들 */}
        <button
          onClick={() => setShowPanel((v) => !v)}
          className="mx-auto flex items-center gap-2 bg-[#161b27]/90 backdrop-blur-sm border border-white/10 border-b-0 rounded-t-2xl px-6 py-2.5 text-slate-400 text-xs font-medium hover:text-white transition-colors"
        >
          {showPanel ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          {showPanel ? "패널 닫기" : `오늘 배포 현황 · ${routes.length}명`}
        </button>

        <div className="bg-[#161b27]/95 backdrop-blur-sm border-t border-white/10 max-h-[55vh] overflow-y-auto">
          {/* 날씨 */}
          <div className="px-4 pt-4">
            <WeatherWidget compact />
          </div>

          {/* 배포자 목록 */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-slate-400" />
                <h2 className="text-white font-semibold text-sm">오늘 배포 현황</h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />배포중</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />정지</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" />완료</span>
              </div>
            </div>

            {routes.length === 0 ? (
              <p className="text-center text-slate-600 py-8 text-sm">오늘 배포 시작한 팀이 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {routes.map((route) => {
                  const count = countByRoute[route.id] ?? 0;
                  return (
                    <div key={route.id} className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl px-4 py-3 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{(route.distributors?.name ?? "?")[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm leading-none mb-1 truncate">{route.distributors?.name ?? "-"}</p>
                        <p className="text-slate-500 text-xs truncate">{route.teams?.region} · {route.teams?.name}</p>
                      </div>
                      {route.last_lat && (
                        <MapPin size={11} className="text-slate-600 flex-shrink-0" />
                      )}
                      <StatusBadge status={route.status} />
                      <div className="text-right flex-shrink-0 w-12">
                        <p className="text-white font-bold text-lg leading-none">{count}</p>
                        <p className="text-slate-600 text-xs">부</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 요약 */}
            {routes.length > 0 && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
                <span>등록 배포자 {totalDistributors}명 · 오늘 참여 {routes.length}명</span>
                <span className="text-blue-400 font-bold text-sm">총 {totalDelivered}부</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiChip({ icon: Icon, value, label, color }: { icon: React.ElementType; value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center gap-1.5 justify-center mb-0.5">
        <Icon size={12} className={color} />
        <p className="text-slate-400 text-xs">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
