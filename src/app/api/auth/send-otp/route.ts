import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { SolapiMessageService } from "solapi";

function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("82")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  return digits;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: NextRequest) {
  const { phone } = await request.json();
  if (!phone) return NextResponse.json({ error: "전화번호가 필요합니다" }, { status: 400 });

  const normalized = normalize(phone);
  const supabase = await createAdminClient();

  // 배포자 테이블에 등록된 번호인지 확인
  const { data: distributor } = await supabase
    .from("distributors")
    .select("id, name")
    .eq("phone", normalized)
    .maybeSingle();

  if (!distributor) {
    return NextResponse.json({ error: "등록되지 않은 전화번호입니다" }, { status: 404 });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5분

  // OTP 저장 (upsert)
  const { error: dbErr } = await supabase
    .from("otp_codes")
    .upsert({ phone: normalized, code, expires_at: expiresAt, attempts: 0 });

  if (dbErr) return NextResponse.json({ error: "OTP 생성 실패" }, { status: 500 });

  // SOLAPI로 SMS 발송
  const sms = new SolapiMessageService(
    process.env.SOLAPI_API_KEY!,
    process.env.SOLAPI_API_SECRET!
  );
  try {
    await sms.send({
      to: normalized,
      from: process.env.SOLAPI_SENDER_PHONE!,
      text: `[신문GPS] 인증번호: ${code}\n5분 이내에 입력해주세요.`,
    });
  } catch (err) {
    console.error("SMS 발송 실패:", err);
    return NextResponse.json({ error: "SMS 발송에 실패했습니다" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, phone: normalized });
}
