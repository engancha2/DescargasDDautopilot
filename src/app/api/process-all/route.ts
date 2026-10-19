import { getDb, getAllConfig, logActivity } from "@/lib/db";
import { giveThanks, extractDownloadLinks, replyToPost, navigateTo, getFirstPostId } from "@/lib/scraper";
import { addLinksToJD } from "@/lib/jdownloader";

const SERIES_REPLIES = ["gracias por la serie", "gracias por la serie!!!!", "muchas gracias por la serie", "gracias!!!!!"];
const MOVIE_REPLIES = ["gracias por la pelicula", "gracias por la pelicula!!!!", "muchas gracias por la pelicula", "gracias!!!!!"];

const BLOCKED_PROVIDERS = ["shorte.st", "adfly", "bc.vc", "linkshrink", "ouo.io", "t.me", "telegram.me", "telegram.org"];
const DIRECT_PROVIDERS = ["mega.", "nitroflare", "1fichier", "mediafire", "fileserve", "katfile", "uploady", "gofile", "megaup", "mixdrop", "qiwi", "dropbox", "drive.google", "ddownload", "pixeldrain"];

async function checkInEmby(title: string, config: any): Promise<"yes" | "no" | "uncertain"> {
  const yearMatch = title.match(/\((\d{4})\)/);
  const forumYear = yearMatch ? yearMatch[1] : null;
  
  let cleanTitle = title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  const isSeries = /\bT\d+|Temporada|Season|Miniserie/i.test(title);
  let seasonNum: string | null = null;
  
  if (isSeries) {
    const seasonMatch = title.match(/\bT(\d+)/i);
    seasonNum = seasonMatch ? seasonMatch[1] : null;
    cleanTitle = cleanTitle.replace(/\bT\d+\b/i, '').replace(/Temporada\s*\d+/i, '').replace(/Season\s*\d+/i, '').replace(/Miniserie/i, '').replace(/\s+/g, ' ').trim();
  }
  cleanTitle = cleanTitle.substring(0, 60);

  try {
    const res = await fetch(`${config.emby_url}/Items?api_key=${config.emby_api_key}&Recursive=true&SearchTerm=${encodeURIComponent(cleanTitle)}&Limit=10&Fields=ProductionYear,Path`);
    const data = await res.json();
    if (!data.Items || data.Items.length === 0) return "no";

    const forumName = cleanTitle.toLowerCase().trim();
    for (const item of data.Items) {
      const embyName = item.Name.toLowerCase().trim();
      const embyYear = item.ProductionYear ? String(item.ProductionYear) : null;
      const yearOk = isSeries ? true : (forumYear && embyYear ? forumYear === embyYear : true);
      if (!yearOk) continue;
      if (embyName === forumName) return "yes";
      if (forumName.length >= 5 && (embyName.startsWith(forumName) || forumName.startsWith(embyName))) return "yes";
      const forumWords = forumName.split(/\s+/).filter((w: string) => w.length >= 4);
      const embyWords = embyName.split(/\s+/).filter((w: string) => w.length >= 4);
      const wordMatches = forumWords.filter((w: string) => embyWords.some((ew: string) => ew === w)).length;
      if (wordMatches >= 2 || (wordMatches >= 1 && forumWords.length <= 2)) return "yes";
      if (!isSeries && forumYear && embyYear && forumYear === embyYear) return "uncertain";
    }
    return "no";
  } catch {
    return "no";
  }
}

// Check if a post is a duplicate of an already downloaded series
function checkDuplicateSeries(db: any, title: string, currentId: string): boolean {
  const baseTitle = title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/\bT\d+\b/i, '').replace(/Temporada\s*\d+/i, '').replace(/Season\s*\d+/i, '').replace(/Miniserie/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (baseTitle.length < 5) return false;
  const existing = db.prepare("SELECT id, title FROM scanned_posts WHERE library_id IN (SELECT id FROM libraries WHERE collection_type = 'tvshows') AND id != ? AND sent_to_jdownloader = 1").all(currentId) as any[];
  for (const post of existing) {
    const existingBase = post.title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/\bT\d+\b/i, '').replace(/Temporada\s*\d+/i, '').replace(/Season\s*\d+/i, '').replace(/Miniserie/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (existingBase === baseTitle) return true;
  }
  return false;
}

