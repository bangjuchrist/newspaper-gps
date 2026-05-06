import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoutesClient from "./routes-client";

export default async function AdminRoutesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/admin/login");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: routesRaw }, { data: teams }] = await Promise.all([
    supabase
      .from("routes")
      .select("id, date, status, started_at, ended_at, last_lat, last_lng, team_id, distributor_id, distributors(name, phone), teams(name, region)")
      .eq("date", today)
      .order("started_at", { ascending: false }),
    supabase.from("teams").select("id, name, region").order("region"),
  ]);

  type RouteRow = {
    id: string; date: string; status: string;
    started_at: string | null; ended_at: string | null;
    last_lat: number | null; last_lng: number | null;
    team_id: string; distributor_id: string;
    distributors: { name: string; phone: string } | null;
    teams: { name: string; region: string } | null;
  };

  return (
    <RoutesClient
      routes={(routesRaw ?? []) as unknown as RouteRow[]}
      teams={teams ?? []}
      defaultDate={today}
    />
  );
}
