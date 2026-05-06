"use client";

import { useState, useEffect } from "react";
import { Wind, Droplets, Thermometer } from "lucide-react";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface CurrentWeather {
  temp: number;
  humidity: number;
  wind: number;
  label: string;
  icon: string;
}

interface DayForecast {
  date: string;
  maxTemp: number | null;
  minTemp: number | null;
  precipProb: number;
  wind: number | null;
  label: string;
  icon: string;
  amLabel?: string;
  pmLabel?: string;
}

interface WeatherData {
  current: CurrentWeather;
  days: DayForecast[];
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
    return (
      <div className="bg-[#161b27] rounded-2xl border border-white/5 p-5 mb-7 animate-pulse h-44" />
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#161b27] rounded-2xl border border-white/5 p-5 mb-7 text-slate-600 text-sm text-center py-8">
        날씨 정보를 불러올 수 없습니다
      </div>
    );
  }

  const { current, days, model, source } = data;

  if (compact) {
    const today = days[0];
    return (
      <div className="flex items-center gap-4 mb-3 px-1">
        <a href="https://weather.naver.com/today/03121520" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl">{current.icon}</span>
          <div>
            <p className="text-white font-bold text-lg leading-none">{current.temp}°</p>
            <p className="text-slate-400 text-xs">{current.label || "창원시"}</p>
          </div>
        </a>
        <div className="text-xs text-slate-500 space-y-0.5">
          <p>최고 {today?.maxTemp ?? "—"}° / 최저 {today?.minTemp ?? "—"}°</p>
          <p>강수 {today?.precipProb ?? 0}% · 바람 {current.wind}km/h</p>
        </div>
        <div className="flex gap-2 ml-auto overflow-x-auto">
          {days.slice(1, 5).map((d) => {
            const dow = ["일","월","화","수","목","금","토"][new Date(d.date).getDay()];
            return (
              <div key={d.date} className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <span className="text-slate-500 text-[10px]">{dow}</span>
                <span className="text-base">{d.icon}</span>
                <span className="text-red-400 text-[10px]">{d.maxTemp}°</span>
                <span className="text-blue-400 text-[10px]">{d.minTemp}°</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161b27] rounded-2xl border border-white/5 mb-7 overflow-hidden">
      {/* 현재 날씨 */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <a
              href="https://weather.naver.com/today/03121520"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 text-xs font-medium hover:text-blue-400 transition-colors underline underline-offset-2"
            >
              창원시 현재 날씨
            </a>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              source === "kma"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-slate-600/40 text-slate-400"
            }`}>
              {model ?? "Open-Meteo (ECMWF)"}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl leading-none">{current.icon}</span>
            <div>
              <p className="text-white text-3xl font-bold leading-none">{current.temp}°</p>
              <p className="text-slate-400 text-xs mt-1">{current.label || "—"}</p>
            </div>
          </div>
        </div>
        <div className="text-right space-y-1.5 mt-1">
          <div className="flex items-center justify-end gap-1.5 text-slate-400 text-xs">
            <Thermometer size={11} />
            <span>
              최고 {days[0]?.maxTemp ?? "—"}° / 최저 {days[0]?.minTemp ?? "—"}°
            </span>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-slate-400 text-xs">
            <Droplets size={11} />
            <span>습도 {current.humidity}%</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-slate-400 text-xs">
            <Wind size={11} />
            <span>바람 {current.wind}km/h</span>
          </div>
        </div>
      </div>

      {/* 주간 예보 */}
      <div className="grid grid-cols-7">
        {days.slice(0, 7).map((day, i) => {
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
              <span className="text-xl leading-none" title={day.label}>{day.icon}</span>

              {/* 오전/오후 (중기예보만) */}
              {(day.amLabel || day.pmLabel) && (
                <div className="flex flex-col items-center gap-0.5">
                  {day.amLabel && <p className="text-slate-500 text-[9px] leading-tight">오전</p>}
                  {day.pmLabel && <p className="text-slate-500 text-[9px] leading-tight">오후</p>}
                </div>
              )}

              {/* 최고/최저 기온 */}
              <p className="text-red-400 text-xs font-semibold">
                {day.maxTemp !== null ? `${day.maxTemp}°` : "—"}
              </p>
              <p className="text-blue-400 text-xs">
                {day.minTemp !== null ? `${day.minTemp}°` : "—"}
              </p>

              {/* 강수확률 */}
              <div className="flex items-center gap-0.5">
                <Droplets
                  size={9}
                  className={day.precipProb >= 30 ? "text-blue-400" : "text-slate-600"}
                />
                <p className={`text-xs ${day.precipProb >= 30 ? "text-blue-400" : "text-slate-600"}`}>
                  {day.precipProb}%
                </p>
              </div>

              {/* 바람 (단기만) */}
              {day.wind !== null && (
                <div className="flex items-center gap-0.5">
                  <Wind size={9} className="text-slate-600" />
                  <p className="text-slate-600 text-xs">{day.wind}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
