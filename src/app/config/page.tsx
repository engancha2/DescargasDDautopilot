"use client";

import { useEffect, useState } from "react";

interface Config {
  emby_url: string; emby_api_key: string; jd_email: string; jd_password: string;
  forum_user: string; autopilot_interval: string; autopilot_enabled: string; telegram_notify: string;
}

export default function ConfigPage() {
  const [cfg, setCfg] = useState<Config>({ emby_url: "", emby_api_key: "", jd_email: "", jd_password: "", forum_user: "", autopilot_interval: "6", autopilot_enabled: "false", telegram_notify: "true" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => { fetch("/api/config").then(r => r.json()).then(d => { if (d.config) setCfg(c => ({ ...c, ...d.config })); }); }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  async function test(key: string, url: string, body: any) {
    setTesting({ ...testing, [key]: true }); setResults({ ...results, [key]: "" });
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      setResults({ ...results, [key]: d.success ? "✅ Conectado" : `❌ ${d.error}` });
    } catch (e) { setResults({ ...results, [key]: `❌ ${(e as Error).message}` }); }
    setTesting({ ...testing, [key]: false });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-zinc-500 mt-1">Conexiones de servicios</p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold">Emby Media Server</h2>
        <div>
          <label className="label">URL</label>
          <input className="input" value={cfg.emby_url} onChange={e => setCfg({ ...cfg, emby_url: e.target.value })} placeholder="http://192.168.5.10:9696" />
        </div>
        <div>
          <label className="label">API Key</label>
          <input type="password" className="input font-mono" value={cfg.emby_api_key} onChange={e => setCfg({ ...cfg, emby_api_key: e.target.value })} placeholder="d7dd..." />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => test("emby", "/api/emby/test", { url: cfg.emby_url, apiKey: cfg.emby_api_key })} disabled={testing.emby} className="btn btn-primary">
            {testing.emby ? "Probando..." : "Probar"}
          </button>
          {results.emby && <span className="text-sm">{results.emby}</span>}
        </div>
        <div className="text-xs text-amber-500 bg-amber-950/20 px-3 py-2 rounded-lg">🔒 Solo lectura — nunca se borra contenido</div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold">JDownloader</h2>
        <div>
          <label className="label">Email</label>
          <input className="input" value={cfg.jd_email} onChange={e => setCfg({ ...cfg, jd_email: e.target.value })} placeholder="tu@email.com" />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" value={cfg.jd_password} onChange={e => setCfg({ ...cfg, jd_password: e.target.value })} placeholder="••••••••" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => test("jd", "/api/jdownloader/test", { email: cfg.jd_email, password: cfg.jd_password })} disabled={testing.jd} className="btn btn-primary">
            {testing.jd ? "Probando..." : "Probar"}
          </button>
          {results.jd && <span className="text-sm">{results.jd}</span>}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold">DescargasDD</h2>
        <div>
          <label className="label">Usuario del foro</label>
          <input className="input" value={cfg.forum_user} onChange={e => setCfg({ ...cfg, forum_user: e.target.value })} placeholder="Engancha2" />
        </div>
        <div className="text-xs text-zinc-500 space-y-1 bg-[#0d0d0e] px-3 py-2 rounded-lg">
          <div>• 30 segundos entre mensajes</div>
          <div>• Mínimo 10 caracteres</div>
          <div>• Dar gracias antes de descargar</div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold">Auto-Pilot</h2>
        <div>
          <label className="label">Intervalo (horas)</label>
          <input type="number" className="input !w-32" value={cfg.autopilot_interval} onChange={e => setCfg({ ...cfg, autopilot_interval: e.target.value })} min={1} max={24} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={cfg.autopilot_enabled === "true"} onChange={e => setCfg({ ...cfg, autopilot_enabled: e.target.checked ? "true" : "false" })} className="w-4 h-4 rounded accent-indigo-500" />
          <span className="text-sm">Activar auto-pilot</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={cfg.telegram_notify === "true"} onChange={e => setCfg({ ...cfg, telegram_notify: e.target.checked ? "true" : "false" })} className="w-4 h-4 rounded accent-indigo-500" />
          <span className="text-sm">Notificar por Telegram</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn btn-success">{saving ? "Guardando..." : "💾 Guardar"}</button>
        {saved && <span className="text-emerald-400 text-sm">✅ Guardado</span>}
      </div>
    </div>
  );
}
