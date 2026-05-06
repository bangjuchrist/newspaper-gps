import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeamsClient from "./teams-client";

export default async function AdminTeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/admin/login");

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, region, manager_id")
    .order("region", { ascending: true });

  // 팀별 배포자 수 집계
  const { data: counts } = await supabase
    .from("distributors")
    .select("team_id");

  const countByTeam = (counts ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.team_id] = (acc[d.team_id] ?? 0) + 1;
    return acc;
  }, {});

  return <TeamsClient teams={teams ?? []} countByTeam={countByTeam} />;
}
