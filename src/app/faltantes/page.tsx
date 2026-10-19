"use client";

import { useEffect, useState } from "react";

interface Post { id: string; title: string; post_url: string; library_name: string; status: string; in_emby: boolean; scanned_at: string; }

export default function FaltantesPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => { load(); }, []);

  async function load() {
    try { const r = await fetch("/api/faltantes"); setPosts((await r.json()).posts || []); } catch {}
    setLoading(false);
  }

  async function scanNow() { setScanning(true); try { await fetch("/api/scan", { method: "POST" }); } catch {} setScanning(false); await load(); }
  async function processPost(id: string) { await fetch(`/api/process/${id}`, { method: "POST" }); await load(); }
  async function processAll() { await fetch("/api/process-all", { method: "POST" }); await load(); }
  async function deletePost(id: string) { await fetch(`/api/faltantes/${id}`, { method: "DELETE" }); await load(); }
  async function checkEmby() { try { await fetch("/api/check-emby", { method: "POST" }); } catch {} await load(); }
  
  // Mark uncertain post as "have it" or "don't have it"
  async function resolveUncertain(id: string, haveIt: boolean) {
    await fetch(`/api/process/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ haveIt }) });
    await load();
  }

  const filters = [
    { key: "all", label: "Todos" },
    { key: "new", label: "Pendientes" },
    { key: "uncertain", label: "⚠️ Verificar" },
    { key: "downloaded", label: "Descargados" },
    { key: "quarantine", label: "🔐 Cuarentena" },
    { key: "in_emby", label: "En Emby" },
    { key: "duplicate", label: "♻️ Duplicados" },
    { key: "done", label: "✅ Listos" },
  ];

  const filtered = posts.filter(p => {
    if (filter === "all") return true;
    if (filter === "new") return (p.status === "new" || p.status === "not_in_emby") && !p.in_emby;
    if (filter === "downloaded") return p.status === "downloaded";
    if (filter === "uncertain") return p.status === "uncertain";
    if (filter === "quarantine") return p.status === "quarantine";
    if (filter === "in_emby") return p.in_emby || p.status === "in_emby";
    if (filter === "duplicate") return p.status === "duplicate";
    if (filter === "done") return p.in_emby || p.status === "downloaded" || p.status === "in_emby" || p.status === "duplicate";
    return true;
  });

  if (loading) return <div className="text-zinc-500 p-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Faltantes</h1>
          <p className="text-sm text-zinc-500 mt-1">Contenido del foro que no tienes en Emby</p>
        </div>
        <div className="flex gap-2">
          <button onClick={scanNow} disabled={scanning} className="btn btn-primary">{scanning ? "🔍..." : "🔍 Escanear"}</button>
          <button onClick={checkEmby} className="btn btn-ghost">📺 Verificar Emby</button>
          <button onClick={processAll} className="btn btn-success">⬇️ Procesar todo</button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === f.key ? "bg-indigo-600 text-white" : "bg-[#111113] text-zinc-400 hover:bg-[#18181b]"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="card text-center text-zinc-500">No hay posts. Ejecuta un escaneo.</div>}
        {filtered.map((post) => (
          <div key={post.id} className="card !p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{post.title}</span>
                {post.in_emby && <span className="badge bg-emerald-900/40 text-emerald-400">En Emby</span>}
                {post.status === "downloaded" && <span className="badge bg-indigo-900/40 text-indigo-400">Descargado</span>}
                {post.status === "quarantine" && <span className="badge bg-orange-900/40 text-orange-400">🔐 Cuarentena</span>}
                {post.status === "uncertain" && <span className="badge bg-amber-900/40 text-amber-400">⚠️ Verificar</span>}
                {post.status === "new" && !post.in_emby && <span className="badge bg-zinc-800 text-zinc-400">Pendiente</span>}
                {post.in_emby && <span className="badge bg-emerald-900/40 text-emerald-400">✅ Listo</span>}
                {post.status === "downloaded" && !post.in_emby && <span className="badge bg-emerald-900/40 text-emerald-400">✅ Descargado</span>}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{post.library_name} · {new Date(post.scanned_at).toLocaleString()}</div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {/* Uncertain posts: show "La tengo" / "No la tengo" buttons */}
              {post.status === "uncertain" && (
                <>
                  <button onClick={() => resolveUncertain(post.id, true)} className="btn btn-success" title="Sí la tengo">✅ La tengo</button>
                  <button onClick={() => resolveUncertain(post.id, false)} className="btn btn-danger" title="No la tengo">❌ No la tengo</button>
                </>
              )}
              {/* Normal pending posts: show Process button */}
              {post.status === "new" && !post.in_emby && (
                <button onClick={() => processPost(post.id)} className="btn btn-success">Procesar</button>
              )}
              {/* Quarantine posts: show Find Alternatives */}
              {post.status === "quarantine" && !post.in_emby && (
                <a href={post.post_url} target="_blank" className="btn btn-ghost">🔗 Manual</a>
              )}
              <button onClick={() => deletePost(post.id)} className="btn btn-ghost" title="Eliminar">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
