"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("010") || digits.startsWith("011")) {
      return `+82${digits.slice(1)}`;
    }
    return `+82${digits}`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formattedPhone = formatPhone(phone);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    router.push(`/auth/verify?phone=${encodeURIComponent(formattedPhone)}`);
  }

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">신문 GPS</h1>
          <p className="text-slate-400 text-sm">배포 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              전화번호
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white text-lg placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoComplete="tel"
              inputMode="tel"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || phone.length < 10}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 rounded-xl text-lg transition-colors"
          >
            {loading ? "전송 중..." : "인증번호 받기"}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-8">
          등록된 배포자 전화번호로만 로그인 가능합니다
        </p>
      </div>
    </main>
  );
}
