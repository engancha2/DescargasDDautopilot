import { getDb, getAllConfig, logActivity } from "@/lib/db";

// Re-check if downloaded posts are now in Emby
export async function POST() {
  const config = getAllConfig();
  const db = getDb();

  // Get all posts that are downloaded but not in emby
  const posts = db.prepare(`
    SELECT * FROM scanned_posts WHERE status = 'downloaded' AND in_emby = 0
  `).all() as any[];

  if (posts.length === 0) {
    return Response.json({ checked: 0, foundInEmby: 0 });
  }

  let foundInEmby = 0;

  for (const post of posts) {
    // Clean title for Emby search
    const cleanTitle = post.title
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/T\d+|Temporada|Season/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 60);

    try {
      // Search Emby
      const res = await fetch(
        `${config.emby_url}/Items?api_key=${config.emby_api_key}&Recursive=true&SearchTerm=${encodeURIComponent(cleanTitle)}&Limit=5`
      );
      const data = await res.json();

      if (data.Items && data.Items.length > 0) {
        // Check if any result matches
        for (const item of data.Items) {
          const embyName = item.Name.toLowerCase().trim();
          const forumName = cleanTitle.toLowerCase().trim();
          if (embyName.includes(forumName) || forumName.includes(embyName)) {
            // Found in Emby! Update status
            db.prepare("UPDATE scanned_posts SET in_emby = 1 WHERE id = ?").run(post.id);
            foundInEmby++;
            logActivity("success", `Encontrado en Emby: ${post.title.substring(0, 50)}`);
            break;
          }
        }
      }
    } catch (e) {
      // Emby search failed, skip
    }
  }

  logActivity("info", `Verificación de Emby: ${posts.length} posts revisados, ${foundInEmby} encontrados`);
  return Response.json({ checked: posts.length, foundInEmby });
}
