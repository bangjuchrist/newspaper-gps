"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function VerifyForm() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5분
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const supabase = createClient();

  useEffect(() => {
    inputRefs.current[0]?.focus();
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  function formatCountdown(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(code: string) {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");

    // 1. 서버에서 OTP 검증 + magic link 토큰 발급
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "인증 실패");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setLoading(false);
      return;
    }

    // 2. magic link 토큰으로 Supabase 세션 교환
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: json.email,
      token: json.token,
      type: "email",
    });

    if (verifyErr) {
      setError("세션 생성에 실패했습니다. 다시 시도해주세요");
      setLoading(false);
      return;
    }

    router.replace("/distributor");
  }

  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6) handleVerify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function handleResend() {
    setResending(true);
    setError("");
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "재전송 실패");
    else { setCountdown(300); setOtp(["", "", "", "", "", ""]); inputRefs.current[0]?.focus(); }
    setResending(false);
  }

  const displayPhone = phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");

  return (
    <main className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">인증번호 입력</h1>
          <p className="text-slate-400 text-sm">
            {displayPhone}로 전송된 6자리를 입력하세요
          </p>
          <p className="text-slate-600 text-xs mt-1">
            {countdown > 0 ? `남은 시간 ${formatCountdown(countdown)}` : "인증번호가 만료되었습니다"}
          </p>
        </div>

        <div className="flex gap-2 justify-center mb-6">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-16 bg-[#161b27] border border-white/10 rounded-2xl text-center text-2xl font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
        {loading && <p className="text-blue-400 text-sm text-center mb-4">확인 중...</p>}

        <button
          onClick={handleResend}
          disabled={resending || countdown > 240}
          className="w-full text-slate-500 hover:text-slate-300 disabled:text-slate-700 text-sm py-3 transition-colors"
        >
          {resending ? "전송 중..." : "인증번호 다시 받기"}
        </button>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
