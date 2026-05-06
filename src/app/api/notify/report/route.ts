import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendReportNotification } from "@/lib/solapi";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    routeId: string;
    distributorName: string;
    teamName: string;
    region: string;
    delivered: number;
    remaining: number;
    date: string;
    notes?: string;
  };

  // 관리자 전화번호: distributors 테이블의 manager or 환경변수에서
  const adminPhone = process.env.SOLAPI_ADMIN_PHONE ?? process.env.SOLAPI_SENDER_PHONE!;

  const result = await sendReportNotification({
    to: adminPhone,
    ...body,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "전송 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
