import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDashboardClient from "./dashboard-client";
import type { RouteRecord } from "./dashboard-client";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "admin") redirect("/");

  const today = new Date().toISOString().split("T")[0];

  const { data: routesRaw } = await supabase
    .from("routes")
    .select(`
      id, status, date, last_lat, last_lng,
      distributors(name, phone),
      teams(name, region)
    `)
    .eq("date", today)
    .order("created_at", { ascending: true });

  const routes = (routesRaw ?? []) as unknown as RouteRecord[];
  const routeIds = routes.map((r) => r.id);

  const { data: events } = routeIds.length
    ? await supabase
        .from("distribution_events")
        .select("route_id, type, count")
        .in("route_id", routeIds)
    : { data: [] };

  const countByRoute = (events ?? []).reduce<Record<string, number>>(
    (acc, e) => {
      if (e.type === "delivered") acc[e.route_id] = (acc[e.route_id] ?? 0) + e.count;
      if (e.type === "undo") acc[e.route_id] = (acc[e.route_id] ?? 0) - e.count;
      return acc;
    },
    {}
  );

  return (
    <AdminDashboardClient
      routes={routes}
      countByRoute={countByRoute}
    />
  );
}
