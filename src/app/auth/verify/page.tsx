"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function VerifyForm() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const supabase = createClient();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const token = otp.join("");
    if (token.length !== 6) return;

    setLoading(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (verifyError) {
      setError("인증번호가 올바르지 않습니다");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  useEffect(() => {
    if (otp.every((d) => d !== "")) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const displayPhone = phone.replace("+82", "0").replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">인증번호 입력</h1>
          <p className="text-slate-400 text-sm">
            {displayPhone}로 전송된 6자리를 입력하세요
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
              className="w-12 h-16 bg-slate-800 border border-slate-600 rounded-xl text-center text-2xl font-bold text-white focus:outline-none focus:border-blue-500"
            />
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        {loading && (
          <p className="text-slate-400 text-sm text-center">확인 중...</p>
        )}

        <button
          onClick={() => router.back()}
          className="w-full text-slate-400 text-sm py-3"
        >
          다시 전송
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
