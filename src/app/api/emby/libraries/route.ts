import { getEmbyLibraries } from "@/lib/emby";

export async function GET() {
  try {
    const libraries = await getEmbyLibraries();
    return Response.json({ libraries });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
