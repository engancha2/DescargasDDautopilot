import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const libraries = db.prepare("SELECT * FROM libraries").all() as any[];

  const result = libraries.map(lib => {
    const forumUrls = db.prepare("SELECT * FROM forum_urls WHERE library_id = ?").all(lib.id) as any[];
    return {
      ...lib,
      enabled: lib.enabled === 1,
      download_path: lib.download_path || "",
      forumUrls: forumUrls.map(f => ({ id: f.id, url: f.url, name: f.name })),
    };
  });

  return Response.json({ libraries: result });
}

export async function POST(request: Request) {
  const body = await request.json();
  const db = getDb();

  // Only update the fields that are provided, don't replace the whole row
  // This preserves download_path and other fields when just toggling enabled
  const existing = db.prepare("SELECT * FROM libraries WHERE id = ?").get(body.id) as any;

  if (existing) {
    // Update existing - only change fields that are in the body
    db.prepare(`
      UPDATE libraries SET
        enabled = ?,
        download_path = ?,
        pages_to_scan = ?,
        name = ?,
        collection_type = ?,
        paths = ?,
        emby_id = ?
      WHERE id = ?
    `).run(
      body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
      body.download_path !== undefined ? body.download_path : (existing.download_path || ""),
      body.pages_to_scan !== undefined ? body.pages_to_scan : (existing.pages_to_scan || 1),
      body.name || existing.name,
      body.collection_type || existing.collection_type,
      body.paths || existing.paths,
      body.emby_id || existing.emby_id,
      body.id
    );
  } else {
    // Insert new
    db.prepare(`
      INSERT INTO libraries (id, emby_id, name, collection_type, paths, download_path, pages_to_scan, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.id,
      body.emby_id || "",
      body.name,
      body.collection_type || "",
      body.paths || "",
      body.download_path || "",
      body.pages_to_scan || 1,
      body.enabled ? 1 : 0
    );
  }

  return Response.json({ success: true });
}
