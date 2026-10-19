import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "descargasdd.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS libraries (
      id TEXT PRIMARY KEY,
      emby_id TEXT,
      name TEXT NOT NULL,
      collection_type TEXT,
      paths TEXT,
      download_path TEXT DEFAULT '',
      pages_to_scan INTEGER DEFAULT 1,
      enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS forum_urls (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL,
      url TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scanned_posts (
      id TEXT PRIMARY KEY,
      library_id TEXT,
      forum_url TEXT,
      post_url TEXT,
      title TEXT,
      post_id TEXT,
      status TEXT DEFAULT 'new',
      gave_thanks INTEGER DEFAULT 0,
      replied INTEGER DEFAULT 0,
      download_links TEXT,
      sent_to_jdownloader INTEGER DEFAULT 0,
      in_emby INTEGER DEFAULT 0,
      scanned_at TEXT DEFAULT (datetime('now')),
      UNIQUE(post_url)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      message TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      post_url TEXT,
      title TEXT,
      library_id TEXT,
      links TEXT,
      status TEXT DEFAULT 'pending',
      progress REAL DEFAULT 0,
      jdownloader_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);
}

export function getConfig(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);
}

export function getAllConfig(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM config").all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export function logActivity(type: string, message: string, details?: string) {
  const db = getDb();
  db.prepare("INSERT INTO activity_log (type, message, details) VALUES (?, ?, ?)").run(type, message, details ?? null);
}
