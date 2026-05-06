import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { RouteStatus } from "@/types/database";
import ActiveDeliveryClient from "./active-client";

interface PageProps {
  searchParams: Promise<{ route?: string }>;
}

interface RouteRow {
  id: string;
  status: RouteStatus;
  team_id: string;
  distributor_id: string;
  distributors: { name: string } | null;
}

export default async function ActiveDeliveryPage({ searchParams }: PageProps) {
  const { route: routeId } = await searchParams;
  if (!routeId) redirect("/distributor");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: routeRaw } = await supabase
    .from("routes")
    .select("id, status, team_id, distributor_id, distributors(name)")
    .eq("id", routeId)
    .single();

  const route = routeRaw as unknown as RouteRow | null;
  if (!route) redirect("/distributor");

  const { data: events } = await supabase
    .from("distribution_events")
    .select("type, count")
    .eq("route_id", routeId);

  const delivered = events
    ?.filter((e) => e.type === "delivered")
    .reduce((sum, e) => sum + e.count, 0) ?? 0;

  const undone = events
    ?.filter((e) => e.type === "undo")
    .reduce((sum, e) => sum + Math.abs(e.count), 0) ?? 0;

  const distributorName = route.distributors?.name ?? "";

  return (
    <Suspense>
      <ActiveDeliveryClient
        routeId={routeId}
        distributorId={route.distributor_id}
        distributorName={distributorName}
        initialStatus={route.status === "paused" ? "paused" : "active"}
        initialDelivered={delivered - undone}
        initialRemaining={0}
        lastEvent={events?.[events.length - 1] ?? null}
      />
    </Suspense>
  );
}
