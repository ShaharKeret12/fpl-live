"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const API = (path: string) => `/api/fpl?path=${encodeURIComponent(path)}`;

const DEFAULT_PLAYERS = [
  { display: "Declan Rice", query: "Declan Rice" },
  { display: "Pape Matar Sarr", query: "Pape Matar Sarr" },
];

function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef<() => void>(() => {});
  useEffect(() => { savedRef.current = callback; }, [callback]);
  useEffect(() => { if (delay != null) { const id = setInterval(() => savedRef.current(), delay); return () => clearInterval(id);} }, [delay]);
}

function PlayerPicker({ elements, value, onChange, label }:{ 
  elements: any[] | undefined; value: number | null; onChange: (id: number) => void; label: string;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    if (!elements) return [] as any[];
    const term = q.trim().toLowerCase();
    if (!term) return [] as any[];
    return elements.filter((el: any) => {
      const full = `${el.first_name} ${el.second_name}`.toLowerCase();
      return full.includes(term) || el.web_name.toLowerCase().includes(term);
    }).slice(0, 12);
  }, [elements, q]);

  return (
    <div className="w-full">
      <label className="text-xs font-medium opacity-70">{label}</label>
      <input className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-800"
        placeholder="חפש שחקן (לדוגמה: Declan Rice)" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length > 0 && (
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-neutral-200 bg-white shadow">
          {list.map((el: any) => (
            <button key={el.id} className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50"
              onClick={() => { onChange(el.id); setQ(""); }}>
              {el.first_name} {el.second_name} <span className="opacity-60">({el.web_name})</span>
            </button>
          ))}
        </div>
      )}
      {value && <div className="text-xs opacity-60 mt-1">נבחר: {value}</div>}
    </div>
  );
}

