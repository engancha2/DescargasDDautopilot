"use client";

import { useEffect, useState } from "react";

interface LogEntry { id: number; type: string; message: string; details: string | null; created_at: string; }

const META: Record<string, { icon: string; color: string }> = {
  scan: { icon: "🔍", color: "text-blue-400" },
  thanks: { icon: "🙏", color: "text-emerald-400" },
  reply: { icon: "💬", color: "text-purple-400" },
  download: { icon: "⬇️", color: "text-indigo-400" },
  error: { icon: "❌", color: "text-red-400" },
  info: { icon: "ℹ️", color: "text-zinc-400" },
  success: { icon: "✅", color: "text-emerald-400" },
};

export default function LogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  async function load() {
    try { const r = await fetch("/api/log?limit=200"); setLogs((await r.json()).logs || []); } catch {}
    setLoading(false);
  }

  const types = ["all", "scan", "thanks", "reply", "download", "error", "info"];
  const filtered = logs.filter(l => filter === "all" || l.type === filter);

  if (loading) return <div className="text-zinc-500 p-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Actividad</h1>
        <p className="text-sm text-zinc-500 mt-1">Historial del sistema</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === t ? "bg-indigo-600 text-white" : "bg-[#111113] text-zinc-400 hover:bg-[#18181b]"}`}>
            {t === "all" ? "Todos" : `${(META[t]?.icon || "📋")} ${t}`}
          </button>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="max-h-[65vh] overflow-y-auto divide-y divide-[#1e1e22]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No hay logs</div>
          ) : filtered.map((log) => {
            const m = META[log.type] || { icon: "📋", color: "text-zinc-400" };
            return (
              <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[#0d0d0e]">
                <span className="text-sm mt-0.5 flex-shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${m.color}`}>{log.message}</div>
                  {log.details && <div className="text-xs text-zinc-600 mt-0.5 truncate">{log.details}</div>}
                </div>
                <span className="text-xs text-zinc-600 flex-shrink-0">{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
