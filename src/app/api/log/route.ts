import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const db = getDb();

  const logs = db.prepare("SELECT * FROM activity_log ORDER BY id DESC LIMIT ?").all(limit);
  return Response.json({ logs });
}
