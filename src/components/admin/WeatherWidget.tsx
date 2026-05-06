"use client";

import { useState, useEffect } from "react";
import { Wind, Droplets } from "lucide-react";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

const AQ_COLOR: Record<string, string> = {
  "좋음": "text-blue-400",
  "보통": "text-green-400",
  "나쁨": "text-orange-400",
  "매우나쁨": "text-red-400",
};

interface CurrentWeather {
  temp: number;
  humidity: number;
  wind: number;
  label: string;
  icon: string;
  minTemp: number | null;
  maxTemp: number | null;
}

interface HourlyItem {
  time: string;
  temp: number;
  icon: string;
}

interface AirQuality {
  pm10: { value: number; label: string };
  pm25: { value: number; label: string };
}

interface DayForecast {
  date: string;
  maxTemp: number | null;
  minTemp: number | null;
  precipProb: number;
  wind: number | null;
  label: string;
  icon: string;
}

interface WeatherData {
  current: CurrentWeather;
  days: DayForecast[];
  hourly?: HourlyItem[];
  airQuality?: AirQuality | null;
  model?: string;
  source?: string;
}

export default function WeatherWidget({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="bg-[#161b27] rounded-2xl border border-white/5 p-5 mb-7 animate-pulse h-44" />;
  }
  if (error || !data) {
    return (
      <div className="bg-[#161b27] rounded-2xl border border-white/5 p-5 mb-7 text-slate-600 text-sm text-center py-8">
        날씨 정보를 불러올 수 없습니다
      </div>
    );
  }

  const { current, days, hourly = [], airQuality, model, source } = data;

  /* ── compact 모드 (대시보드 하단 패널용) ── */
  if (compact) {
    const today = days[0];
    return (
      <div className="flex items-center gap-4 mb-3 px-1">
        <a href="https://weather.naver.com/today/03121520" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <span className="text-3xl">{current.icon}</span>
          <div>
            <p className="text-white font-bold text-xl leading-none">{current.temp}°</p>
            <p className="text-slate-400 text-xs mt-0.5">{current.label}</p>
          </div>
        </a>
        <div className="text-xs text-slate-500 flex-shrink-0 space-y-0.5">
          <p>
            <span className="text-blue-400">{today?.minTemp ?? "—"}°</span>
            {" / "}
            <span className="text-red-400">{today?.maxTemp ?? "—"}°</span>
          </p>
          {airQuality && (
            <p>
              미세 <span className={AQ_COLOR[airQuality.pm10.label]}>{airQuality.pm10.label}</span>
              {" · "}
              초미세 <span className={AQ_COLOR[airQuality.pm25.label]}>{airQuality.pm25.label}</span>
            </p>
          )}
        </div>
        <div className="flex gap-3 ml-auto overflow-x-auto pb-0.5">
          {days.slice(1, 5).map((d) => {
            const dow = DAYS_KO[new Date(d.date).getDay()];
            return (
              <div key={d.date} className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <span className="text-slate-500 text-[10px]">{dow}</span>
                <span className="text-base leading-none">{d.icon}</span>
                <span className="text-red-400 text-[10px]">{d.maxTemp}°</span>
                <span className="text-blue-400 text-[10px]">{d.minTemp}°</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── 풀 모드 (대시보드 메인) ── */
  const today = days[0];

  return (
    <div className="bg-[#161b27] rounded-2xl border border-white/5 mb-7 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <a
            href="https://weather.naver.com/today/03121520"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-semibold text-sm hover:text-blue-400 transition-colors"
          >
            날씨
          </a>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            source === "kma" ? "bg-blue-500/20 text-blue-400" : "bg-slate-600/40 text-slate-400"
          }`}>
            {model ?? "Open-Meteo"}
          </span>
        </div>
        <span className="text-slate-500 text-xs">창원시 팔용동</span>
      </div>

      {/* 현재 날씨 + 시간별 */}
      <div className="flex gap-6 px-5 py-4">
        {/* 좌: 현재 날씨 */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-5xl leading-none">{current.icon}</span>
            <div>
              <p className="text-white text-4xl font-bold leading-none">{current.temp}°</p>
              <p className="text-slate-400 text-sm mt-1">{current.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm mb-1">
            <span className="text-blue-400 font-medium">{today?.minTemp ?? "—"}°</span>
            <span className="text-slate-600">/</span>
            <span className="text-red-400 font-medium">{today?.maxTemp ?? "—"}°</span>
          </div>
          {airQuality && (
            <div className="text-xs text-slate-400 space-y-0.5">
              <p>
                미세&nbsp;
                <span className={`font-medium ${AQ_COLOR[airQuality.pm10.label]}`}>
                  {airQuality.pm10.label}
                </span>
                &nbsp;<span className="text-slate-600">({airQuality.pm10.value}㎍)</span>
              </p>
              <p>
                초미세&nbsp;
                <span className={`font-medium ${AQ_COLOR[airQuality.pm25.label]}`}>
                  {airQuality.pm25.label}
                </span>
                &nbsp;<span className="text-slate-600">({airQuality.pm25.value}㎍)</span>
              </p>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Droplets size={10} />{current.humidity}%</span>
            <span className="flex items-center gap-1"><Wind size={10} />{current.wind}km/h</span>
          </div>
        </div>

        {/* 우: 시간별 예보 */}
        {hourly.length > 0 && (
          <div className="flex-1 min-w-0">
            {/* 기온 숫자 */}
            <div className="flex justify-between mb-1">
              {hourly.map((h) => (
                <span key={h.time} className="text-white text-xs font-medium text-center flex-1">{h.temp}°</span>
              ))}
            </div>
            {/* 간단 꺾은선 SVG */}
            <HourlyLine temps={hourly.map((h) => h.temp)} />
            {/* 날씨 아이콘 */}
            <div className="flex justify-between mt-1">
              {hourly.map((h) => (
                <span key={h.time} className="text-lg text-center flex-1 leading-none">{h.icon}</span>
              ))}
            </div>
            {/* 시간 */}
            <div className="flex justify-between mt-1">
              {hourly.map((h) => (
                <span key={h.time} className="text-slate-500 text-[10px] text-center flex-1">{h.time}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 주간 예보 */}
      <div className="border-t border-white/5 grid grid-cols-7">
        {days.slice(0, 7).map((day, i) => {
          const d = new Date(day.date);
          const dow = DAYS_KO[d.getDay()];
          const isToday = i === 0;
          const isSat = d.getDay() === 6;
          const isSun = d.getDay() === 0;

          return (
            <div
              key={day.date}
              className={`flex flex-col items-center gap-1 py-3 px-1 border-r border-white/5 last:border-r-0 ${isToday ? "bg-white/[0.04]" : ""}`}
            >
              <p className={`text-xs font-medium ${
                isToday ? "text-blue-400" : isSat ? "text-blue-300" : isSun ? "text-red-400" : "text-slate-500"
              }`}>
                {isToday ? "오늘" : dow}
              </p>
              <span className="text-xl leading-none">{day.icon}</span>
              <p className="text-red-400 text-xs font-semibold">{day.maxTemp !== null ? `${day.maxTemp}°` : "—"}</p>
              <p className="text-blue-400 text-xs">{day.minTemp !== null ? `${day.minTemp}°` : "—"}</p>
              <div className="flex items-center gap-0.5">
                <Droplets size={9} className={day.precipProb >= 30 ? "text-blue-400" : "text-slate-600"} />
                <p className={`text-xs ${day.precipProb >= 30 ? "text-blue-400" : "text-slate-600"}`}>{day.precipProb}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourlyLine({ temps }: { temps: number[] }) {
  if (temps.length < 2) return null;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const W = 100;
  const H = 28;
  const pad = 4;
  const step = (W - pad * 2) / (temps.length - 1);
  const y = (t: number) => H - pad - ((t - min) / range) * (H - pad * 2);
  const points = temps.map((t, i) => `${pad + i * step},${y(t)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 28 }}>
      <polyline
        points={points}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
