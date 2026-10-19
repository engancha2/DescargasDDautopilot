import { getDb, getAllConfig, logActivity } from "@/lib/db";
import { giveThanks, extractDownloadLinks, replyToPost, navigateTo, getFirstPostId } from "@/lib/scraper";
import { addLinksToJD } from "@/lib/jdownloader";

const SERIES_REPLIES = ["gracias por la serie", "gracias por la serie!!!!", "muchas gracias por la serie", "gracias!!!!!"];
const MOVIE_REPLIES = ["gracias por la pelicula", "gracias por la pelicula!!!!", "muchas gracias por la pelicula", "gracias!!!!!"];

const BLOCKED_PROVIDERS = ["shorte.st", "adfly", "bc.vc", "linkshrink", "ouo.io", "t.me", "telegram.me", "telegram.org"];
const DIRECT_PROVIDERS = ["mega.", "nitroflare", "1fichier", "mediafire", "fileserve", "katfile", "uploady", "gofile", "megaup", "mixdrop", "qiwi", "dropbox", "drive.google", "ddownload", "pixeldrain"];

// Check if a title is in Emby - returns: "yes" | "no" | "uncertain"
async function checkInEmby(title: string, config: any): Promise<{ status: "yes" | "no" | "uncertain"; matches: any[] }> {
  const yearMatch = title.match(/\((\d{4})\)/);
  const forumYear = yearMatch ? yearMatch[1] : null;

  // Clean title - remove brackets, parens, quality info
  let cleanTitle = title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // For series: extract the base name without season/episode info
  // "The Walking Dead: Dead City T3" → "The Walking Dead Dead City"
  // "Operaciones especiales: Lioness T3" → "Operaciones especiales Lioness"
  const isSeries = /\bT\d+|Temporada|Season|Miniserie/i.test(title);
  let seasonNum: string | null = null;
  
  if (isSeries) {
    const seasonMatch = title.match(/\bT(\d+)/i);
    seasonNum = seasonMatch ? seasonMatch[1] : null;
    cleanTitle = cleanTitle
      .replace(/\bT\d+\b/i, '')
      .replace(/Temporada\s*\d+/i, '')
      .replace(/Season\s*\d+/i, '')
      .replace(/Miniserie/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  cleanTitle = cleanTitle.substring(0, 60);

  try {
    const res = await fetch(
      `${config.emby_url}/Items?api_key=${config.emby_api_key}&Recursive=true&SearchTerm=${encodeURIComponent(cleanTitle)}&Limit=10&Fields=ProductionYear,Path`
    );
    const data = await res.json();

    if (!data.Items || data.Items.length === 0) {
      return { status: "no", matches: [] };
    }

    const forumName = cleanTitle.toLowerCase().trim();
    const matches: any[] = [];

    for (const item of data.Items) {
      const embyName = item.Name.toLowerCase().trim();
      const embyYear = item.ProductionYear ? String(item.ProductionYear) : null;

      // For series: don't require year match (series span multiple years)
      // For movies: require year match
      const yearOk = isSeries ? true : (forumYear && embyYear ? forumYear === embyYear : true);

      if (!yearOk) continue;

      // Name matching
      if (embyName === forumName) {
        return { status: "yes", matches: [{ name: item.Name, year: embyYear, reason: "exact match" }] };
      }
      if (forumName.length >= 5 && (embyName.startsWith(forumName) || forumName.startsWith(embyName))) {
        return { status: "yes", matches: [{ name: item.Name, year: embyYear, reason: "name starts with" }] };
      }
      // Word overlap for different languages
      const forumWords = forumName.split(/\s+/).filter((w: string) => w.length >= 4);
      const embyWords = embyName.split(/\s+/).filter((w: string) => w.length >= 4);
      const wordMatches = forumWords.filter((w: string) => embyWords.some((ew: string) => ew === w)).length;
      if (wordMatches >= 2 || (wordMatches >= 1 && forumWords.length <= 2)) {
        // For series with season number, check if the path contains the season
        if (isSeries && seasonNum && item.Path) {
          const pathLower = item.Path.toLowerCase();
          if (pathLower.includes(`season ${seasonNum}`) || pathLower.includes(`temporada ${seasonNum}`) || pathLower.includes(`s${seasonNum.padStart(2, '0')}`)) {
            return { status: "yes", matches: [{ name: item.Name, year: embyYear, reason: `word overlap + season ${seasonNum} in path` }] };
          }
          // Word overlap but season not in path - still mark as yes for series
          return { status: "yes", matches: [{ name: item.Name, year: embyYear, reason: "word overlap (series)" }] };
        }
        return { status: "yes", matches: [{ name: item.Name, year: embyYear, reason: "word overlap" }] };
      }
      // Year matches but name doesn't
      if (!isSeries && forumYear && embyYear && forumYear === embyYear) {
        matches.push({ name: item.Name, year: embyYear, reason: "year match only" });
      }
    }

    // If we have year matches but no name match, it's uncertain
    if (matches.length > 0) {
      return { status: "uncertain", matches };
    }

    return { status: "no", matches: [] };
  } catch {
    return { status: "no", matches: [] };
  }
}

// Check if a post is a duplicate of an already downloaded series
function checkDuplicateSeries(db: any, title: string, currentId: string): boolean {
  // Extract base title without quality/season info
  const baseTitle = title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\bT\d+\b/i, '')
    .replace(/Temporada\s*\d+/i, '')
    .replace(/Season\s*\d+/i, '')
    .replace(/Miniserie/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (baseTitle.length < 5) return false;

  // Look for other posts with the same base title that are already downloaded
  const existing = db.prepare(`
    SELECT id, title, status, sent_to_jdownloader FROM scanned_posts 
    WHERE library_id IN (SELECT id FROM libraries WHERE collection_type = 'tvshows')
    AND id != ?
    AND sent_to_jdownloader = 1
  `).all(currentId) as any[];

  for (const post of existing) {
    const existingBase = post.title
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\bT\d+\b/i, '')
      .replace(/Temporada\s*\d+/i, '')
      .replace(/Season\s*\d+/i, '')
      .replace(/Miniserie/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    if (existingBase === baseTitle) {
      return true; // Duplicate found
    }
  }
  
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getAllConfig();
  const db = getDb();

  const post = db.prepare("SELECT * FROM scanned_posts WHERE id = ?").get(id) as any;
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  // CHECK 1: Already in Emby (from BD)?
  if (post.in_emby) {
    return Response.json({ skipped: true, reason: "Already in Emby" });
  }

  // CHECK 2: Already downloaded?
  if (post.sent_to_jdownloader) {
    return Response.json({ skipped: true, reason: "Already sent to JDownloader" });
  }

  // CHECK 3: If user already said "I don't have it", skip Emby check and go straight to download
  const userVerifiedNotInEmby = post.status === 'not_in_emby';

  // CHECK 3.5: Duplicate series - if we already downloaded the same series from another post
  const library = db.prepare("SELECT * FROM libraries WHERE id = ?").get(post.library_id) as any;
  const isSeries = library?.collection_type === "tvshows";
  
  if (isSeries && checkDuplicateSeries(db, post.title, id)) {
    db.prepare("UPDATE scanned_posts SET status = 'duplicate', in_emby = 1 WHERE id = ?").run(id);
    logActivity("info", `⏭️ Serie duplicada (ya descargada de otro post): ${post.title.substring(0, 50)}`);
    return Response.json({ skipped: true, reason: "Serie duplicada - ya descargada de otro post" });
  }

  // CHECK 4: Real-time Emby verification (skip if user already verified)
  if (!userVerifiedNotInEmby) {
    logActivity("info", `Verificando en Emby: ${post.title.substring(0, 50)}`);
    const embyResult = await checkInEmby(post.title, config);

    if (embyResult.status === "yes") {
      db.prepare("UPDATE scanned_posts SET in_emby = 1, status = 'in_emby' WHERE id = ?").run(id);
      logActivity("success", `Ya está en Emby: ${post.title.substring(0, 50)}`, JSON.stringify(embyResult.matches));
      return Response.json({ skipped: true, reason: "Found in Emby" });
    }

    if (embyResult.status === "uncertain") {
      db.prepare("UPDATE scanned_posts SET status = 'uncertain' WHERE id = ?").run(id);
      logActivity("info", `⚠️ Verificar manualmente: ${post.title.substring(0, 50)}`, JSON.stringify(embyResult.matches));
      return Response.json({
        uncertain: true,
        reason: "Posible coincidencia en Emby - requiere verificación",
        matches: embyResult.matches,
      });
    }
  } else {
    logActivity("info", `⏭️ Sin verificar Emby (usuario confirmó que no la tiene): ${post.title.substring(0, 50)}`);
  }

  // library and isSeries already declared above

  try {
    // Step 1: Navigate to the post
    logActivity("scan", `Navegando al post: ${post.title.substring(0, 50)}`);
    navigateTo(post.post_url);

    // Step 2: Get post ID
    const firstPostId = getFirstPostId();
    if (!firstPostId) {
      logActivity("error", `No se encontró el post ID: ${post.title.substring(0, 50)}`);
      return Response.json({ error: "No post ID found" }, { status: 500 });
    }

    // Step 3: Give thanks (verify by post_url to avoid duplicates across re-scans)
    if (!post.gave_thanks) {
      // Check if we already gave thanks on this post_url (in case of re-scan)
      const existing = db.prepare("SELECT id FROM scanned_posts WHERE post_url = ? AND gave_thanks = 1 AND id != ?").get(post.post_url, id) as any;
      if (existing) {
        logActivity("info", `⏭️ Ya se dio gracias en este post antes: ${post.title.substring(0, 50)}`);
        db.prepare("UPDATE scanned_posts SET gave_thanks = 1 WHERE id = ?").run(id);
      } else {
        logActivity("thanks", `Dando gracias: ${post.title.substring(0, 50)}`);
        if (giveThanks(firstPostId)) {
          db.prepare("UPDATE scanned_posts SET gave_thanks = 1 WHERE id = ?").run(id);
        }
      }
    }

    // Step 4: Copy content
    logActivity("download", `Copiando contenido: ${post.title.substring(0, 50)}`);
    const links = extractDownloadLinks(firstPostId);
    const allContent = links.length > 0 ? links.map((l: any) => l.url).join(" ") : "";

    if (links.length > 0) {
      db.prepare("UPDATE scanned_posts SET download_links = ?, status = 'links_extracted' WHERE id = ?")
        .run(JSON.stringify(links), id);
    }

    // Step 5: Check for blocked providers
    const hasBlocked = BLOCKED_PROVIDERS.some(p => allContent.toLowerCase().includes(p));
    const hasDirect = DIRECT_PROVIDERS.some(p => allContent.toLowerCase().includes(p));

    if (hasBlocked && !hasDirect) {
      db.prepare("UPDATE scanned_posts SET status = 'quarantine' WHERE id = ?").run(id);
      logActivity("info", `🔐 Cuarentena: ${post.title.substring(0, 50)}`, "Enlaces protegidos");
      return Response.json({ quarantined: true, reason: "Enlaces protegidos" });
    }

    // Step 6: Reply (verify by post_url to avoid duplicates)
    if (!post.replied) {
      const existingReply = db.prepare("SELECT id FROM scanned_posts WHERE post_url = ? AND replied = 1 AND id != ?").get(post.post_url, id) as any;
      if (existingReply) {
        logActivity("info", `⏭️ Ya se comentó en este post antes: ${post.title.substring(0, 50)}`);
        db.prepare("UPDATE scanned_posts SET replied = 1 WHERE id = ?").run(id);
      } else {
        const replies = isSeries ? SERIES_REPLIES : MOVIE_REPLIES;
        const reply = replies[Math.floor(Math.random() * replies.length)];
        logActivity("reply", `Respondiendo: ${post.title.substring(0, 50)}`);
        if (replyToPost(firstPostId, reply)) {
          db.prepare("UPDATE scanned_posts SET replied = 1 WHERE id = ?").run(id);
        }
      }
    }

    // Step 7: Send to JDownloader
    if (links.length > 0 && config.jd_email && config.jd_password) {
      const downloadPath = library?.download_path || "";

      let packageName = post.title.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
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

      logActivity("download", `Enviando a JDownloader: ${packageName}`);

      const jdResult = await addLinksToJD(config.jd_email, config.jd_password, linksText, fullDownloadPath, packageName);

      if (jdResult.success) {
        logActivity("success", `Enviado a JDownloader: ${packageName}`);
        db.prepare("UPDATE scanned_posts SET status = 'downloaded', sent_to_jdownloader = 1 WHERE id = ?").run(id);
        db.prepare("INSERT OR REPLACE INTO downloads (id, post_url, title, library_id, links, status) VALUES (?, ?, ?, ?, ?, 'pending')")
          .run(`dl_${id}`, post.post_url, post.title, post.library_id, JSON.stringify(links));
      } else {
        logActivity("error", `Error JDownloader: ${jdResult.error}`);
      }
    }

    return Response.json({ success: true, links: links.length });
  } catch (e) {
    logActivity("error", `Error procesando post: ${(e as Error).message}`);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PUT endpoint to mark uncertain posts as "yes I have it" or "no I don't"
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  if (body.haveIt) {
    // "La tengo" → marcar como en Emby, NO se procesa más
    db.prepare("UPDATE scanned_posts SET in_emby = 1, status = 'in_emby' WHERE id = ?").run(id);
    logActivity("info", `✅ Marcado como en Emby por usuario: ${id}`);
  } else {
    // "No la tengo" → marcar como 'not_in_emby' para que procese SIN volver a verificar
    db.prepare("UPDATE scanned_posts SET in_emby = 0, status = 'not_in_emby' WHERE id = ?").run(id);
    logActivity("info", `❌ Marcado como NO en Emby por usuario: ${id} - listo para procesar`);
  }

  return Response.json({ success: true });
}
