import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DistributorsClient from "./distributors-client";

export default async function AdminDistributorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/admin/login");

  const [{ data: distributorsRaw }, { data: teams }] = await Promise.all([
    supabase
      .from("distributors")
      .select("id, name, phone, auth_user_id, team_id, teams(name, region)")
      .order("created_at", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name, region")
      .order("name", { ascending: true }),
  ]);

  type DistributorRow = {
    id: string;
    name: string;
    phone: string;
    auth_user_id: string | null;
    team_id: string;
    teams: { name: string; region: string } | null;
  };

  return (
    <DistributorsClient
      distributors={(distributorsRaw ?? []) as unknown as DistributorRow[]}
      teams={teams ?? []}
    />
  );
}
