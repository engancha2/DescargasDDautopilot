import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const posts = db.prepare(`
    SELECT sp.*, l.name as library_name
    FROM scanned_posts sp
    LEFT JOIN libraries l ON l.id = sp.library_id
    ORDER BY 
      CASE sp.status 
        WHEN 'uncertain' THEN 0 
        WHEN 'new' THEN 1 
        WHEN 'quarantine' THEN 2 
        WHEN 'links_extracted' THEN 3 
        WHEN 'downloaded' THEN 4 
        ELSE 5 
      END,
      sp.scanned_at DESC
    LIMIT 500
  `).all() as any[];

  return Response.json({
    posts: posts.map(p => ({
      id: p.id,
      title: p.title,
      post_url: p.post_url,
      library_name: p.library_name || "N/A",
      status: p.status,
      in_emby: p.in_emby === 1,
      scanned_at: p.scanned_at,
    })),
  });
}
