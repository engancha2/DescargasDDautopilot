import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const downloads = db.prepare(`
    SELECT d.*, l.name as library_name
    FROM downloads d
    LEFT JOIN libraries l ON l.id = d.library_id
    ORDER BY d.created_at DESC
  `).all();
  return Response.json({ downloads });
}