export default function FPLLive() {
  const [bootstrap, setBootstrap] = useState<any | null>(null);
  const [live, setLive] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<[number|null, number|null]>(() => {
    if (typeof window === "undefined") return [null, null];
    const saved = localStorage.getItem("fpl.selected.ids");
    return saved ? JSON.parse(saved) : [null, null];
  });

  async function loadBootstrap() {
    try {
      setError(null);
      const res = await fetch(API("bootstrap-static/"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBootstrap(data);
      if (!selectedIds[0] || !selectedIds[1]) {
        const ids: [number|null, number|null] = [...selectedIds];
        DEFAULT_PLAYERS.forEach((p, idx) => {
          if (!ids[idx]) {
            const el = data.elements.find((e: any) => {
              const full = `${e.first_name} ${e.second_name}`.toLowerCase();
              return full === p.query.toLowerCase() || e.web_name.toLowerCase() === p.query.split(" ")[1]?.toLowerCase();
            });
            if (el) ids[idx] = el.id;
          }
        });
        setSelectedIds(ids);
        if (typeof window !== "undefined") localStorage.setItem("fpl.selected.ids", JSON.stringify(ids));
      }
      return data;
    } catch (e:any) { setError(`שגיאה בקריאת bootstrap: ${e.message}`); return null; }
  }

  async function loadLive(eventId: number) {
    try {
      const res = await fetch(API(`event/${eventId}/live/`), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLive(data);
      setLastUpdated(new Date());
    } catch (e:any) { setError(`שגיאה בקריאת live: ${e.message}`); }
  }

  useEffect(() => { (async () => {
    const bs = await loadBootstrap(); if (!bs) return;
    const current = bs?.events?.find((e: any) => e.is_current) || bs?.events?.find((e: any) => e.is_next) || bs?.events?.[0];
    if (current?.id) await loadLive(current.id);
  })(); }, []);

  const currentEvent = useMemo(() => bootstrap?.events?.find((e: any) => e.is_current), [bootstrap]);
  useInterval(() => { if (currentEvent?.id) loadLive(currentEvent.id); }, currentEvent ? 30000 : null);

  const liveIndex = useMemo(() => {
    const m = new Map<number, any>();
    if (live?.elements) for (const el of live.elements) m.set(el.id, el.stats);
    return m;
  }, [live]);

  const players = useMemo(() => {
    if (!bootstrap) return [] as any[];
    return (selectedIds as (number|null)[])
      .map((id) => bootstrap.elements.find((el: any) => el.id === id))
      .map((match: any) => {
        if (!match) return null;
        const photoUrl = `https://resources.premierleague.com/premierleague/photos/players/110x140/${match.photo}`;
        const team = bootstrap.teams.find((t: any) => t.id === match.team)?.name;
        const gwStats = liveIndex.get(match.id);
        return {
          id: match.id, display: `${match.first_name} ${match.second_name}`, team,
          cost: (match.now_cost || 0) / 10, seasonPoints: match.total_points,
          gwPoints: gwStats?.total_points ?? 0, photoUrl,
          position: bootstrap.element_types.find((t: any) => t.id === match.element_type)?.singular_name_short,
        };
      })
      .filter(Boolean);
  }, [bootstrap, liveIndex, selectedIds]);

  function setSelected(index: 0|1, id: number) {
    const next: [number|null, number|null] = [...selectedIds];
    next[index] = id;
    setSelectedIds(next);
    if (typeof window !== "undefined") localStorage.setItem("fpl.selected.ids", JSON.stringify(next));
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">FPL — Rice vs Sarr</h1>
      <p className="text-sm mt-2 opacity-80">לייב נקודות לפי FPL. מתעדכן אוטומטית {currentEvent ? "כל 30 שניות" : "כאשר יש מחזור פעיל"}.</p>
      {error && (<div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-300 text-red-800">{error}</div>)}
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <PlayerPicker elements={bootstrap?.elements} value={selectedIds[0]} onChange={(id) => setSelected(0, id)} label="בחר שחקן ראשון" />
        <PlayerPicker elements={bootstrap?.elements} value={selectedIds[1]} onChange={(id) => setSelected(1, id)} label="בחר שחקן שני" />
      </div>
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {players.map((pl: any, idx: number) => (
          <div key={pl.id ?? idx} className="relative bg-white rounded-2xl p-5 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                {pl.photoUrl ? (<img src={pl.photoUrl} alt={pl.display} className="object-cover w-full h-full" />) : (<div className="text-xs opacity-60">No Image</div>)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-semibold truncate">{pl.display}</div>
                <div className="text-sm opacity-80 truncate">{pl.team}</div>
                <div className="text-xs opacity-60">{pl.position ? `עמדה: ${pl.position}` : null}{pl.cost ? ` • £${pl.cost.toFixed(1)}m` : null}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50">
                <div className="text-xs uppercase tracking-wide opacity-60">עונת 25/26</div>
                <div className="text-3xl font-bold mt-1">{pl.seasonPoints ?? "–"}</div>
                <div className="text-xs opacity-60">Total Points</div>
              </div>
              <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50">
                <div className="text-xs uppercase tracking-wide opacity-60">מחזור נוכחי</div>
                <div className="text-3xl font-bold mt-1">{pl.gwPoints ?? "–"}</div>
                <div className="text-xs opacity-60">GW Live</div>
              </div>
            </div>
            {lastUpdated && (<div className="text-xs opacity-60 mt-3">עודכן: {lastUpdated.toLocaleTimeString()}</div>)}
          </div>
        ))}
      </div>
      {players.length === 2 && (
        <div className="mt-8 rounded-2xl p-5 border border-neutral-200 bg-white shadow-sm">
          <div className="text-sm opacity-70">השוואה מהירה</div>
          <div className="mt-2 grid grid-cols-3 items-center text-center">
            <div className="text-lg font-semibold truncate">{players[0]?.display}</div>
            <div className="text-2xl font-bold">
              {(players[0]?.seasonPoints ?? 0) === (players[1]?.seasonPoints ?? 0) ? "=" : (players[0]?.seasonPoints ?? 0) > (players[1]?.seasonPoints ?? 0) ? "↑" : "↓"}
            </div>
            <div className="text-lg font-semibold truncate">{players[1]?.display}</div>
          </div>
        </div>
      )}
      <footer className="mt-10 text-xs opacity-60">טיפ: היסטוריית מחזורים לכל שחקן דרך endpoint <code>element-summary/{`{element_id}`}</code> ומערך <code>history</code>.</footer>
    </div>
  );
}
