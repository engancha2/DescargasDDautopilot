import { getDb, getAllConfig, logActivity } from "@/lib/db";
import { navigateTo, scanForumPage, giveThanks, extractDownloadLinks, replyToPost, getFirstPostId } from "@/lib/scraper";
import { addLinksToJD } from "@/lib/jdownloader";
import { execSync } from "child_process";

const SERIES_REPLIES = ["gracias por la serie", "gracias por la serie!!!!", "muchas gracias por la serie", "gracias!!!!!"];

// Direct download providers that JDownloader can handle
const DIRECT_PROVIDERS = ["mega.", "nitroflare", "1fichier", "mediafire", "fileserve", "katfile", "uploady", "gofile", "megaup", "mixdrop", "qiwi", "pixeldrain"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getAllConfig();
  const db = getDb();

  const post = db.prepare("SELECT * FROM scanned_posts WHERE id = ?").get(id) as any;
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  // Clean title for search
  const coreName = post.title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/T\d+/i, '')
    .replace(/Temporada\s*\d+/i, '')
    .replace(/Miniserie/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  logActivity("scan", `Buscando alternativas h265 para: ${coreName}`);

  // Search in the h265 forum sections specifically
  // f=105 = Temporadas Completas en x265 (series)
  // f=250 = Estrenos Películas h265 (peliculas)
  const isSeries = post.library_id.includes("series");
  const h265ForumUrl = isSeries
    ? "https://descargasdd.org/forumdisplay.php?f=105"
    : "https://descargasdd.org/forumdisplay.php?f=250";

  // Use the forum search restricted to the h265 section
  const searchUrl = `https://descargasdd.org/search.php?do=process&query=${encodeURIComponent(coreName)}&titleonly=1&forumchoice[]=${isSeries ? "105" : "250"}`;

  logActivity("scan", `Buscando en foro h265: ${searchUrl}`);
  navigateTo(searchUrl);

  // Wait for page to load
  const results = scanForumPage(searchUrl);

  // Filter results that match the title AND contain h265/x265
  const alternatives = results.filter(r => {
    const rName = r.title.toLowerCase();
    const pName = coreName.toLowerCase();
    const matches = rName.includes(pName) || pName.includes(rName);
    const isH265 = /x265|h265|h\.265|hevc/i.test(r.title);
    return matches && isH265;
  });

  logActivity("info", `Encontradas ${alternatives.length} alternativas h265 para: ${coreName}`);

  if (alternatives.length === 0) {
    logActivity("error", `No se encontraron alternativas h265 para: ${coreName}`);
    return Response.json({ success: false, reason: "No h265 alternatives found" });
  }

  // Try each alternative until we find one with direct download links
  for (const alt of alternatives) {
    if (alt.postId === post.post_id) continue;

    logActivity("scan", `Probando alternativa: ${alt.title}`);
    navigateTo(alt.url);

    // Get post ID
    const firstPostId = getFirstPostId();
    if (!firstPostId) {
      logActivity("error", `No se encontró post ID en alternativa: ${alt.title}`);
      continue;
    }

    // Give thanks
    logActivity("thanks", `Dando gracias: ${alt.title}`);
    const thanksGiven = giveThanks(firstPostId);
    if (thanksGiven) {
      logActivity("success", `Gracias dada: ${alt.title}`);
    }

    // Extract links
    const links = extractDownloadLinks(firstPostId);
    const allContent = links.length > 0 ? links.map((l: any) => l.url).join(" ") : "";

    if (links.length === 0) {
      logActivity("error", `No se pudieron extraer enlaces: ${alt.title}`);
      continue;
    }

    // Check if this has direct links (not just keeplinks/telegram)
    const hasDirect = DIRECT_PROVIDERS.some(p => allContent.toLowerCase().includes(p));
    const hasBlocked = /keeplinks|t\.me|telegram|shorte|adfly|bc\.vc/.test(allContent);

    if (!hasDirect || hasBlocked) {
      logActivity("info", `Alternativa también tiene enlaces protegidos: ${alt.title}`);
      continue;
    }

    // Good alternative found! Reply to the post
    logActivity("reply", `Respondiendo: ${alt.title}`);
    const reply = SERIES_REPLIES[Math.floor(Math.random() * SERIES_REPLIES.length)];
    const replied = replyToPost(firstPostId, reply);
    if (replied) {
      logActivity("success", `Respuesta publicada: ${alt.title}`);
    }

    // Send to JDownloader
    const library = db.prepare("SELECT * FROM libraries WHERE id = ?").get(post.library_id) as any;
    const downloadPath = library?.download_path || "";

    let packageName = alt.title.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
    packageName = packageName.replace(/[:*?"<>|/\\]/g, " ").replace(/\s+/g, " ").trim();
    if (isSeries) {
      let seasonMatch = alt.title.match(/T(\d+)/i);
      let season = seasonMatch ? ` T${seasonMatch[1]}` : "";
      let name = packageName.replace(/T\d+/i, "").replace(/Temporada\s*\d+/i, "").trim();
      packageName = `${name}${season} - Serie`;
    } else {
      packageName = `${packageName} - Pelicula`;
    }

    const fullDownloadPath = downloadPath ? `${downloadPath}\\${packageName}` : packageName;
    const linksText = links.map((l: any) => typeof l === "string" ? l : l.url).filter((l: any) => l).join("\n");

    logActivity("download", `Enviando a JDownloader: ${packageName}`);

    const jdResult = await addLinksToJD(
      config.jd_email,
      config.jd_password,
      linksText,
      fullDownloadPath,
      packageName
    );

    if (jdResult.success) {
      logActivity("success", `✅ Alternativa procesada: ${alt.title}`);
      // Update the original post status
      db.prepare("UPDATE scanned_posts SET status = 'downloaded', sent_to_jdownloader = 1, download_links = ? WHERE id = ?")
        .run(JSON.stringify(links), id);
      db.prepare("INSERT OR REPLACE INTO downloads (id, post_url, title, library_id, links, status) VALUES (?, ?, ?, ?, ?, 'pending')")
        .run(`dl_${id}`, alt.url, alt.title, post.library_id, JSON.stringify(links));
      return Response.json({ success: true, alternative: alt.title });
    } else {
      logActivity("error", `Error JDownloader: ${jdResult.error}`);
    }
  }

  // No good alternative found
  db.prepare("UPDATE scanned_posts SET status = 'quarantine' WHERE id = ?").run(id);
  logActivity("error", `No se encontraron alternativas con enlaces directos h265 para: ${coreName}`);
  return Response.json({ success: false, reason: "No alternatives with direct h265 links found" });
}
