import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompleteClient from "./complete-client";

interface PageProps {
  searchParams: Promise<{ route?: string }>;
}

export default async function CompletePage({ searchParams }: PageProps) {
  const { route: routeId } = await searchParams;
  if (!routeId) redirect("/distributor");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: events } = await supabase
    .from("distribution_events")
    .select("type, count")
    .eq("route_id", routeId);

  const totalDelivered = events
    ?.filter((e) => e.type === "delivered")
    .reduce((sum, e) => sum + e.count, 0) ?? 0;

  const totalUndo = events
    ?.filter((e) => e.type === "undo")
    .reduce((sum, e) => sum + e.count, 0) ?? 0;

  const initialRemaining = events
    ?.filter((e) => e.type === "remaining_initial")
    .reduce((sum, e) => sum + e.count, 0) ?? 0;

  const { data: distributorRaw } = await supabase
    .from("distributors")
    .select("id, name, teams(name, region)")
    .eq("auth_user_id", user.id)
    .single();

  const distributor = distributorRaw as unknown as {
    id: string;
    name: string;
    teams: { name: string; region: string } | null;
  } | null;

  return (
    <CompleteClient
      routeId={routeId}
      distributorId={distributor?.id ?? ""}
      distributorName={distributor?.name ?? ""}
      teamName={distributor?.teams?.name ?? ""}
      region={distributor?.teams?.region ?? ""}
      delivered={totalDelivered - totalUndo}
      remaining={initialRemaining - totalDelivered + totalUndo}
    />
  );
}
