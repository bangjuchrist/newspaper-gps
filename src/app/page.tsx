import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  if (user.user_metadata?.role === "admin") {
    redirect("/admin");
  }

  redirect("/distributor");
}