export async function POST() {
  const config = getAllConfig();
  const db = getDb();

  const posts = db.prepare(`
    SELECT sp.*, l.name as library_name, l.collection_type, l.download_path
    FROM scanned_posts sp
    JOIN libraries l ON l.id = sp.library_id
    WHERE (sp.status = 'new' OR sp.status = 'not_in_emby') AND sp.in_emby = 0 AND sp.sent_to_jdownloader = 0
    ORDER BY sp.scanned_at ASC
  `).all() as any[];

  if (posts.length === 0) {
    return Response.json({ message: "No hay posts pendientes" });
  }

  logActivity("info", `Procesando ${posts.length} posts pendientes`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      // Si el usuario ya dijo "no la tengo", saltar verificación Emby
      const userVerifiedNotInEmby = post.status === 'not_in_emby';
      
      if (!userVerifiedNotInEmby) {
        // Check Emby first
        const embyStatus = await checkInEmby(post.title, config);
        if (embyStatus === "yes") {
          db.prepare("UPDATE scanned_posts SET in_emby = 1, status = 'in_emby' WHERE id = ?").run(post.id);
          logActivity("info", `Ya en Emby, saltando: ${post.title.substring(0, 50)}`);
          skipped++;
          continue;
        }
        if (embyStatus === "uncertain") {
          db.prepare("UPDATE scanned_posts SET status = 'uncertain' WHERE id = ?").run(post.id);
          logActivity("info", `Requiere verificación: ${post.title.substring(0, 50)}`);
          skipped++;
          continue;
        }
      } else {
        logActivity("info", `⏭️ Sin verificar Emby (usuario confirmó): ${post.title.substring(0, 50)}`);
      }

      // Check duplicate series
      const isSeries = post.collection_type === "tvshows";
      if (isSeries && checkDuplicateSeries(db, post.title, post.id)) {
        db.prepare("UPDATE scanned_posts SET status = 'duplicate', in_emby = 1 WHERE id = ?").run(post.id);
        logActivity("info", `⏭️ Serie duplicada: ${post.title.substring(0, 50)}`);
        skipped++;
        continue;
      }

      // Navigate to post
      logActivity("scan", `Procesando: ${post.title.substring(0, 50)}`);
      navigateTo(post.post_url);

      const firstPostId = getFirstPostId();
      if (!firstPostId) {
        logActivity("error", `No post ID: ${post.title.substring(0, 50)}`);
        errors++;
        continue;
      }

      // Give thanks (verify by post_url to avoid duplicates)
      if (!post.gave_thanks) {
        const existing = db.prepare("SELECT id FROM scanned_posts WHERE post_url = ? AND gave_thanks = 1 AND id != ?").get(post.post_url, post.id) as any;
        if (existing) {
          logActivity("info", `⏭️ Ya gracias: ${post.title.substring(0, 50)}`);
          db.prepare("UPDATE scanned_posts SET gave_thanks = 1 WHERE id = ?").run(post.id);
        } else {
          logActivity("thanks", `Gracias: ${post.title.substring(0, 50)}`);
          if (giveThanks(firstPostId)) {
            db.prepare("UPDATE scanned_posts SET gave_thanks = 1 WHERE id = ?").run(post.id);
          }
        }
      }

      // Copy content
      const links = extractDownloadLinks(firstPostId);
      const allContent = links.length > 0 ? links.map((l: any) => l.url).join(" ") : "";

      if (links.length > 0) {
        db.prepare("UPDATE scanned_posts SET download_links = ?, status = 'links_extracted' WHERE id = ?").run(JSON.stringify(links), post.id);
      }

      // Check blocked providers
      const hasBlocked = BLOCKED_PROVIDERS.some(p => allContent.toLowerCase().includes(p));
      const hasDirect = DIRECT_PROVIDERS.some(p => allContent.toLowerCase().includes(p));

      if (hasBlocked && !hasDirect) {
        db.prepare("UPDATE scanned_posts SET status = 'quarantine' WHERE id = ?").run(post.id);
        logActivity("info", `Cuarentena: ${post.title.substring(0, 50)}`);
        skipped++;
        continue;
      }

      // Reply (verify by post_url to avoid duplicates)
      if (!post.replied) {
        const existingReply = db.prepare("SELECT id FROM scanned_posts WHERE post_url = ? AND replied = 1 AND id != ?").get(post.post_url, post.id) as any;
        if (existingReply) {
          logActivity("info", `⏭️ Ya comentado: ${post.title.substring(0, 50)}`);
          db.prepare("UPDATE scanned_posts SET replied = 1 WHERE id = ?").run(post.id);
        } else {
          const replies = isSeries ? SERIES_REPLIES : MOVIE_REPLIES;
          const reply = replies[Math.floor(Math.random() * replies.length)];
          logActivity("reply", `Respondiendo: ${post.title.substring(0, 50)}`);
          if (replyToPost(firstPostId, reply)) {
            db.prepare("UPDATE scanned_posts SET replied = 1 WHERE id = ?").run(post.id);
          }
        }
      }

      // Send to JDownloader
      if (links.length > 0 && config.jd_email && config.jd_password) {
        const downloadPath = post.download_path || "";
        let packageName = post.title.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
        // Remove invalid Windows folder characters: : * ? " < > | /
        packageName = packageName.replace(/[:*?"<>|/\\]/g, " ").replace(/\s+/g, " ").trim();
        if (isSeries) {
          let seasonMatch = post.title.match(/T(\d+)/i);
          let season = seasonMatch ? ` T${seasonMatch[1]}` : "";
          let name = packageName.replace(/T\d+/i, "").replace(/Temporada\s*\d+/i, "").trim();
          packageName = `${name}${season} - Serie`;
        } else {
          packageName = `${packageName} - Pelicula`;
        }
        const fullDownloadPath = downloadPath ? `${downloadPath}\\${packageName}` : packageName;
        const linksText = links.map((l: any) => typeof l === "string" ? l : l.url).filter((l: any) => l).join("\n");

        logActivity("download", `Enviando a JD: ${packageName}`);
        const jdResult = await addLinksToJD(config.jd_email, config.jd_password, linksText, fullDownloadPath, packageName);

        if (jdResult.success) {
          logActivity("success", `Descargado: ${packageName}`);
          db.prepare("UPDATE scanned_posts SET status = 'downloaded', sent_to_jdownloader = 1 WHERE id = ?").run(post.id);
          db.prepare("INSERT OR REPLACE INTO downloads (id, post_url, title, library_id, links, status) VALUES (?, ?, ?, ?, ?, 'pending')").run(`dl_${post.id}`, post.post_url, post.title, post.library_id, JSON.stringify(links));
          processed++;
        } else {
          logActivity("error", `Error JD: ${jdResult.error}`);
          errors++;
        }
      }

      // Wait 30 seconds between posts (forum rule)
      if (processed + skipped + errors < posts.length) {
        logActivity("info", `Esperando 30 segundos...`);
        await new Promise(r => setTimeout(r, 30000));
      }
    } catch (e) {
      errors++;
      logActivity("error", `Error: ${post.title.substring(0, 50)} - ${(e as Error).message}`);
    }
  }

  logActivity("success", `Completo: ${processed} descargados, ${skipped} saltados, ${errors} errores`);
  return Response.json({ success: true, processed, skipped, errors });
}
