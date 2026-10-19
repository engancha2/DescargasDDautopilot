"use client";

import { useEffect, useState } from "react";

interface Library {
  id: string; emby_id: string; name: string; collection_type: string; paths: string;
  enabled: boolean; download_path: string; pages_to_scan: number; forumUrls: { id: string; url: string; name: string }[];
}

export default function BibliotecasPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try { const r = await fetch("/api/libraries"); setLibraries((await r.json()).libraries || []); } catch {}
    setLoading(false);
  }

  async function sync() { setLoading(true); await fetch("/api/libraries/sync", { method: "POST" }); await load(); }

  async function toggle(lib: Library) {
    await fetch("/api/libraries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lib, enabled: !lib.enabled }) });
    await load();
  }

  async function addForum(libraryId: string) {
    const url = newUrl[libraryId]; if (!url) return;
    await fetch("/api/forum-urls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ libraryId, url }) });
    setNewUrl({ ...newUrl, [libraryId]: "" }); await load();
  }

  async function delForum(id: string) { await fetch(`/api/forum-urls/${id}`, { method: "DELETE" }); await load(); }

  async function savePath(lib: Library) {
    await fetch("/api/libraries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lib) });
  }

  if (loading) return <div className="text-zinc-500 p-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bibliotecas</h1>
          <p className="text-sm text-zinc-500 mt-1">Activa las bibliotecas y asigna foros</p>
        </div>
        <button onClick={sync} className="btn btn-primary">🔄 Sincronizar</button>
      </div>

      {libraries.length === 0 && (
        <div className="card text-center">
          <p className="text-zinc-400 mb-4">No hay bibliotecas. Sincroniza desde Emby.</p>
          <button onClick={sync} className="btn btn-primary">Sincronizar</button>
        </div>
      )}

      {libraries.map((lib) => (
        <div key={lib.id} className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium">{lib.name}</h3>
              <span className="badge bg-[#1e1e22] text-zinc-400">{lib.collection_type}</span>
              {lib.enabled && <span className="badge bg-emerald-900/40 text-emerald-400">Activada</span>}
            </div>
            <button onClick={() => toggle(lib)} className={`btn ${lib.enabled ? "btn-danger" : "btn-success"}`}>
              {lib.enabled ? "Desactivar" : "Activar"}
            </button>
          </div>

          {lib.enabled && (
            <div className="mt-4 pt-4 border-t border-[#1e1e22] space-y-4">
              <div>
                <label className="label">Ruta de descarga (JDownloader)</label>
                <input className="input" placeholder="G:\Descargas\Peliculas" value={lib.download_path || ""}
                  onChange={(e) => setLibraries(prev => prev.map(l => l.id === lib.id ? { ...l, download_path: e.target.value } : l))}
                  onBlur={() => savePath(lib)} />
              </div>

              <div>
                <label className="label">Páginas a escanear</label>
                <input type="number" className="input !w-32" min={1} max={50} value={lib.pages_to_scan || 1}
                  onChange={(e) => setLibraries(prev => prev.map(l => l.id === lib.id ? { ...l, pages_to_scan: parseInt(e.target.value) || 1 } : l))}
                  onBlur={() => savePath(lib)} />
              </div>

              <div>
                <label className="label">Foros asignados</label>
                <div className="space-y-2">
                  {lib.forumUrls?.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <a href={f.url} target="_blank" className="text-sm text-indigo-400 hover:underline flex-1 truncate">{f.url}</a>
                      <button onClick={() => delForum(f.id)} className="text-zinc-500 hover:text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input type="url" className="input flex-1" placeholder="https://descargasdd.org/forumdisplay.php?f=..."
                      value={newUrl[lib.id] || ""} onChange={(e) => setNewUrl({ ...newUrl, [lib.id]: e.target.value })} />
                    <button onClick={() => addForum(lib.id)} className="btn btn-ghost">+ Añadir</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
