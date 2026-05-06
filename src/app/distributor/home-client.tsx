"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface Distributor {
  id: string;
  name: string;
  team_id: string;
  teams: { name: string; region: string } | null;
}

export default function DistributorHomeClient({
  distributor,
}: {
  distributor: Distributor | null;
}) {
  const [loading, setLoading] = useState(false);
  const [initialCount, setInitialCount] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleStartDelivery() {
    if (!distributor) return;
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];

    // route 생성 (UNIQUE(distributor_id, date) — upsert)
    const { data: route, error } = await supabase
      .from("routes")
      .upsert(
        {
          team_id: distributor.team_id,
          distributor_id: distributor.id,
          date: today,
          status: "active",
          started_at: new Date().toISOString(),
        },
        { onConflict: "distributor_id,date" }
      )
      .select("id")
      .single();

    if (error || !route) {
      console.error(error);
      setLoading(false);
      return;
    }

    // 초기 신문 수량 이벤트
    if (initialCount && parseInt(initialCount) > 0) {
      await supabase.from("distribution_events").insert({
        route_id: route.id,
        distributor_id: distributor.id,
        type: "remaining_initial",
        count: parseInt(initialCount),
      });
    }

    router.push(`/distributor/active?route=${route.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col px-4 pt-safe">
      {/* 헤더 */}
      <header className="py-6 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{distributor?.teams?.region}</p>
          <h1 className="text-white font-bold text-xl">{distributor?.name}님</h1>
        </div>
        <div className="text-slate-400 text-sm text-right">
          <p>{distributor?.teams?.name}</p>
          <p className="text-xs">{new Date().toLocaleDateString("ko-KR")}</p>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        {/* 오늘 배포 신문 수량 입력 */}
        <div className="bg-slate-800 rounded-2xl p-6">
          <label className="block text-slate-300 text-sm mb-3">
            오늘 배포할 신문 수량 (선택)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={initialCount}
              onChange={(e) => setInitialCount(e.target.value)}
              placeholder="0"
              min="0"
              className="flex-1 bg-slate-700 text-white text-3xl font-bold text-center py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-lg">부</span>
          </div>
        </div>

        {/* 배포 시작 버튼 */}
        <button
          onClick={handleStartDelivery}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold py-8 rounded-3xl text-2xl transition-colors shadow-lg shadow-blue-900/50"
        >
          {loading ? "준비 중..." : "배포 시작"}
        </button>
      </div>
    </main>
  );
}
