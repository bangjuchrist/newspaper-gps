import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const teamId = searchParams.get("team_id");

  const { data } = await supabase
    .from("reports")
    .select("id, date, total_delivered, total_remaining, note, created_at, distributor_id, distributors(name, phone, team_id, teams(name, region))")
    .eq("date", date)
    .order("created_at", { ascending: false });

  type ReportRow = {
    id: string; date: string; total_delivered: number; total_remaining: number;
    note: string | null; created_at: string; distributor_id: string;
    distributors: {
      name: string; phone: string; team_id: string;
      teams: { name: string; region: string } | null;
    } | null;
  };

  let rows = (data ?? []) as unknown as ReportRow[];
  if (teamId) rows = rows.filter((r) => r.distributors?.team_id === teamId);

  const header = "날짜,배포자,전화번호,팀,권역,배포수,잔여수,비고,제출시각";
  const lines = rows.map((r) => [
    r.date,
    r.distributors?.name ?? "",
    r.distributors?.phone ?? "",
    r.distributors?.teams?.name ?? "",
    r.distributors?.teams?.region ?? "",
    r.total_delivered,
    r.total_remaining,
    r.note ?? "",
    new Date(r.created_at).toLocaleTimeString("ko-KR"),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

  const csv = "﻿" + [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reports-${date}.csv"`,
    },
  });
}
