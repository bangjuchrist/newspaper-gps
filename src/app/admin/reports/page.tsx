import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportsClient from "./reports-client";

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/admin/login");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: reportsRaw }, { data: teams }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, date, total_delivered, total_remaining, note, photo_url, created_at, distributor_id, distributors(name, phone, team_id, teams(name, region))")
      .eq("date", today)
      .order("created_at", { ascending: false }),
    supabase.from("teams").select("id, name, region").order("region"),
  ]);

  type ReportRow = {
    id: string; date: string; total_delivered: number; total_remaining: number;
    note: string | null; photo_url: string | null; created_at: string;
    distributor_id: string;
    distributors: {
      name: string; phone: string; team_id: string;
      teams: { name: string; region: string } | null;
    } | null;
  };

  return (
    <ReportsClient
      reports={(reportsRaw ?? []) as unknown as ReportRow[]}
      teams={teams ?? []}
      defaultDate={today}
    />
  );
}
