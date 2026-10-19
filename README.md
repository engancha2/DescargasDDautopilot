# 🎬 DescargasDD Manager

App web para automatizar la descarga de películas y series desde descargasdd.org hacia tu servidor Emby.

## 🚀 Inicio rápido

```bash
cd /Users/xavi/Projects/descargasdd-manager
npm run dev -- --port 3001
```

Abrir: http://localhost:3001

## ⚙️ Configuración inicial

1. **Configuración** → Introduce URL de Emby y API Key
2. **Bibliotecas** → Sincronizar desde Emby → Activar las que quieras
3. Asignar URLs del foro a cada biblioteca activada
4. **Faltantes** → Escanear ahora
5. Procesar los posts faltantes (gracias + respuesta + descarga)

## 📋 Requisitos

- Chrome con "Permitir JavaScript desde Apple Events" activado
- Sesión iniciada en descargasdd.org
- Emby Media Server
- JDownloader (opcional, para descargas automáticas)
- Python 3 con `myjdapi` instalado (`pip3 install myjdapi`)

## 🏗️ Arquitectura

- **Frontend:** Next.js 16 + React 19 + Tailwind CSS
- **BD:** SQLite (better-sqlite3)
- **Scraping:** AppleScript + JavaScript en Chrome
- **Emby API:** REST (solo lectura)
- **JDownloader API:** my.jdapi (Python)

## 📁 Estructura

```
src/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── bibliotecas/page.tsx  # Gestión bibliotecas
│   ├── faltantes/page.tsx    # Posts faltantes
│   ├── descargas/page.tsx    # Monitoreo descargas
│   ├── log/page.tsx          # Log de actividad
│   ├── config/page.tsx       # Configuración
│   └── api/                  # API routes
├── lib/
│   ├── db.ts                 # SQLite
│   ├── emby.ts               # Emby API client
│   ├── jdownloader.ts        # JDownloader API
│   └── scraper.ts            # Chrome scraping
```

## ⚠️ Reglas del foro

- 30 segundos mínimo entre mensajes
- Mínimo 10 caracteres por mensaje
- Dar gracias antes de descargar
- Responder con mensaje variado
