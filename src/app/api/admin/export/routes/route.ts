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

  let query = supabase
    .from("routes")
    .select("id, date, status, started_at, ended_at, last_lat, last_lng, distributors(name, phone), teams(name, region)")
    .eq("date", date)
    .order("started_at", { ascending: false });

  if (teamId) query = query.eq("team_id", teamId);

  const { data } = await query;

  const rows = (data ?? []) as unknown as {
    id: string; date: string; status: string;
    started_at: string | null; ended_at: string | null;
    last_lat: number | null; last_lng: number | null;
    distributors: { name: string; phone: string } | null;
    teams: { name: string; region: string } | null;
  }[];

  const header = "날짜,배포자,전화번호,팀,권역,상태,시작시각,종료시각,마지막위도,마지막경도";
  const lines = rows.map((r) => [
    r.date,
    r.distributors?.name ?? "",
    r.distributors?.phone ?? "",
    r.teams?.name ?? "",
    r.teams?.region ?? "",
    r.status,
    r.started_at ? new Date(r.started_at).toLocaleTimeString("ko-KR") : "",
    r.ended_at ? new Date(r.ended_at).toLocaleTimeString("ko-KR") : "",
    r.last_lat ?? "",
    r.last_lng ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

  const csv = "﻿" + [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="routes-${date}.csv"`,
    },
  });
}
