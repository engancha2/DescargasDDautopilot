import { getDb, getAllConfig, logActivity } from "@/lib/db";
import { scanForumAllPages, getPostIdFromUrl } from "@/lib/scraper";

export async function POST() {
  try {
    const config = getAllConfig();
    const db = getDb();

    const libraries = db.prepare(`
      SELECT l.*, GROUP_CONCAT(f.url, '|||') as forum_urls
      FROM libraries l
      LEFT JOIN forum_urls f ON f.library_id = l.id
      WHERE l.enabled = 1
      GROUP BY l.id
    `).all() as any[];

    if (libraries.length === 0) {
      return Response.json({ error: "No hay bibliotecas activadas" }, { status: 400 });
    }

    let totalScanned = 0;

    for (const lib of libraries) {
      if (!lib.forum_urls) continue;
      const urls = lib.forum_urls.split("|||");

      for (const forumUrl of urls) {
        logActivity("scan", `Escaneando foro: ${forumUrl}`, `Biblioteca: ${lib.name}`);

        const posts = scanForumAllPages(forumUrl, lib.pages_to_scan || 5);

        for (const post of posts) {
          const postId = post.postId || getPostIdFromUrl(post.url);
          const postDbId = `post_${postId}`;

          // Verificar si ya existe ANTES de insertar
          const existing = db.prepare("SELECT id, status, gave_thanks, replied, sent_to_jdownloader, in_emby FROM scanned_posts WHERE id = ?").get(postDbId) as any;

          if (existing) {
            // Ya existe - NO sobrescribir el estado, solo actualizar el título y fecha de escaneo
            db.prepare(`
              UPDATE scanned_posts SET title = ?, scanned_at = datetime('now')
              WHERE id = ?
            `).run(post.title, postDbId);
          } else {
            // Nuevo - insertar con status 'new'
            db.prepare(`
              INSERT INTO scanned_posts (id, library_id, forum_url, post_url, title, post_id, status, in_emby, scanned_at)
              VALUES (?, ?, ?, ?, ?, ?, 'new', 0, datetime('now'))
            `).run(
              postDbId,
              lib.id,
              forumUrl,
              post.url,
              post.title,
              postId
            );
            totalScanned++;
          }
        }

        logActivity("scan", `Escaneo completado: ${posts.length} posts encontrados (${totalScanned} nuevos)`, `Biblioteca: ${lib.name}`);
      }
    }

    logActivity("success", `Escaneo completo: ${totalScanned} posts procesados`);
    return Response.json({ success: true, scanned: totalScanned });
  } catch (e) {
    logActivity("error", `Error en escaneo: ${(e as Error).message}`);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
