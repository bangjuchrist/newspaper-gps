export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DistributorHomeClient from "./home-client";
import type { Distributor } from "./home-client";

export default async function DistributorHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const today = new Date().toISOString().split("T")[0];
  const { data: existingRoute } = await supabase
    .from("routes")
    .select("id, status")
    .eq("date", today)
    .in("status", ["active", "paused"])
    .maybeSingle();

  if (existingRoute) {
    redirect(`/distributor/active?route=${existingRoute.id}`);
  }

  const { data: distributor } = await supabase
    .from("distributors")
    .select("id, name, team_id, teams(name, region)")
    .eq("auth_user_id", user.id)
    .single();

  return (
    <DistributorHomeClient
      distributor={distributor as unknown as Distributor | null}
    />
  );
}
