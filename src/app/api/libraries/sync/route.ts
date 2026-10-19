import { getDb, getAllConfig } from "@/lib/db";
import { getEmbyLibraries } from "@/lib/emby";

export async function POST() {
  try {
    const config = getAllConfig();
    if (!config.emby_url || !config.emby_api_key) {
      return Response.json({ error: "Emby no configurado" }, { status: 400 });
    }

    const embyLibs = await getEmbyLibraries();
    const db = getDb();

    for (const lib of embyLibs) {
      const id = `lib_${lib.Name.toLowerCase().replace(/\s+/g, "_")}`;
      const paths = JSON.stringify(lib.Locations);

      db.prepare(`
        INSERT OR IGNORE INTO libraries (id, emby_id, name, collection_type, paths, enabled)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(id, lib.ItemId, lib.Name, lib.CollectionType, paths);
    }

    return Response.json({ success: true, count: embyLibs.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
