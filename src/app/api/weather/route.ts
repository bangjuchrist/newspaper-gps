import { NextResponse } from "next/server";

// 창원시 의창구 격자 좌표
const NX = 89;
const NY = 77;

// 중기예보 구역코드 (창원)
const MID_LAND_REG = "11H20000"; // 경남 육상예보
const MID_TEMP_REG = "11H20401"; // 창원 기온예보

const KEY = process.env.KMA_SERVICE_KEY!;
const BASE = "https://apis.data.go.kr/1360000";

const SKY: Record<string, string> = { "1": "맑음", "3": "구름많음", "4": "흐림" };
const PTY: Record<string, string> = { "0": "", "1": "비", "2": "비/눈", "3": "눈", "4": "소나기" };

const SKY_ICON: Record<string, string> = { "1": "☀️", "3": "⛅", "4": "☁️" };
const PTY_ICON: Record<string, string> = { "1": "🌧", "2": "🌨", "3": "❄️", "4": "🌦" };

function weatherLabel(sky: string, pty: string) {
  if (pty && pty !== "0") return PTY[pty] ?? "";
  return SKY[sky] ?? "";
}
function weatherIcon(sky: string, pty: string) {
  if (pty && pty !== "0") return PTY_ICON[pty] ?? "🌡";
  return SKY_ICON[sky] ?? "🌡";
}

/** 단기예보 base_time: 02,05,08,11,14,17,20,23 발표, 10분 후 이용 가능 */
function getBaseDateTime() {
  const now = new Date(Date.now() + 9 * 3600_000); // KST
  const hours = now.getUTCHours();
  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
  let baseHour = baseTimes[0];
  for (const h of baseTimes) {
    if (hours > h || (hours === h && now.getUTCMinutes() >= 10)) baseHour = h;
  }
  // 00시~02시10분 미만이면 전날 23시 기준
  let date = now;
  if (hours < 2 || (hours === 2 && now.getUTCMinutes() < 10)) {
    baseHour = 23;
    date = new Date(now.getTime() - 86400_000);
  }
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return {
    base_date: `${yyyy}${mm}${dd}`,
    base_time: String(baseHour).padStart(2, "0") + "00",
  };
}

/** 오늘 날짜 KST YYYYMMDD */
function todayKST() {
  const now = new Date(Date.now() + 9 * 3600_000);
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
}

/** 중기예보 base_time: 06:00 / 18:00 발표 */
function getMidBaseDateTime() {
  const now = new Date(Date.now() + 9 * 3600_000);
  const h = now.getUTCHours();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const baseTime = h >= 18 ? "1800" : "0600";
  if (h < 6) {
    // 전날 18시
    const prev = new Date(now.getTime() - 86400_000);
    const pyyyy = prev.getUTCFullYear();
    const pmm = String(prev.getUTCMonth() + 1).padStart(2, "0");
    const pdd = String(prev.getUTCDate()).padStart(2, "0");
    return `${pyyyy}${pmm}${pdd}1800`;
  }
  return `${yyyy}${mm}${dd}${baseTime}`;
}

async function fetchVillageFcst() {
  const { base_date, base_time } = getBaseDateTime();
  const url = new URL(`${BASE}/VilageFcstInfoService_2.0/getVilageFcst`);
  url.searchParams.set("serviceKey", KEY);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", base_date);
  url.searchParams.set("base_time", base_time);
  url.searchParams.set("nx", String(NX));
  url.searchParams.set("ny", String(NY));

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  const json = await res.json();
  return json.response?.body?.items?.item ?? [];
}

async function fetchUltraNcst() {
  const now = new Date(Date.now() + 9 * 3600_000);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  // 초단기실황: 매시 40분 이후 이용 가능
  const obsHour = m >= 40 ? h : h - 1;
  const base_date = m >= 40 || h > 0 ? `${yyyy}${mm}${dd}` : (() => {
    const prev = new Date(now.getTime() - 86400_000);
    return `${prev.getUTCFullYear()}${String(prev.getUTCMonth()+1).padStart(2,"0")}${String(prev.getUTCDate()).padStart(2,"0")}`;
  })();
  const base_time = String(Math.max(0, obsHour)).padStart(2, "0") + "00";

  const url = new URL(`${BASE}/VilageFcstInfoService_2.0/getUltraSrtNcst`);
  url.searchParams.set("serviceKey", KEY);
  url.searchParams.set("numOfRows", "50");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", base_date);
  url.searchParams.set("base_time", base_time);
  url.searchParams.set("nx", String(NX));
  url.searchParams.set("ny", String(NY));

  const res = await fetch(url.toString(), { next: { revalidate: 600 } });
  const json = await res.json();
  return json.response?.body?.items?.item ?? [];
}

