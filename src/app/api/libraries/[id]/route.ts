import { getDb } from "@/lib/db";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM libraries WHERE id = ?").run(id);
  return Response.json({ success: true });
}
