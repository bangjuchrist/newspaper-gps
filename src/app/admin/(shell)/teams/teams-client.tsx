"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Team = { id: string; name: string; region: string; manager_id: string | null };

const emptyForm = { name: "", region: "", notify_phone: "" };

export default function TeamsClient({
  teams: initial,
  countByTeam,
}: {
  teams: Team[];
  countByTeam: Record<string, number>;
}) {
  const [teams, setTeams] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(t: Team) {
    setEditing(t);
    setForm({ name: t.name, region: t.region, notify_phone: "" });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.region.trim()) {
      setError("팀 이름과 권역을 입력해주세요");
      return;
    }
    setSaving(true);
    setError("");

    const payload = { name: form.name.trim(), region: form.region.trim() };

    if (editing) {
      const { data, error: err } = await supabase
        .from("teams")
        .update(payload)
        .eq("id", editing.id)
        .select("id, name, region, manager_id")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setTeams((prev) => prev.map((t) => (t.id === editing.id ? data : t)));
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
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const cnt = countByTeam[id] ?? 0;
    if (cnt > 0) {
      alert(`소속 배포자 ${cnt}명이 있어 삭제할 수 없습니다.\n먼저 배포자를 다른 팀으로 이동하거나 삭제해주세요.`);
      return;
    }
    if (!confirm("팀을 삭제하시겠습니까?")) return;
    await supabase.from("teams").delete().eq("id", id);
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      <header className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/admin")} className="text-slate-400 text-sm mb-1">← 대시보드</button>
          <h1 className="text-white font-bold text-xl">팀·권역 관리</h1>
          <p className="text-slate-400 text-sm">{teams.length}개 팀</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm">
          + 팀 추가
        </button>
      </header>

      <div className="space-y-3">
        {teams.length === 0 && (
          <div className="text-center text-slate-500 py-12">등록된 팀이 없습니다</div>
        )}
        {teams.map((t) => (
          <div key={t.id} className="bg-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">{t.name}</p>
                <p className="text-slate-400 text-sm">{t.region}</p>
                <p className="text-slate-500 text-xs mt-1">
                  배포자 {countByTeam[t.id] ?? 0}명
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-white text-sm px-3 py-1 rounded-lg bg-slate-700">수정</button>
                <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg bg-slate-700">삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 pb-10">
            <h2 className="text-white font-bold text-lg mb-6">{editing ? "팀 수정" : "팀 추가"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">팀 이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="강남팀"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">권역</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="서울 강남구"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
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
    </main>
  );
}
