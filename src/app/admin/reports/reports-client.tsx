"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

type ReportRow = {
  id: string; date: string; total_delivered: number; total_remaining: number;
  note: string | null; photo_url: string | null; created_at: string;
  distributor_id: string;
  distributors: {
    name: string; phone: string; team_id: string;
    teams: { name: string; region: string } | null;
  } | null;
};
type Team = { id: string; name: string; region: string };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function ReportsClient({
  reports: initial,
  teams,
  defaultDate,
}: {
  reports: ReportRow[];
  teams: Team[];
  defaultDate: string;
}) {
  const [reports, setReports] = useState(initial);
  const [date, setDate] = useState(defaultDate);
  const [filterTeam, setFilterTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function fetchReports(d: string) {
    setLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("id, date, total_delivered, total_remaining, note, photo_url, created_at, distributor_id, distributors(name, phone, team_id, teams(name, region))")
      .eq("date", d)
      .order("created_at", { ascending: false });
    setReports((data ?? []) as unknown as ReportRow[]);
    setLoading(false);
  }

  function handleDateChange(d: string) {
    setDate(d);
    fetchReports(d);
  }

  const filtered = filterTeam
    ? reports.filter((r) => r.distributors?.team_id === filterTeam)
    : reports;

  const totalDelivered = filtered.reduce((s, r) => s + r.total_delivered, 0);
  const totalRemaining = filtered.reduce((s, r) => s + r.total_remaining, 0);

  async function downloadCsv() {
    const params = new URLSearchParams({ date });
    if (filterTeam) params.set("team_id", filterTeam);
    const res = await fetch(`/api/admin/export/reports?${params}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <button onClick={() => router.push("/admin")} className="text-slate-400 text-sm mb-1">← 대시보드</button>
          <h1 className="text-white font-bold text-xl">완료 보고서</h1>
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
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none col-span-2">
          <option value="">전체 팀</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.region} · {t.name}</option>)}
        </select>
      </div>

      {/* 요약 */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs mb-1">총 배포</p>
            <p className="text-green-400 text-2xl font-bold">{totalDelivered}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs mb-1">총 잔여</p>
            <p className="text-yellow-400 text-2xl font-bold">{totalRemaining}</p>
          </div>
        </div>
      )}

      {loading && <p className="text-center text-slate-500 py-8">불러오는 중...</p>}

      {!loading && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 py-12">해당 날짜 완료 보고서가 없습니다</div>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="bg-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-semibold">{r.distributors?.name ?? "-"}</p>
                  <p className="text-slate-400 text-xs">
                    {r.distributors?.teams ? `${r.distributors.teams.region} · ${r.distributors.teams.name}` : "-"}
                  </p>
                  <p className="text-slate-500 text-xs">{fmtTime(r.created_at)} 제출</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{r.total_delivered}부 배포</p>
                  <p className="text-yellow-400 text-sm">{r.total_remaining}부 잔여</p>
                </div>
              </div>
              {r.note && <p className="text-slate-400 text-sm mt-2 bg-slate-700 rounded-xl px-3 py-2">{r.note}</p>}
              {r.photo_url && (
                <button
                  onClick={() => setExpandedPhoto(r.photo_url)}
                  className="mt-2 w-full"
                >
                  <Image
                    src={r.photo_url}
                    alt="완료 사진"
                    width={400}
                    height={200}
                    className="w-full h-32 object-cover rounded-xl"
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 사진 확대 모달 */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <Image
            src={expandedPhoto}
            alt="완료 사진"
            width={800}
            height={600}
            className="max-w-full max-h-full object-contain rounded-2xl"
          />
        </div>
      )}
    </main>
  );
}
