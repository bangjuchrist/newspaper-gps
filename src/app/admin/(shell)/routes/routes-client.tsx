"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RouteRow = {
  id: string; date: string; status: string;
  started_at: string | null; ended_at: string | null;
  last_lat: number | null; last_lng: number | null;
  team_id: string; distributor_id: string;
  distributors: { name: string; phone: string } | null;
  teams: { name: string; region: string } | null;
};
type Team = { id: string; name: string; region: string };

const STATUS_LABEL: Record<string, string> = {
  pending: "대기", active: "배포 중", paused: "일시정지", done: "완료",
};
const STATUS_COLOR: Record<string, string> = {
  active: "text-green-400", paused: "text-yellow-400",
  done: "text-slate-400", pending: "text-slate-500",
};

function fmt(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function RoutesClient({
  routes: initial,
  teams,
  defaultDate,
}: {
  routes: RouteRow[];
  teams: Team[];
  defaultDate: string;
}) {
  const [routes, setRoutes] = useState(initial);
  const [date, setDate] = useState(defaultDate);
  const [filterTeam, setFilterTeam] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function fetchRoutes(d: string) {
    setLoading(true);
    const { data } = await supabase
      .from("routes")
      .select("id, date, status, started_at, ended_at, last_lat, last_lng, team_id, distributor_id, distributors(name, phone), teams(name, region)")
      .eq("date", d)
      .order("started_at", { ascending: false });
    setRoutes((data ?? []) as unknown as RouteRow[]);
    setLoading(false);
  }

  function handleDateChange(d: string) {
    setDate(d);
    fetchRoutes(d);
  }

  const filtered = routes.filter((r) => {
    if (filterTeam && r.team_id !== filterTeam) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  async function downloadCsv() {
    const params = new URLSearchParams({ date });
    if (filterTeam) params.set("team_id", filterTeam);
    const res = await fetch(`/api/admin/export/routes?${params}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `routes-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <button onClick={() => router.push("/admin")} className="text-slate-400 text-sm mb-1">← 대시보드</button>
          <h1 className="text-white font-bold text-xl">배포 이력</h1>
          <p className="text-slate-400 text-sm">{filtered.length}건</p>
        </div>
        <button onClick={downloadCsv} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium px-3 py-2 rounded-xl">
          CSV 내보내기
        </button>
      </header>

      {/* 필터 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none col-span-2"
        />
        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
          <option value="">전체 팀</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.region} · {t.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading && <p className="text-center text-slate-500 py-8">불러오는 중...</p>}

      {!loading && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 py-12">해당 날짜 배포 기록이 없습니다</div>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="bg-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === "active" && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
                  </div>
                  <p className="text-white font-semibold">{r.distributors?.name ?? "-"}</p>
                  <p className="text-slate-400 text-xs">{r.teams ? `${r.teams.region} · ${r.teams.name}` : "-"}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>시작 {fmt(r.started_at)}</p>
                  <p>종료 {fmt(r.ended_at)}</p>
                </div>
              </div>
              {r.last_lat && (
                <p className="text-slate-500 text-xs">
                  최근 GPS: {r.last_lat.toFixed(5)}, {r.last_lng?.toFixed(5)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
