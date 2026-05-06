"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface CompleteClientProps {
  routeId: string;
  distributorId: string;
  distributorName: string;
  teamName: string;
  region: string;
  delivered: number;
  remaining: number;
}

export default function CompleteClient({
  routeId,
  distributorId,
  distributorName,
  teamName,
  region,
  delivered,
  remaining,
}: CompleteClientProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "sent" | "failed">("idle");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmitReport() {
    setSubmitting(true);
    const today = new Date().toISOString().split("T")[0];

    const summary = [
      `배포 완료: ${delivered}부`,
      `잔여: ${remaining}부`,
      notes ? `특이사항: ${notes}` : null,
    ].filter(Boolean).join("\n");

    const { error } = await supabase.from("reports").insert({
      route_id: routeId,
      distributor_id: distributorId,
      date: today,
      summary_text: summary,
      issues: notes ? [{ type: "note", description: notes }] : [],
    });

    if (error) {
      setSubmitting(false);
      return;
    }

    // 알림톡 발송 (실패해도 보고서는 저장됨)
    try {
      const res = await fetch("/api/notify/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          distributorName,
          teamName,
          region,
          delivered,
          remaining,
          date: today,
          notes: notes || undefined,
        }),
      });
      setNotifyStatus(res.ok ? "sent" : "failed");
    } catch {
      setNotifyStatus("failed");
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-2xl font-bold text-white mb-2">보고 완료!</h1>
          <p className="text-slate-400 text-sm mb-2">
            {notifyStatus === "sent"
              ? "관리자에게 SMS 알림이 발송되었습니다"
              : notifyStatus === "failed"
              ? "보고서 저장 완료 (알림 발송 실패)"
              : "보고서가 저장되었습니다"}
          </p>
          <p className="text-slate-500 text-xs mb-8">
            {distributorName}님 수고하셨습니다 🎉
          </p>
          <button
            onClick={() => router.push("/distributor")}
            className="bg-blue-600 text-white font-semibold px-8 py-4 rounded-2xl text-lg"
          >
            홈으로
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">배포 완료 보고</h1>
      <p className="text-slate-400 text-sm mb-8">
        {distributorName}님 · {region} {teamName}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800 rounded-2xl p-5 text-center">
          <p className="text-slate-400 text-xs mb-1">배포 완료</p>
          <p className="text-white text-4xl font-bold">{delivered}</p>
          <p className="text-slate-500 text-xs">부</p>
        </div>
        <div className="bg-slate-800 rounded-2xl p-5 text-center">
          <p className="text-slate-400 text-xs mb-1">미배포 잔여</p>
          <p className="text-yellow-400 text-4xl font-bold">{remaining}</p>
          <p className="text-slate-500 text-xs">부</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-slate-300 text-sm mb-2">
          특이사항 (선택)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="파손된 거치대, 배포 불가 장소 등 메모..."
          rows={4}
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <button
        onClick={handleSubmitReport}
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-5 rounded-2xl text-lg"
      >
        {submitting ? "제출 중..." : "보고서 제출 및 알림 발송"}
      </button>
    </main>
  );
}
