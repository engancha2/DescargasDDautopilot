"use client";

import { useEffect, useState } from "react";

interface Download { id: string; title: string; library_name: string; status: string; progress: number; created_at: string; }

export default function DescargasPage() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  async function load() {
    try { const r = await fetch("/api/downloads"); setDownloads((await r.json()).downloads || []); } catch {}
    setLoading(false);
  }

  if (loading) return <div className="text-zinc-500 p-8">Cargando...</div>;

  const active = downloads.filter(d => d.status === "downloading" || d.status === "pending");
  const completed = downloads.filter(d => d.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Descargas</h1>
        <p className="text-sm text-zinc-500 mt-1">Monitoreo de JDownloader</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card !p-4"><div className="text-xl font-semibold text-indigo-400">{active.length}</div><div className="text-xs text-zinc-500 mt-1">Activas</div></div>
        <div className="card !p-4"><div className="text-xl font-semibold text-emerald-400">{completed.length}</div><div className="text-xs text-zinc-500 mt-1">Completadas</div></div>
        <div className="card !p-4"><div className="text-xl font-semibold text-red-400">{downloads.filter(d => d.status === "failed").length}</div><div className="text-xs text-zinc-500 mt-1">Fallidas</div></div>
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Activas</h2>
          <div className="space-y-2">
            {active.map((d) => (
              <div key={d.id} className="card !p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium truncate">{d.title}</span>
                  <span className="badge bg-indigo-900/40 text-indigo-400">{d.status === "downloading" ? "Descargando" : "En cola"}</span>
                </div>
                <div className="progress-track mb-2"><div className="progress-fill bg-indigo-600" style={{ width: `${d.progress}%` }} /></div>
                <div className="text-xs text-zinc-500">{d.library_name} · {d.progress}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Completadas</h2>
          <div className="space-y-1">
            {completed.slice(0, 15).map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#111113]">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="text-sm flex-1 truncate">{d.title}</span>
                <span className="text-xs text-zinc-500">{new Date(d.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {downloads.length === 0 && <div className="card text-center text-zinc-500">No hay descargas todavía.</div>}
    </div>
  );
}
