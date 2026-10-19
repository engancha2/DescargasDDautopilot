"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  config: Record<string, string>;
  stats: { libraries: number; enabledLibraries: number; forumUrls: number; scannedPosts: number; pendingDownloads: number; completedDownloads: number; };
  embyStatus: { success: boolean; serverName?: string; version?: string } | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  async function load() {
    try { const r = await fetch("/api/dashboard"); setData(await r.json()); } catch {}
    setLoading(false);
  }

  if (loading || !data) return <div className="text-zinc-500 p-8">Cargando...</div>;

  const { stats, embyStatus, config } = data;
  const cards = [
    { label: "Bibliotecas", value: stats.libraries },
    { label: "Activadas", value: stats.enabledLibraries },
    { label: "Foros", value: stats.forumUrls },
    { label: "Escaneados", value: stats.scannedPosts },
    { label: "Pendientes", value: stats.pendingDownloads },
    { label: "Completados", value: stats.completedDownloads },
  ];

  const systems = [
    { name: "Emby", online: embyStatus?.success, detail: embyStatus?.success ? `${embyStatus.serverName} v${embyStatus.version}` : "Desconectado" },
    { name: "JDownloader", online: !!config.jd_email, detail: config.jd_email ? "Configurado" : "No configurado" },
    { name: "DescargasDD", online: !!config.forum_user, detail: config.forum_user || "No configurado" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Estado general del sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((s) => (
          <div key={s.label} className="card !p-4">
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* System status */}
      <div className="card">
        <h2 className="text-sm font-semibold mb-4">Sistema</h2>
        <div className="space-y-2">
          {systems.map((s) => (
            <div key={s.name} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${s.online ? "bg-emerald-500" : "bg-zinc-600"}`}></span>
                <span className="text-sm">{s.name}</span>
              </div>
              <span className="text-xs text-zinc-500">{s.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <a href="/bibliotecas" className="btn btn-ghost">📚 Bibliotecas</a>
        <a href="/faltantes" className="btn btn-ghost">🔍 Faltantes</a>
        <a href="/config" className="btn btn-ghost">⚙️ Config</a>
      </div>
    </div>
  );
}
