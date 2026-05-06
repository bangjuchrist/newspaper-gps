"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function normalizeDisplay(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "오류가 발생했습니다");
      setLoading(false);
      return;
    }

    router.push(`/auth/verify?phone=${encodeURIComponent(json.phone)}`);
  }

  return (
    <main className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">신문 GPS</h1>
          <p className="text-slate-400 text-sm">배포 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">전화번호</label>
            <input
              type="tel"
              value={normalizeDisplay(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="010-1234-5678"
              className="w-full bg-[#161b27] border border-white/10 rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              inputMode="tel"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || phone.replace(/\D/g, "").length < 10}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 rounded-2xl text-lg transition-colors"
          >
            {loading ? "전송 중..." : "인증번호 받기"}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-10">
          등록된 배포자 전화번호로만 로그인 가능합니다
        </p>
      </div>
    </main>
  );
}
