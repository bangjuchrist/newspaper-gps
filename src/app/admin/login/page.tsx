"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다");
      setLoading(false);
      return;
    }

    if (data.user.user_metadata?.role !== "admin") {
      setError("관리자 계정이 아닙니다");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.replace("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🗺️</div>
          <h1 className="text-2xl font-bold text-white mb-1">관리자 로그인</h1>
          <p className="text-slate-400 text-sm">신문 GPS 배포 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 rounded-xl text-lg transition-colors"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700">
          <p className="text-center text-slate-500 text-xs">
            배포자는{" "}
            <a href="/auth" className="text-blue-400">
              전화번호로 로그인
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
