"use client";

import { useState, useEffect } from "react";
import { Wind, Droplets, Thermometer } from "lucide-react";

const WMO_ICON: Record<number, string> = {
  0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️",
  45: "🌫", 48: "🌫",
  51: "🌦", 53: "🌦", 55: "🌧",
  61: "🌧", 63: "🌧", 65: "🌧",
  71: "🌨", 73: "🌨", 75: "❄️",
  77: "🌨",
  80: "🌦", 81: "🌧", 82: "⛈",
  85: "🌨", 86: "❄️",
  95: "⛈", 96: "⛈", 99: "⛈",
};

const WMO_LABEL: Record<number, string> = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
  45: "안개", 48: "안개",
  51: "이슬비", 53: "이슬비", 55: "이슬비",
  61: "비", 63: "비", 65: "강한 비",
  71: "눈", 73: "눈", 75: "강한 눈", 77: "눈발",
  80: "소나기", 81: "소나기", 82: "강한 소나기",
  85: "눈 소나기", 86: "눈 소나기",
  95: "뇌우", 96: "뇌우", 99: "뇌우",
};

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function icon(code: number) {
  const key = Object.keys(WMO_ICON)
    .map(Number)
    .filter((k) => k <= code)
    .at(-1) ?? 0;
  return WMO_ICON[key] ?? "🌡";
}

function label(code: number) {
  const key = Object.keys(WMO_LABEL)
    .map(Number)
    .filter((k) => k <= code)
    .at(-1) ?? 0;
  return WMO_LABEL[key] ?? "알 수 없음";
}

interface CurrentWeather {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  code: number;
}

interface DayForecast {
  date: string;
  code: number;
  maxTemp: number;
  minTemp: number;
  precipProb: number;
  precipSum: number;
  wind: number;
}

export default function WeatherWidget() {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [days, setDays] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast" +
          "?latitude=35.2279&longitude=128.6811" +
          "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m" +
          "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max" +
          "&timezone=Asia%2FSeoul&forecast_days=7";

        const res = await fetch(url, { next: { revalidate: 1800 } } as RequestInit);
        if (!res.ok) throw new Error();
        const data = await res.json();

        setCurrent({
          temp: Math.round(data.current.temperature_2m),
          feels: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          wind: Math.round(data.current.wind_speed_10m),
          code: data.current.weather_code,
        });

        setDays(
          (data.daily.time as string[]).map((date: string, i: number) => ({
            date,
            code: data.daily.weather_code[i],
            maxTemp: Math.round(data.daily.temperature_2m_max[i]),
            minTemp: Math.round(data.daily.temperature_2m_min[i]),
            precipProb: data.daily.precipitation_probability_max[i] ?? 0,
            precipSum: Math.round(data.daily.precipitation_sum[i] * 10) / 10,
            wind: Math.round(data.daily.wind_speed_10m_max[i]),
          }))
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#161b27] rounded-2xl border border-white/5 p-5 mb-7 animate-pulse h-36" />
    );
  }

  if (error || !current) {
    return (
      <div className="bg-[#161b27] rounded-2xl border border-white/5 p-5 mb-7 text-slate-600 text-sm text-center py-8">
        날씨 정보를 불러올 수 없습니다
      </div>
    );
  }

  const today = days[0];

  return (
    <div className="bg-[#161b27] rounded-2xl border border-white/5 mb-7 overflow-hidden">
      {/* 현재 날씨 요약 */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between border-b border-white/5">
        <div>
          <p className="text-slate-400 text-xs font-medium mb-1">창원시 현재 날씨</p>
          <div className="flex items-end gap-3">
            <span className="text-4xl leading-none">{icon(current.code)}</span>
            <div>
              <p className="text-white text-3xl font-bold leading-none">{current.temp}°</p>
              <p className="text-slate-400 text-xs mt-1">{label(current.code)}</p>
            </div>
          </div>
        </div>
        <div className="text-right space-y-1.5 mt-1">
          <div className="flex items-center justify-end gap-1.5 text-slate-400 text-xs">
            <Thermometer size={11} />
            <span>체감 {current.feels}°</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-slate-400 text-xs">
            <Droplets size={11} />
            <span>습도 {current.humidity}%</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-slate-400 text-xs">
            <Wind size={11} />
            <span>바람 {current.wind}km/h</span>
          </div>
          {today && (
            <p className="text-slate-500 text-xs">
              최고 {today.maxTemp}° / 최저 {today.minTemp}°
            </p>
          )}
        </div>
      </div>

      {/* 7일 예보 */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const d = new Date(day.date);
          const dow = DAYS_KO[d.getDay()];
          const isToday = i === 0;
          const isSat = d.getDay() === 6;
          const isSun = d.getDay() === 0;

          return (
            <div
              key={day.date}
              className={`flex flex-col items-center gap-1 py-3 px-1 border-r border-white/5 last:border-r-0 ${
                isToday ? "bg-white/[0.04]" : ""
              }`}
            >
              {/* 요일 */}
              <p className={`text-xs font-medium ${
                isToday ? "text-blue-400" :
                isSat ? "text-blue-300" :
                isSun ? "text-red-400" :
                "text-slate-500"
              }`}>
                {isToday ? "오늘" : dow}
              </p>

              {/* 날씨 아이콘 */}
              <span className="text-xl leading-none">{icon(day.code)}</span>

              {/* 기온 */}
              <p className="text-red-400 text-xs font-semibold">{day.maxTemp}°</p>
              <p className="text-blue-400 text-xs">{day.minTemp}°</p>

              {/* 강수확률 */}
              <div className="flex items-center gap-0.5">
                <Droplets size={9} className={day.precipProb >= 30 ? "text-blue-400" : "text-slate-600"} />
                <p className={`text-xs ${day.precipProb >= 30 ? "text-blue-400" : "text-slate-600"}`}>
                  {day.precipProb}%
                </p>
              </div>

              {/* 강수량 */}
              {day.precipSum > 0 && (
                <p className="text-slate-500 text-xs">{day.precipSum}mm</p>
              )}

              {/* 바람 */}
              <div className="flex items-center gap-0.5">
                <Wind size={9} className="text-slate-600" />
                <p className="text-slate-600 text-xs">{day.wind}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