async function fetchMidLand() {
  const tmFc = getMidBaseDateTime();
  const url = new URL(`${BASE}/MidFcstInfoService/getMidLandFcst`);
  url.searchParams.set("serviceKey", KEY);
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("regId", MID_LAND_REG);
  url.searchParams.set("tmFc", tmFc);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const json = await res.json();
  return json.response?.body?.items?.item?.[0] ?? null;
}

async function fetchMidTemp() {
  const tmFc = getMidBaseDateTime();
  const url = new URL(`${BASE}/MidFcstInfoService/getMidTa`);
  url.searchParams.set("serviceKey", KEY);
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("regId", MID_TEMP_REG);
  url.searchParams.set("tmFc", tmFc);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const json = await res.json();
  return json.response?.body?.items?.item?.[0] ?? null;
}

function dateStr(offset: number) {
  const d = new Date(Date.now() + 9 * 3600_000 + offset * 86400_000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`;
}

function isoDate(offset: number) {
  const d = new Date(Date.now() + 9 * 3600_000 + offset * 86400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

/** Open-Meteo 폴백 (창원시) */
async function fetchOpenMeteo() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=35.2279&longitude=128.6811" +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max" +
    "&timezone=Asia%2FSeoul&forecast_days=7";

  const res = await fetch(url, { next: { revalidate: 1800 } } as RequestInit);
  if (!res.ok) throw new Error("open-meteo fail");
  const data = await res.json();

  const WMO_ICON: Record<number, string> = {
    0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️",
    45: "🌫", 48: "🌫", 51: "🌦", 53: "🌦", 55: "🌧",
    61: "🌧", 63: "🌧", 65: "🌧", 71: "🌨", 73: "🌨", 75: "❄️",
    80: "🌦", 81: "🌧", 82: "⛈", 95: "⛈", 96: "⛈", 99: "⛈",
  };
  const WMO_LABEL: Record<number, string> = {
    0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
    45: "안개", 48: "안개", 51: "이슬비", 53: "이슬비", 55: "이슬비",
    61: "비", 63: "비", 65: "강한 비", 71: "눈", 73: "눈", 75: "강한 눈",
    80: "소나기", 81: "소나기", 82: "강한 소나기",
    95: "뇌우", 96: "뇌우", 99: "뇌우",
  };
  function wmoKey(code: number) {
    return Object.keys(WMO_ICON).map(Number).filter((k) => k <= code).at(-1) ?? 0;
  }

  const c = data.current;
  const current = {
    temp: Math.round(c.temperature_2m),
    humidity: c.relative_humidity_2m,
    wind: Math.round(c.wind_speed_10m),
    label: WMO_LABEL[wmoKey(c.weather_code)] ?? "",
    icon: WMO_ICON[wmoKey(c.weather_code)] ?? "🌡",
  };

  const days = (data.daily.time as string[]).map((date: string, i: number) => ({
    date,
    maxTemp: Math.round(data.daily.temperature_2m_max[i]),
    minTemp: Math.round(data.daily.temperature_2m_min[i]),
    precipProb: data.daily.precipitation_probability_max[i] ?? 0,
    wind: Math.round(data.daily.wind_speed_10m_max[i]),
    label: WMO_LABEL[wmoKey(data.daily.weather_code[i])] ?? "",
    icon: WMO_ICON[wmoKey(data.daily.weather_code[i])] ?? "🌡",
  }));

  return { current, days, source: "open-meteo" };
}

export async function GET() {
  if (!KEY) return NextResponse.json(await fetchOpenMeteo());

  try {
    const [fcstItems, ncstItems, midLand, midTemp] = await Promise.all([
      fetchVillageFcst(),
      fetchUltraNcst(),
      fetchMidLand(),
      fetchMidTemp(),
    ]);

    // 현재 실황
    const ncst: Record<string, string> = {};
    for (const item of ncstItems) ncst[item.category] = item.obsrValue;

    const current = {
      temp: Math.round(Number(ncst["T1H"] ?? 0)),
      humidity: Number(ncst["REH"] ?? 0),
      wind: Math.round(Number(ncst["WSD"] ?? 0) * 3.6), // m/s → km/h
      pty: ncst["PTY"] ?? "0",
      label: weatherLabel("1", ncst["PTY"] ?? "0"),
      icon: weatherIcon("1", ncst["PTY"] ?? "0"),
    };

    // 단기예보 → 날짜별 집계 (오늘~모레)
    type DayData = {
      sky: string[]; pty: string[]; tmp: number[];
      pop: number[]; wsd: number[];
    };
    const byDate: Record<string, DayData> = {};
    for (const item of fcstItems) {
      const d = item.fcstDate as string;
      if (!byDate[d]) byDate[d] = { sky: [], pty: [], tmp: [], pop: [], wsd: [] };
      if (item.category === "SKY") byDate[d].sky.push(item.fcstValue);
      if (item.category === "PTY") byDate[d].pty.push(item.fcstValue);
      if (item.category === "TMP") byDate[d].tmp.push(Number(item.fcstValue));
      if (item.category === "POP") byDate[d].pop.push(Number(item.fcstValue));
      if (item.category === "WSD") byDate[d].wsd.push(Number(item.fcstValue));
    }

    function mode(arr: string[]) {
      const cnt: Record<string, number> = {};
      for (const v of arr) cnt[v] = (cnt[v] ?? 0) + 1;
      return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "1";
    }

    const shortDays = [0, 1, 2].map((off) => {
      const ds = dateStr(off);
      const d = byDate[ds];
      if (!d) return null;
      const sky = mode(d.sky);
      const pty = mode(d.pty);
      return {
        date: isoDate(off),
        maxTemp: Math.max(...d.tmp),
        minTemp: Math.min(...d.tmp),
        precipProb: Math.max(...d.pop, 0),
        wind: Math.round(Math.max(...d.wsd) * 3.6),
        label: weatherLabel(sky, pty),
        icon: weatherIcon(sky, pty),
      };
    }).filter(Boolean);

    // 중기예보 → 3~6일 후 (오늘 기준 day+3 ~ day+6)
    const midIconMap: Record<string, string> = {
      "맑음": "☀️", "구름조금": "🌤", "구름많음": "⛅", "흐림": "☁️",
      "구름많고 비": "🌧", "구름많고 눈": "🌨", "구름많고 비/눈": "🌨",
      "흐리고 비": "🌧", "흐리고 눈": "❄️", "흐리고 비/눈": "🌨",
      "흐리고 소나기": "🌦",
    };

    const midDays = [3, 4, 5, 6].map((off) => {
      const n = off; // wf{n}Am, wf{n}Pm, taMin{n}, taMax{n}
      const amLabel: string = midLand?.[`wf${n}Am`] ?? "";
      const pmLabel: string = midLand?.[`wf${n}Pm`] ?? "";
      const amPop: number = midLand?.[`rnSt${n}Am`] ?? 0;
      const pmPop: number = midLand?.[`rnSt${n}Pm`] ?? 0;
      const mainLabel = pmLabel || amLabel;
      return {
        date: isoDate(off),
        maxTemp: midTemp?.[`taMax${n}`] ?? null,
        minTemp: midTemp?.[`taMin${n}`] ?? null,
        precipProb: Math.max(amPop, pmPop),
        wind: null,
        label: mainLabel,
        icon: midIconMap[mainLabel] ?? "⛅",
        amLabel,
        pmLabel,
      };
    });

    return NextResponse.json({
      current,
      days: [...shortDays, ...midDays],
      model: "기상청 수치예보모델 (UM · GFS)",
      source: "kma",
    });
  } catch (e) {
    console.warn("KMA API 실패, Open-Meteo 폴백:", e);
    try {
      return NextResponse.json(await fetchOpenMeteo());
    } catch {
      return NextResponse.json({ error: "날씨 조회 실패" }, { status: 500 });
    }
  }
}
