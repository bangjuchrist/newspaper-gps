import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LocationsClient from "./locations-client";

export default async function AdminLocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/admin/login");

  const [{ data: locationsRaw }, { data: teams }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name, lat, lng, address, active, team_id, teams(name, region)")
      .order("created_at", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name, region")
      .order("name"),
  ]);

  type LocationRow = {
    id: string; name: string; lat: number; lng: number;
    address: string | null; active: boolean; team_id: string;
    teams: { name: string; region: string } | null;
  };

  return (
    <LocationsClient
      locations={(locationsRaw ?? []) as unknown as LocationRow[]}
      teams={teams ?? []}
    />
  );
}
