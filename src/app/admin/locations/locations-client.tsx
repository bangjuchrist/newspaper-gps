"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";

const KakaoMap = dynamic(() => import("@/components/map/KakaoMap"), { ssr: false });

type Location = {
  id: string; name: string; lat: number; lng: number;
  address: string | null; active: boolean; team_id: string;
  teams: { name: string; region: string } | null;
};
type Team = { id: string; name: string; region: string };

const emptyForm = { name: "", address: "", team_id: "", lat: 0, lng: 0 };

export default function LocationsClient({
  locations: initial,
  teams,
}: {
  locations: Location[];
  teams: Team[];
}) {
  const [locations, setLocations] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [filterTeam, setFilterTeam] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const filtered = filterTeam
    ? locations.filter((l) => l.team_id === filterTeam)
    : locations;

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, team_id: teams[0]?.id ?? "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(l: Location) {
    setEditing(l);
    setForm({ name: l.name, address: l.address ?? "", team_id: l.team_id, lat: l.lat, lng: l.lng });
    setError("");
    setShowForm(true);
  }

  function handleMapClick(lat: number, lng: number) {
    setForm((f) => ({ ...f, lat, lng }));
    setShowMap(false);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.team_id || !form.lat || !form.lng) {
      setError("이름, 팀, 위치(지도 클릭)를 모두 입력해주세요");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      team_id: form.team_id,
      lat: form.lat,
      lng: form.lng,
    };

    if (editing) {
      const { data, error: err } = await supabase
        .from("locations")
        .update(payload)
        .eq("id", editing.id)
        .select("id, name, lat, lng, address, active, team_id, teams(name, region)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setLocations((prev) => prev.map((l) => (l.id === editing.id ? data as unknown as Location : l)));
    } else {
      const { data, error: err } = await supabase
        .from("locations")
        .insert(payload)
        .select("id, name, lat, lng, address, active, team_id, teams(name, region)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setLocations((prev) => [...prev, data as unknown as Location]);
    }

    setSaving(false);
    setShowForm(false);
    router.refresh();
  }

  async function toggleActive(l: Location) {
    await supabase.from("locations").update({ active: !l.active }).eq("id", l.id);
    setLocations((prev) => prev.map((loc) => loc.id === l.id ? { ...loc, active: !loc.active } : loc));
  }

  async function handleDelete(id: string) {
    if (!confirm("배포처를 삭제하시겠습니까?")) return;
    await supabase.from("locations").delete().eq("id", id);
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  const mapMarkers = filtered.map((l) => ({ lat: l.lat, lng: l.lng, label: l.name }));
  const mapCenter = filtered[0] ? { lat: filtered[0].lat, lng: filtered[0].lng } : { lat: 37.5665, lng: 126.9780 };

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <button onClick={() => router.push("/admin")} className="text-slate-400 text-sm mb-1">← 대시보드</button>
          <h1 className="text-white font-bold text-xl">배포처 관리</h1>
          <p className="text-slate-400 text-sm">{locations.length}곳 등록됨</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm">
          + 추가
        </button>
      </header>

      {/* 필터 + 뷰 전환 */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none"
        >
          <option value="">전체 팀</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.region} · {t.name}</option>)}
        </select>
        <div className="flex bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === v ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {v === "list" ? "목록" : "지도"}
            </button>
          ))}
        </div>
      </div>

      {/* 지도 뷰 */}
      {viewMode === "map" && (
        <div className="mb-4 rounded-2xl overflow-hidden">
          <KakaoMap
            center={mapCenter}
            markers={mapMarkers}
            className="w-full h-96"
            zoom={13}
          />
        </div>
      )}

      {/* 목록 */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {filtered.length === 0 && <div className="text-center text-slate-500 py-12">등록된 배포처가 없습니다</div>}
          {filtered.map((l) => (
            <div key={l.id} className={`bg-slate-800 rounded-2xl p-4 ${!l.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold">{l.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.active ? "bg-green-900 text-green-300" : "bg-slate-700 text-slate-400"}`}>
                      {l.active ? "활성" : "비활성"}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">{l.address ?? `${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}`}</p>
                  <p className="text-slate-500 text-xs">{l.teams ? `${l.teams.region} · ${l.teams.name}` : "-"}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(l)} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-slate-700">
                    {l.active ? "중단" : "재개"}
                  </button>
                  <button onClick={() => openEdit(l)} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-slate-700">수정</button>
                  <button onClick={() => handleDelete(l.id)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded-lg bg-slate-700">삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 pb-10 max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-6">{editing ? "배포처 수정" : "배포처 추가"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">이름</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="강남역 2번 출구 거치대"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">주소 (선택)</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="서울시 강남구 강남대로 396"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">팀</label>
                <select value={form.team_id} onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500">
                  <option value="">팀 선택</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.region} · {t.name}</option>)}
                </select>
              </div>

              {/* 위치 */}
              <div>
                <label className="block text-slate-300 text-sm mb-2">위치</label>
                {form.lat && form.lng ? (
                  <div className="space-y-2">
                    <p className="text-green-400 text-sm">📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>
                    <button onClick={() => setShowMap(true)}
                      className="text-blue-400 text-sm underline">위치 변경</button>
                  </div>
                ) : (
                  <button onClick={() => setShowMap(true)}
                    className="w-full bg-slate-700 border border-dashed border-slate-500 rounded-xl py-4 text-slate-400 text-sm hover:border-blue-500 hover:text-blue-400">
                    🗺️ 지도에서 위치 클릭
                  </button>
                )}
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-700 text-slate-300 py-4 rounded-xl font-medium">취소</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-xl font-semibold">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 위치 선택 지도 모달 */}
      {showMap && (
        <div className="fixed inset-0 bg-black/80 flex flex-col z-[60]">
          <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
            <p className="text-white font-semibold">위치를 클릭해 선택하세요</p>
            <button onClick={() => setShowMap(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex-1">
            <KakaoMap
              center={form.lat ? { lat: form.lat, lng: form.lng } : { lat: 37.5665, lng: 126.9780 }}
              markers={form.lat ? [{ lat: form.lat, lng: form.lng, label: "선택 위치" }] : []}
              className="w-full h-full"
              zoom={14}
              onMapClick={handleMapClick}
            />
          </div>
        </div>
      )}
    </main>
  );
}
