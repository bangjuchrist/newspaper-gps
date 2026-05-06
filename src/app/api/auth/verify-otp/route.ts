import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("82")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  return digits;
}

export async function POST(request: NextRequest) {
  const { phone, code } = await request.json();
  if (!phone || !code) return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  const normalized = normalize(phone);
  const supabase = await createAdminClient();

  // OTP 검증
  const { data: otp } = await supabase
    .from("otp_codes")
    .select("code, expires_at, attempts")
    .eq("phone", normalized)
    .maybeSingle();

  if (!otp) return NextResponse.json({ error: "인증번호를 먼저 요청해주세요" }, { status: 400 });
  if (new Date(otp.expires_at) < new Date()) {
    return NextResponse.json({ error: "인증번호가 만료되었습니다" }, { status: 400 });
  }
  if (otp.attempts >= 5) {
    return NextResponse.json({ error: "시도 횟수를 초과했습니다. 다시 요청해주세요" }, { status: 429 });
  }
  if (otp.code !== code) {
    await supabase.from("otp_codes").update({ attempts: otp.attempts + 1 }).eq("phone", normalized);
    return NextResponse.json({ error: "인증번호가 올바르지 않습니다" }, { status: 400 });
  }

  // OTP 삭제 (1회용)
  await supabase.from("otp_codes").delete().eq("phone", normalized);

  // 배포자 조회
  const { data: distributor } = await supabase
    .from("distributors")
    .select("id, auth_user_id")
    .eq("phone", normalized)
    .maybeSingle();

  if (!distributor) return NextResponse.json({ error: "등록된 배포자가 아닙니다" }, { status: 404 });

  const fakeEmail = `${normalized}@gps.local`;
  let authUserId = distributor.auth_user_id;

  if (!authUserId) {
    // 신규: Supabase 계정 생성
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { phone: normalized, role: "distributor" },
    });
    if (createErr) return NextResponse.json({ error: "계정 생성 실패" }, { status: 500 });

    authUserId = newUser.user.id;
    await supabase.from("distributors").update({ auth_user_id: authUserId }).eq("id", distributor.id);
  } else {
    // 기존 계정: email이 없거나 다르면 업데이트 (구 phone-auth 유저 대응)
    const { data: existing } = await supabase.auth.admin.getUserById(authUserId);
    if (existing?.user && existing.user.email !== fakeEmail) {
      await supabase.auth.admin.updateUserById(authUserId, {
        email: fakeEmail,
        email_confirm: true,
      });
    }
  }

  // magic link 토큰 발급 → 클라이언트에서 세션 교환
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: fakeEmail,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/distributor` },
  });

  if (linkErr || !linkData) return NextResponse.json({ error: "세션 생성 실패" }, { status: 500 });

  return NextResponse.json({ ok: true, token: linkData.properties.email_otp, email: fakeEmail });
}
