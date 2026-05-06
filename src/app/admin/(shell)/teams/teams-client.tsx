"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Crown, UserPlus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Team = { id: string; name: string; region: string; manager_id: string | null };
type Distributor = { id: string; name: string; phone: string; auth_user_id: string | null; team_id: string };

const emptyTeamForm = { name: "", region: "" };
const emptyDistForm = { name: "", phone: "", team_id: "" };

function normalizePhone(raw: string) {
  return raw.replace(/[^0-9]/g, "").replace(/^82/, "0");
}

export default function TeamsClient({
  teams: initialTeams,
  distributors: initialDist,
}: {
  teams: Team[];
  distributors: Distributor[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [distributors, setDistributors] = useState(initialDist);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // Team modal
  const [teamModal, setTeamModal] = useState<"add" | "edit" | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);

  // Distributor modal
  const [distModal, setDistModal] = useState<"add" | "edit" | null>(null);
  const [editingDist, setEditingDist] = useState<Distributor | null>(null);
  const [distForm, setDistForm] = useState(emptyDistForm);

  // Manager modal
  const [managerModal, setManagerModal] = useState<Team | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  // ─── Team CRUD ───────────────────────────────────────────────────────────────

  function openAddTeam() {
    setEditingTeam(null);
    setTeamForm(emptyTeamForm);
    setError("");
    setTeamModal("add");
  }

  function openEditTeam(t: Team) {
    setEditingTeam(t);
    setTeamForm({ name: t.name, region: t.region });
    setError("");
    setTeamModal("edit");
  }

  async function handleSaveTeam() {
    if (!teamForm.name.trim() || !teamForm.region.trim()) {
      setError("팀 이름과 권역을 입력해주세요");
      return;
    }
    setSaving(true);
    setError("");
    const payload = { name: teamForm.name.trim(), region: teamForm.region.trim() };

    if (editingTeam) {
      const { data, error: err } = await supabase
        .from("teams")
        .update(payload)
        .eq("id", editingTeam.id)
        .select("id, name, region, manager_id")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setTeams((prev) => prev.map((t) => (t.id === editingTeam.id ? data : t)));
    } else {
      const { data, error: err } = await supabase
        .from("teams")
        .insert(payload)
        .select("id, name, region, manager_id")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setTeams((prev) => [...prev, data]);
    }
    setSaving(false);
    setTeamModal(null);
    router.refresh();
  }

  async function handleDeleteTeam(id: string) {
    const cnt = distributors.filter((d) => d.team_id === id).length;
    if (cnt > 0) {
      alert(`소속 배포자 ${cnt}명이 있어 삭제할 수 없습니다.\n먼저 배포자를 다른 팀으로 이동하거나 삭제해주세요.`);
      return;
    }
    if (!confirm("팀을 삭제하시겠습니까?")) return;
    await supabase.from("teams").delete().eq("id", id);
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }

  // ─── Distributor CRUD ─────────────────────────────────────────────────────

  function openAddDist(teamId: string) {
    setEditingDist(null);
    setDistForm({ ...emptyDistForm, team_id: teamId });
    setError("");
    setDistModal("add");
  }

  function openEditDist(d: Distributor) {
    setEditingDist(d);
    setDistForm({ name: d.name, phone: d.phone, team_id: d.team_id });
    setError("");
    setDistModal("edit");
  }

  async function handleSaveDist() {
    if (!distForm.name.trim() || !distForm.phone.trim() || !distForm.team_id) {
      setError("이름, 전화번호, 팀을 모두 입력해주세요");
      return;
    }
    setSaving(true);
    setError("");
    const phone = normalizePhone(distForm.phone);
    const payload = { name: distForm.name.trim(), phone, team_id: distForm.team_id };

    if (editingDist) {
      const { data, error: err } = await supabase
        .from("distributors")
        .update(payload)
        .eq("id", editingDist.id)
        .select("id, name, phone, auth_user_id, team_id")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setDistributors((prev) => prev.map((d) => (d.id === editingDist.id ? data : d)));
    } else {
      const { data, error: err } = await supabase
        .from("distributors")
        .insert(payload)
        .select("id, name, phone, auth_user_id, team_id")
        .single();
      if (err) {
        setError(err.code === "23505" ? "이미 등록된 전화번호입니다" : err.message);
        setSaving(false);
        return;
      }
      setDistributors((prev) => [...prev, data]);
      // auto-expand the team
      setExpandedTeams((prev) => new Set([...prev, distForm.team_id]));
    }
    setSaving(false);
    setDistModal(null);
    router.refresh();
  }

  async function handleDeleteDist(d: Distributor) {
    if (!confirm(`${d.name}을(를) 삭제하시겠습니까?`)) return;
    // if this distributor is the manager, clear manager_id first
    const team = teams.find((t) => t.id === d.team_id);
    if (team?.manager_id === d.id) {
      await supabase.from("teams").update({ manager_id: null }).eq("id", d.team_id);
      setTeams((prev) => prev.map((t) => t.id === d.team_id ? { ...t, manager_id: null } : t));
    }
    await supabase.from("distributors").delete().eq("id", d.id);
    setDistributors((prev) => prev.filter((x) => x.id !== d.id));
  }

  // ─── Manager assignment ───────────────────────────────────────────────────

  function openManagerModal(t: Team) {
    setManagerModal(t);
    setSelectedManagerId(t.manager_id ?? "");
    setError("");
  }

  async function handleSaveManager() {
    if (!managerModal) return;
    setSaving(true);
    const managerId = selectedManagerId || null;
    const { error: err } = await supabase
      .from("teams")
      .update({ manager_id: managerId })
      .eq("id", managerModal.id);
    if (err) { setError(err.message); setSaving(false); return; }
    setTeams((prev) =>
      prev.map((t) => t.id === managerModal.id ? { ...t, manager_id: managerId } : t)
    );
    setSaving(false);
    setManagerModal(null);
  }

  // ─── Expand/collapse ──────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // group distributors by team
  const distByTeam = distributors.reduce<Record<string, Distributor[]>>((acc, d) => {
    (acc[d.team_id] ??= []).push(d);
    return acc;
  }, {});

  const unassigned = distributors.filter((d) => !teams.some((t) => t.id === d.team_id));

  return (
    <main className="min-h-screen bg-[#0f1117] p-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/admin")} className="text-slate-400 text-sm mb-1">← 대시보드</button>
          <h1 className="text-white font-bold text-xl">배포자·팀 관리</h1>
          <p className="text-slate-400 text-sm">{teams.length}개 팀 · {distributors.length}명</p>
        </div>
        <button onClick={openAddTeam} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm">
          + 팀 추가
        </button>
      </header>

      {/* 팀 목록 */}
      <div className="space-y-3">
        {teams.length === 0 && (
          <div className="text-center text-slate-500 py-12">등록된 팀이 없습니다</div>
        )}
        {teams.map((t) => {
          const members = distByTeam[t.id] ?? [];
          const manager = members.find((d) => d.id === t.manager_id);
          const expanded = expandedTeams.has(t.id);

          return (
            <div key={t.id} className="bg-[#161b27] rounded-2xl border border-white/5 overflow-hidden">
              {/* 팀 헤더 */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggleExpand(t.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{t.name[0]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{t.name}</p>
                      <span className="text-slate-500 text-xs">{t.region}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-slate-500 text-xs">{members.length}명</span>
                      {manager ? (
                        <span className="flex items-center gap-1 text-amber-400 text-xs">
                          <Crown size={10} />
                          {manager.name}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">관리자 없음</span>
                      )}
                    </div>
                  </div>
                  {expanded ? <ChevronUp size={14} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />}
                </button>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => openManagerModal(t)}
                    title="관리자 지정"
                    className="p-2 rounded-lg text-amber-400 hover:bg-amber-400/10 transition-colors"
                  >
                    <Crown size={14} />
                  </button>
                  <button
                    onClick={() => openAddDist(t.id)}
                    title="배포자 추가"
                    className="p-2 rounded-lg text-blue-400 hover:bg-blue-400/10 transition-colors"
                  >
                    <UserPlus size={14} />
                  </button>
                  <button onClick={() => openEditTeam(t)} className="p-2 rounded-lg text-slate-400 hover:bg-white/5 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDeleteTeam(t.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* 배포자 목록 (expanded) */}
              {expanded && (
                <div className="border-t border-white/5">
                  {members.length === 0 ? (
                    <div className="px-4 py-4 text-slate-600 text-sm text-center">배포자가 없습니다</div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {members.map((d) => (
                        <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                          <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{d.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-white text-sm font-medium">{d.name}</p>
                              {d.id === t.manager_id && (
                                <Crown size={10} className="text-amber-400 flex-shrink-0" />
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                d.auth_user_id ? "bg-green-900/50 text-green-400" : "bg-slate-700 text-slate-500"
                              }`}>
                                {d.auth_user_id ? "로그인가능" : "미연결"}
                              </span>
                            </div>
                            <p className="text-slate-500 text-xs">{d.phone}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => openEditDist(d)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleDeleteDist(d)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-4 py-2 border-t border-white/[0.04]">
                    <button
                      onClick={() => openAddDist(t.id)}
                      className="text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <UserPlus size={11} />
                      배포자 추가
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 미배정 배포자 */}
        {unassigned.length > 0 && (
          <div className="bg-[#161b27] rounded-2xl border border-amber-500/20 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2">
              <p className="text-amber-400 text-sm font-semibold flex-1">미배정 배포자 ({unassigned.length}명)</p>
            </div>
            <div className="border-t border-white/5 divide-y divide-white/[0.04]">
              {unassigned.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{d.name}</p>
                    <p className="text-slate-500 text-xs">{d.phone}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditDist(d)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDeleteDist(d)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 팀 추가/수정 모달 ── */}
      {teamModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-[#161b27] rounded-t-3xl w-full max-w-lg p-6 pb-10 border-t border-white/10">
            <h2 className="text-white font-bold text-lg mb-6">{teamModal === "edit" ? "팀 수정" : "팀 추가"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">팀 이름</label>
                <input
                  type="text"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="마산팀"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">권역</label>
                <input
                  type="text"
                  value={teamForm.region}
                  onChange={(e) => setTeamForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="창원시 마산합포구"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setTeamModal(null)} className="flex-1 bg-slate-700 text-slate-300 py-4 rounded-xl font-medium">취소</button>
              <button onClick={handleSaveTeam} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-xl font-semibold">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 배포자 추가/수정 모달 ── */}
      {distModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-[#161b27] rounded-t-3xl w-full max-w-lg p-6 pb-10 border-t border-white/10">
            <h2 className="text-white font-bold text-lg mb-6">{distModal === "edit" ? "배포자 수정" : "배포자 추가"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">이름</label>
                <input
                  type="text"
                  value={distForm.name}
                  onChange={(e) => setDistForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">전화번호</label>
                <input
                  type="tel"
                  value={distForm.phone}
                  onChange={(e) => setDistForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  inputMode="tel"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">팀</label>
                <select
                  value={distForm.team_id}
                  onChange={(e) => setDistForm((f) => ({ ...f, team_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">팀 선택</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.region} · {t.name}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDistModal(null)} className="flex-1 bg-slate-700 text-slate-300 py-4 rounded-xl font-medium">취소</button>
              <button onClick={handleSaveDist} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-xl font-semibold">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 관리자 지정 모달 ── */}
      {managerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-[#161b27] rounded-t-3xl w-full max-w-lg p-6 pb-10 border-t border-white/10">
            <h2 className="text-white font-bold text-lg mb-1">관리자 지정</h2>
            <p className="text-slate-400 text-sm mb-6">{managerModal.region} · {managerModal.name}</p>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedManagerId("")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  selectedManagerId === ""
                    ? "border-blue-500 bg-blue-500/10 text-white"
                    : "border-slate-700 text-slate-400 hover:bg-white/5"
                }`}
              >
                <span className="text-sm">관리자 없음</span>
              </button>
              {(distByTeam[managerModal.id] ?? []).map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedManagerId(d.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    selectedManagerId === d.id
                      ? "border-amber-400 bg-amber-400/10 text-white"
                      : "border-slate-700 text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <Crown size={14} className={selectedManagerId === d.id ? "text-amber-400" : "text-slate-600"} />
                  <span className="flex-1 text-left text-sm">{d.name}</span>
                  <span className="text-xs text-slate-500">{d.phone}</span>
                </button>
              ))}
              {(distByTeam[managerModal.id] ?? []).length === 0 && (
                <p className="text-slate-600 text-sm text-center py-4">이 팀에 배포자가 없습니다</p>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setManagerModal(null)} className="flex-1 bg-slate-700 text-slate-300 py-4 rounded-xl font-medium">취소</button>
              <button onClick={handleSaveManager} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-4 rounded-xl font-semibold">
                {saving ? "저장 중..." : "지정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
