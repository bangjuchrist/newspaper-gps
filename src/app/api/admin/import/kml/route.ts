import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DOMParser } from "@xmldom/xmldom";

export interface KmlPlace {
  name: string;
  lat: number;
  lng: number;
  description: string;
}

function parseKml(xml: string): KmlPlace[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const placemarks = doc.getElementsByTagName("Placemark");
  const results: KmlPlace[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = pm.getElementsByTagName("name")[0];
    const descEl = pm.getElementsByTagName("description")[0];
    const coordEl = pm.getElementsByTagName("coordinates")[0];

    if (!coordEl) continue;

    const coordText = coordEl.textContent?.trim() ?? "";
    // KML 좌표: 경도,위도,고도 순서
    const [lngStr, latStr] = coordText.split(",");
    const lng = parseFloat(lngStr);
    const lat = parseFloat(latStr);

    if (isNaN(lat) || isNaN(lng)) continue;

    results.push({
      name: nameEl?.textContent?.trim() ?? "이름 없음",
      lat,
      lng,
      description: descEl?.textContent?.trim() ?? "",
    });
  }

  return results;
}

// POST /api/admin/import/kml  — preview only (dry-run)
// POST /api/admin/import/kml?save=1&team_id=xxx  — actually insert
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const save = searchParams.get("save") === "1";
  const teamId = searchParams.get("team_id");

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });

  const text = await file.text();
  const places = parseKml(text);

  if (!save) {
    return NextResponse.json({ preview: places, count: places.length });
  }

  if (!teamId) {
    return NextResponse.json({ error: "team_id가 필요합니다" }, { status: 400 });
  }

  const rows = places.map((p) => ({
    name: p.name,
    address: p.description || null,
    lat: p.lat,
    lng: p.lng,
    team_id: teamId,
    active: true,
  }));

  const { data, error } = await supabase.from("locations").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: data?.length ?? 0 });
}
