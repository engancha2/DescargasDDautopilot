import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const libraryId = url.searchParams.get("libraryId");
  const db = getDb();

  const urls = libraryId
    ? db.prepare("SELECT * FROM forum_urls WHERE library_id = ?").all(libraryId)
    : db.prepare("SELECT * FROM forum_urls").all();

  return Response.json({ forumUrls: urls });
}

export async function POST(request: Request) {
  const { libraryId, url, name } = await request.json();
  const db = getDb();
  const id = randomUUID();

  db.prepare("INSERT INTO forum_urls (id, library_id, url, name) VALUES (?, ?, ?, ?)")
    .run(id, libraryId, url, name || "");

  return Response.json({ success: true, id });
}
