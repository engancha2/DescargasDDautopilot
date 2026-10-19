import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DescargasDD Manager",
  description: "Gestión automática de descargas desde DescargasDD para Emby",
};

const navLinks = [
  { href: "/", icon: "📊", label: "Dashboard" },
  { href: "/bibliotecas", icon: "📚", label: "Bibliotecas" },
  { href: "/faltantes", icon: "🔍", label: "Faltantes" },
  { href: "/descargas", icon: "⬇️", label: "Descargas" },
  { href: "/log", icon: "📋", label: "Actividad" },
  { href: "/config", icon: "⚙️", label: "Config" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[#0a0a0b] text-zinc-100 antialiased">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 bg-[#0d0d0e] border-r border-[#1e1e22] z-40 flex-col">
          <div className="px-5 py-5 border-b border-[#1e1e22]">
            <span className="text-base font-semibold tracking-tight">🎬 DescargasDD</span>
          </div>
          <nav className="flex-1 p-3 space-y-0.5">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="nav-link">
                <span className="text-base">{l.icon}</span>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="p-3 border-t border-[#1e1e22]">
            <div className="flex items-center gap-2 text-xs text-zinc-500 px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Sistema activo
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="lg:ml-60">
          {/* Top nav bar - inside content area, no overlap */}
          <header className="sticky top-0 z-30 bg-[#0a0a0b] border-b border-[#1e1e22]">
            <div className="flex items-center gap-1 px-4 py-2.5 overflow-x-auto">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="nav-link whitespace-nowrap">
                  <span className="text-sm">{l.icon}</span>
                  <span className="hidden sm:inline">{l.label}</span>
                </a>
              ))}
            </div>
          </header>

          {/* Page content */}
          <main className="p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6 fade-in">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
