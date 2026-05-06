"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Distributor = {
  id: string;
  name: string;
  phone: string;
  auth_user_id: string | null;
  team_id: string;
  teams: { name: string; region: string } | null;
};

type Team = { id: string; name: string; region: string };

interface Props {
  distributors: Distributor[];
  teams: Team[];
}

const emptyForm = { name: "", phone: "", team_id: "" };

export default function DistributorsClient({ distributors: initial, teams }: Props) {
  const [distributors, setDistributors] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, team_id: teams[0]?.id ?? "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(d: Distributor) {
    setEditing(d);
    setForm({ name: d.name, phone: d.phone, team_id: d.team_id });
    setError("");
    setShowForm(true);
  }

  function normalizePhone(raw: string) {
    return raw.replace(/[^0-9]/g, "").replace(/^82/, "0");
  }

  async function handleSave() {
    if (!form.name.trim() || !form.phone.trim() || !form.team_id) {
      setError("이름, 전화번호, 팀을 모두 입력해주세요");
      return;
    }
    setSaving(true);
    setError("");

    const phone = normalizePhone(form.phone);
    const payload = { name: form.name.trim(), phone, team_id: form.team_id };

    if (editing) {
      const { data, error: err } = await supabase
        .from("distributors")
        .update(payload)
        .eq("id", editing.id)
        .select("id, name, phone, auth_user_id, team_id, teams(name, region)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setDistributors((prev) =>
        prev.map((d) => (d.id === editing.id ? data as unknown as Distributor : d))
      );
    } else {
      const { data, error: err } = await supabase
        .from("distributors")
        .insert(payload)
        .select("id, name, phone, auth_user_id, team_id, teams(name, region)")
        .single();
      if (err) {
        setError(err.code === "23505" ? "이미 등록된 전화번호입니다" : err.message);
        setSaving(false);
        return;
      }
      setDistributors((prev) => [...prev, data as unknown as Distributor]);
    }

    setSaving(false);
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("배포자를 삭제하시겠습니까?")) return;
    await supabase.from("distributors").delete().eq("id", id);
    setDistributors((prev) => prev.filter((d) => d.id !== id));
  }

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/admin")}
            className="text-slate-400 text-sm mb-1 flex items-center gap-1"
          >
            ← 대시보드
          </button>
          <h1 className="text-white font-bold text-xl">배포자 관리</h1>
          <p className="text-slate-400 text-sm">{distributors.length}명 등록됨</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + 추가
        </button>
      </header>

      {/* 배포자 목록 */}
      <div className="space-y-3">
        {distributors.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            등록된 배포자가 없습니다
          </div>
        )}
        {distributors.map((d) => {
          const team = d.teams ?? teamMap[d.team_id];
          return (
            <div key={d.id} className="bg-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold">{d.name}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        d.auth_user_id
                          ? "bg-green-900 text-green-300"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {d.auth_user_id ? "로그인 가능" : "미연결"}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{d.phone}</p>
                  <p className="text-slate-500 text-xs">
                    {team ? `${team.region} · ${team.name}` : "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(d)}
                    className="text-slate-400 hover:text-white text-sm px-3 py-1 rounded-lg bg-slate-700"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg bg-slate-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 팀 없음 경고 */}
      {teams.length === 0 && (
        <div className="mt-6 bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
          <p className="text-yellow-300 text-sm">
            배포자를 추가하려면 먼저 팀을 등록해야 합니다.
          </p>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 pb-10">
            <h2 className="text-white font-bold text-lg mb-6">
              {editing ? "배포자 수정" : "배포자 추가"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-1">전화번호</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  inputMode="tel"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-1">팀</label>
                <select
                  value={form.team_id}
                  onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">팀 선택</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.region} · {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-700 text-slate-300 py-4 rounded-xl font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-xl font-semibold"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
