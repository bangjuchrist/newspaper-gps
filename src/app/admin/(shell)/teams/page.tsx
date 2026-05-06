import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeamsClient from "./teams-client";

export default async function AdminTeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/admin/login");

  const [{ data: teams }, { data: distributorsRaw }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, region, manager_id")
      .order("region", { ascending: true }),
    supabase
      .from("distributors")
      .select("id, name, phone, auth_user_id, team_id")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <TeamsClient
      teams={teams ?? []}
      distributors={distributorsRaw ?? []}
    />
  );
}
