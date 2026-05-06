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

  // 배포 이벤트 집계
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

  const remaining = events
    ?.filter((e) => e.type === "remaining_initial")
    .reduce((sum, e) => sum + e.count, 0) ?? 0;

  const { data: distributor } = await supabase
    .from("distributors")
    .select("id, name")
    .eq("auth_user_id", user.id)
    .single();

  return (
    <CompleteClient
      routeId={routeId}
      distributorId={distributor?.id ?? ""}
      distributorName={distributor?.name ?? ""}
      delivered={totalDelivered - totalUndo}
      remaining={remaining - totalDelivered + totalUndo}
    />
  );
}
