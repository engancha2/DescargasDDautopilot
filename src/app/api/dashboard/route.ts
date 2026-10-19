import { getAllConfig, getDb } from "@/lib/db";
import { testEmbyConnection } from "@/lib/emby";

export async function GET() {
  const config = getAllConfig();
  const db = getDb();

  const libraries = db.prepare("SELECT COUNT(*) as count FROM libraries").get() as { count: number };
  const enabledLibraries = db.prepare("SELECT COUNT(*) as count FROM libraries WHERE enabled = 1").get() as { count: number };
  const forumUrls = db.prepare("SELECT COUNT(*) as count FROM forum_urls").get() as { count: number };
  const scannedPosts = db.prepare("SELECT COUNT(*) as count FROM scanned_posts").get() as { count: number };
  const pendingDownloads = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'pending' OR status = 'downloading'").get() as { count: number };
  const completedDownloads = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'completed'").get() as { count: number };

  let embyStatus = null;
  if (config.emby_url && config.emby_api_key) {
    embyStatus = await testEmbyConnection();
  }

  return Response.json({
    config: {
      emby_url: config.emby_url || "",
      emby_api_key: config.emby_api_key ? "***" : "",
      jd_email: config.jd_email || "",
      forum_user: config.forum_user || "",
    },
    stats: {
      libraries: libraries.count,
      enabledLibraries: enabledLibraries.count,
      forumUrls: forumUrls.count,
      scannedPosts: scannedPosts.count,
      pendingDownloads: pendingDownloads.count,
      completedDownloads: completedDownloads.count,
    },
    embyStatus,
  });
}
