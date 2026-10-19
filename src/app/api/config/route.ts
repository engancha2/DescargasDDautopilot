import { getAllConfig, setConfig } from "@/lib/db";

export async function GET() {
  const config = getAllConfig();
  return Response.json({ config });
}

export async function POST(request: Request) {
  const body = await request.json();
  for (const [key, value] of Object.entries(body)) {
    setConfig(key, String(value));
  }
  return Response.json({ success: true });
}
